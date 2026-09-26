import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type {
  Terrain3DData,
  BreachParameters,
  CameraPreset,
  ProjectHydraulics,
} from '../../types/simulation';
import { createMachhuDamModel, type MachhuDamGroup } from './machhuDamModel';
import { BreachParametersCard } from './BreachParametersCard';
import { CameraDock } from './CameraDock';
import { HydraulicStatusPanel, type HydraulicSnapshot } from './HydraulicStatusPanel';
import reservoirShorelineRaw from '../../../../data/candidates/machhu-ii/reservoir-shoreline.geojson?raw';
import {
  PROJECT,
  chooseDamFrame,
  crestLocalPath,
  damLocalToScene,
  geoToLocalMetres,
  reservoirSurfaceYForLevel,
  type DamFrame,
  type LocalPoint,
} from './damFrame';

interface DigitalTwin3DProps {
  terrainData?: Terrain3DData;
  breachParams: BreachParameters;
  onBreachParamsChange: (params: Partial<BreachParameters>) => void;
  currentTime: number;
  hydraulics: ProjectHydraulics;
}

// Physical extents from the 12 km DEM export and approximate Machhu-II
// reconstruction products. The shoreline source is explicitly approximate.
const TERRAIN_WIDTH_M = 12000;
const TERRAIN_DEPTH_M = 12000;
const DAM_LENGTH_M = 4930;
// Display crop only: retain 150 m of earthfill beside each side of the spillway.
const DISPLAYED_DAM_LENGTH_M = 600;
const RESERVOIR_LENGTH_M = 6189;
const RESERVOIR_WIDTH_M = 5328;
const GROUND_CLEARANCE_M = 0.2;
const WALK_SPEED_MPS = 60;
const WALK_BOOST_MPS = 180;

interface ReservoirGeoJSON {
  features: Array<{ geometry: { coordinates: number[][][] } }>;
}

const reservoirShoreline = JSON.parse(reservoirShorelineRaw) as ReservoirGeoJSON;

// The shoreline is projected against the project dam reference point, the same
// reference the dam placement frame uses, so water and dam cannot drift apart.
function reservoirOutlineMeters(): LocalPoint[] {
  const coordinates = reservoirShoreline.features[0].geometry.coordinates[0];
  return coordinates.map(([longitude, latitude]) =>
    geoToLocalMetres(longitude, latitude, PROJECT.longitude, PROJECT.latitude),
  );
}

let cachedDamFrame: DamFrame | null = null;

/**
 * Placement frame for the procedural dam: the surveyed crest and the measured
 * shoreline are static project data, so the frame is solved once and reused by the
 * model placement and by every dam-local camera preset.
 */
function damFrame(): DamFrame {
  if (!cachedDamFrame) {
    cachedDamFrame = chooseDamFrame(
      crestLocalPath(),
      reservoirOutlineMeters(),
      DISPLAYED_DAM_LENGTH_M,
    );
  }
  return cachedDamFrame;
}

/** Dam-local (x, z) to scene (x, z) under the solved frame. */
function toScene(localX: number, localZ: number): { x: number; z: number } {
  return damLocalToScene(damFrame(), localX, localZ);
}

function gateFailureCenter(gateIndex: number, failedGateCount = 1): number {
  const gateSpacing = 300 / 18;
  const start = THREE.MathUtils.clamp(Math.round(gateIndex), 1, 18);
  const count = THREE.MathUtils.clamp(Math.round(failedGateCount), 1, 19 - start);
  return -150 + (start - 0.5 + (count - 1) / 2) * gateSpacing;
}

function interpolateStorage(stageStorage: [number, number][], levelM: number): number {
  if (levelM <= stageStorage[0][0]) return stageStorage[0][1];
  for (let i = 1; i < stageStorage.length; i++) {
    const [upperLevel, upperStorage] = stageStorage[i];
    const [lowerLevel, lowerStorage] = stageStorage[i - 1];
    if (levelM <= upperLevel) {
      const fraction = (levelM - lowerLevel) / (upperLevel - lowerLevel);
      return THREE.MathUtils.lerp(lowerStorage, upperStorage, fraction);
    }
  }
  return stageStorage[stageStorage.length - 1][1];
}

function interpolateLevel(stageStorage: [number, number][], storageM3: number): number {
  if (storageM3 <= stageStorage[0][1]) return stageStorage[0][0];
  for (let i = 1; i < stageStorage.length; i++) {
    const [upperLevel, upperStorage] = stageStorage[i];
    const [lowerLevel, lowerStorage] = stageStorage[i - 1];
    if (storageM3 <= upperStorage) {
      const fraction = (storageM3 - lowerStorage) / (upperStorage - lowerStorage);
      return THREE.MathUtils.lerp(lowerLevel, upperLevel, fraction);
    }
  }
  return stageStorage[stageStorage.length - 1][0];
}

function hydraulicSnapshot(
  currentTimeH: number,
  breachParams: BreachParameters,
  hydraulics: ProjectHydraulics,
): HydraulicSnapshot {
  const initialStorage = interpolateStorage(hydraulics.stage_storage, hydraulics.initial_water_level_m);
  const formationH = Math.max(breachParams.formationTimeHours, 0.01);
  const hydraulicHeadM = breachParams.damHeight * 0.85;
  const gateBayWidthM = 300 / 18 - 2.8;
  let openingAreaM2 = 0;
  let dischargeCoefficient = 0.62;
  let orificeDischarge = 0;

  if (breachParams.type === 'earthen' || !breachParams.type) {
    const initW = breachParams.initialBreachWidthM ?? 20;
    const finalW = breachParams.finalBreachWidthM ?? 150;
    const sideSlope = breachParams.breachSideSlope ?? 1.0;
    const maxDepth = breachParams.breachDepthM ?? (breachParams.damHeight * 0.8);
    const elapsedH = Math.max(currentTimeH, 0);
    const rawP = THREE.MathUtils.clamp(elapsedH / formationH, 0, 1);
    const p = rawP * rawP * (3 - 2 * rawP);

    const bBot = initW + (finalW - initW) * p;
    const invertDepth = maxDepth * p;
    const breachInvertLevel = breachParams.damHeight - invertDepth;
    const head = Math.max(hydraulics.initial_water_level_m - breachInvertLevel, 0);

    // Broad-crested trapezoidal weir equation: Q = Cd * (b * H^1.5 + 0.4 * z * H^2.5 * sqrt(2g))
    const Q_weir = 1.44 * (bBot * Math.pow(head, 1.5) + 0.4 * sideSlope * Math.pow(head, 2.5) * Math.sqrt(2 * 9.80665));
    openingAreaM2 = head * (bBot + sideSlope * head);
    orificeDischarge = Q_weir;
  } else if (breachParams.type === 'crack') {
    openingAreaM2 = breachParams.crackSizeM * (breachParams.leakOpeningMm / 1000) * 2.5;
    orificeDischarge = dischargeCoefficient * openingAreaM2 * Math.sqrt(2 * 9.80665 * hydraulicHeadM);
  } else if (breachParams.type === 'partial') {
    openingAreaM2 = breachParams.holeWidthM * breachParams.holeHeightM;
    dischargeCoefficient = 0.68;
    orificeDischarge = dischargeCoefficient * openingAreaM2 * Math.sqrt(2 * 9.80665 * hydraulicHeadM);
  } else {
    openingAreaM2 = gateBayWidthM * Math.min(hydraulicHeadM, 18) * breachParams.failedGateCount;
    dischargeCoefficient = 0.9;
    orificeDischarge = dischargeCoefficient * openingAreaM2 * Math.sqrt(2 * 9.80665 * hydraulicHeadM);
  }

  const peakQ = breachParams.state === 'breached'
    ? Math.min(Math.max(breachParams.peakDischarge, 0), Math.max(orificeDischarge, 50))
    : 0;
  const elapsedS = Math.max(currentTimeH, 0) * 3600;
  const riseS = formationH * 3600;
  const riseVolume = Math.min(0.5 * peakQ * riseS, initialStorage);
  const recessionTauS = peakQ > 0 ? Math.max((initialStorage - riseVolume) / peakQ, 1) : 1;

  let breachQ = 0;
  let releasedVolume = 0;
  if (elapsedS > 0 && elapsedS <= riseS) {
    breachQ = peakQ * elapsedS / riseS;
    releasedVolume = 0.5 * peakQ * elapsedS * elapsedS / riseS;
  } else if (elapsedS > riseS) {
    const recessionS = elapsedS - riseS;
    breachQ = peakQ * Math.exp(-recessionS / recessionTauS);
    releasedVolume = riseVolume + peakQ * recessionTauS * (1 - Math.exp(-recessionS / recessionTauS));
  }

  releasedVolume = Math.min(releasedVolume, initialStorage);
  const reservoirStorage = Math.max(initialStorage - releasedVolume, 0);
  const reservoirLevel = interpolateLevel(hydraulics.stage_storage, reservoirStorage);
  const massResidual = initialStorage - reservoirStorage - releasedVolume;

  return {
    breachActive: breachParams.state === 'breached',
    releaseActive: breachQ > 0.01,
    breachDischargeM3s: breachQ,
    spillwayDischargeM3s: 0,
    releasedVolumeM3: releasedVolume,
    reservoirStorageM3: reservoirStorage,
    reservoirLevelM: reservoirLevel,
    storagePercent: hydraulics.reservoir_capacity_m3 > 0
      ? reservoirStorage / hydraulics.reservoir_capacity_m3 * 100
      : 0,
    massResidualM3: massResidual,
  };
}

function terrainElevationAt(
  terrainData: Terrain3DData,
  row: number,
  col: number,
): number {
  const measuredElevation = terrainData.elevation_grid?.[row]?.[col];
  if (Number.isFinite(measuredElevation)) return measuredElevation as number;

  const normalizedElevation = terrainData.normalized_elev?.[row]?.[col];
  const minElevation = terrainData.elev_min_m;
  const maxElevation = terrainData.elev_max_m;
  if (
    Number.isFinite(normalizedElevation)
    && Number.isFinite(minElevation)
    && Number.isFinite(maxElevation)
  ) {
    return (minElevation as number)
      + (normalizedElevation as number) * ((maxElevation as number) - (minElevation as number));
  }

  return 0;
}

function sampleTerrainElevation(
  terrainData: Terrain3DData,
  normalizedX: number,
  normalizedZ: number,
): number {
  const grid = terrainData.elevation_grid ?? terrainData.normalized_elev;
  const rows = grid?.length ?? 0;
  const columns = grid?.[0]?.length ?? 0;
  if (rows === 0 || columns === 0) return 0;

  // dam_position uses scene-normalized coordinates: -0.5 is the west/north
  // edge and +0.5 is the east/south edge of the terrain plane.
  const gridX = THREE.MathUtils.clamp(normalizedX + 0.5, 0, 1) * (columns - 1);
  const gridZ = THREE.MathUtils.clamp(normalizedZ + 0.5, 0, 1) * (rows - 1);
  const col0 = Math.floor(gridX);
  const col1 = Math.min(col0 + 1, columns - 1);
  const row0 = Math.floor(gridZ);
  const row1 = Math.min(row0 + 1, rows - 1);
  const tx = gridX - col0;
  const tz = gridZ - row0;

  const north = THREE.MathUtils.lerp(
    terrainElevationAt(terrainData, row0, col0),
    terrainElevationAt(terrainData, row0, col1),
    tx,
  );
  const south = THREE.MathUtils.lerp(
    terrainElevationAt(terrainData, row1, col0),
    terrainElevationAt(terrainData, row1, col1),
    tx,
  );
  return THREE.MathUtils.lerp(north, south, tz);
}

export const DigitalTwin3D: React.FC<DigitalTwin3DProps> = ({
  terrainData,
  breachParams,
  onBreachParamsChange,
  currentTime,
  hydraulics,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const damModelRef = useRef<MachhuDamGroup | null>(null);
  const initialSceneInputsRef = useRef({ terrainData, breachParams, hydraulics });
  const movementRef = useRef({ forward: false, backward: false, left: false, right: false, boost: false });

  const [activeCamera, setActiveCamera] = React.useState<CameraPreset>('spillway');
  const snapshot = useMemo(
    () => hydraulicSnapshot(currentTime, breachParams, hydraulics),
    [currentTime, breachParams, hydraulics],
  );
  const damLength = terrainData?.dam_length_m ?? DAM_LENGTH_M;
  const displayedDamLength = Math.min(damLength, DISPLAYED_DAM_LENGTH_M);
  const reservoirLength = terrainData?.reservoir_bounds_m?.length ?? RESERVOIR_LENGTH_M;
  const sceneSpan = Math.max(damLength, reservoirLength);

  // 1. Initialize Scene & Three.js Engine
  useEffect(() => {
    const {
      terrainData: initialTerrainData,
      breachParams: initialBreachParams,
      hydraulics: initialHydraulics,
    } = initialSceneInputsRef.current;
    const initialDamLength = initialTerrainData?.dam_length_m ?? DAM_LENGTH_M;
    const initialReservoirLength = initialTerrainData?.reservoir_bounds_m?.length ?? RESERVOIR_LENGTH_M;
    const initialSceneSpan = Math.max(initialDamLength, initialReservoirLength);
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    // Warm atmospheric sky matching reference image
    scene.background = new THREE.Color(0xb0c7de);
    // Scale atmospheric falloff to the full-size scene. The former miniature
    // density reduced objects 5 km away to roughly 3% visibility.
    scene.fog = new THREE.FogExp2(0xb0c7de, 1 / (initialSceneSpan * 5));
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(46, width / height, 1, 15000);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI * 0.485;
    controlsRef.current = controls;

    // Lighting (Golden Hour Sun + Sky Fill matching reference image)
    const sun = new THREE.DirectionalLight(0xfff7e6, 2.5);
    sun.position.set(initialSceneSpan * 0.2, initialSceneSpan * 0.3, -initialSceneSpan * 0.2);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = initialSceneSpan * 2;
    const d = initialDamLength * 0.55;
    sun.shadow.camera.left = -d;
    sun.shadow.camera.right = d;
    sun.shadow.camera.top = d;
    sun.shadow.camera.bottom = -d;
    scene.add(sun);

    const hemi = new THREE.HemisphereLight(0xb4d4ee, 0x6e5c46, 0.9);
    scene.add(hemi);

    const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambient);

    // Natural Riverbed Valley Floor (Surrounding Ground beneath the Dam)
    const terrainGrid = initialTerrainData?.elevation_grid ?? initialTerrainData?.normalized_elev;
    const terrainRows = terrainGrid?.length ?? 0;
    const terrainColumns = terrainGrid?.[0]?.length ?? 0;
    const sourceTerrainWidth = initialTerrainData?.extent_m?.width ?? TERRAIN_WIDTH_M;
    const sourceTerrainDepth = initialTerrainData?.extent_m?.depth ?? TERRAIN_DEPTH_M;
    // Keep the DEM in physical metres, but render only the near-dam strip. The
    // former 12 km square made the 4.93 km structure read like a miniature and
    // exposed a large, irrelevant land plane outside the hydraulic features.
    const terrainWidth = Math.min(sourceTerrainWidth, DISPLAYED_DAM_LENGTH_M + 40);
    const terrainDepth = Math.min(sourceTerrainDepth, 180);
    const sourceSpacingX = sourceTerrainWidth / Math.max(terrainColumns - 1, 32);
    const sourceSpacingZ = sourceTerrainDepth / Math.max(terrainRows - 1, 32);
    const segmentsX = Math.max(32, Math.round(terrainWidth / sourceSpacingX));
    const segmentsY = Math.max(16, Math.round(terrainDepth / sourceSpacingZ));
    const damPosition = initialTerrainData?.dam_position ?? { x: 0, y: 0, z: 0 };
    const damGroundElevation = initialTerrainData
      ? sampleTerrainElevation(initialTerrainData, damPosition.x, damPosition.z)
      : 0;
    const groundGeo = new THREE.PlaneGeometry(terrainWidth, terrainDepth, segmentsX, segmentsY);
    groundGeo.rotateX(-Math.PI / 2);
    // Keep only the foundation and apron surroundings, leaving the upstream
    // reservoir unobscured by a coarse DEM strip with no bathymetric detail.
    groundGeo.translate(0, 0, 60);

    if (initialTerrainData && terrainGrid) {
      const posAttr = groundGeo.attributes.position;

      for (let i = 0; i < posAttr.count; i++) {
        const sceneX = posAttr.getX(i);
        const sceneZ = posAttr.getZ(i);
        let elevation = sampleTerrainElevation(
          initialTerrainData,
          damPosition.x + sceneX / sourceTerrainWidth,
          damPosition.z + sceneZ / sourceTerrainDepth,
        );
        const gridSpacingZ = terrainDepth / Math.max(segmentsY, 1);
        const foundationHalfDepth = Math.max(gridSpacingZ * 0.75, initialBreachParams.damHeight * 3);
        if (Math.abs(sceneX) <= initialDamLength / 2 && Math.abs(sceneZ) <= foundationHalfDepth) {
          elevation = Math.min(elevation, damGroundElevation);
        }
        posAttr.setY(i, elevation);
      }
      groundGeo.computeVertexNormals();
    }

    const groundCanvas = document.createElement('canvas');
    groundCanvas.width = 512;
    groundCanvas.height = 512;
    const gCtx = groundCanvas.getContext('2d')!;
    gCtx.fillStyle = '#3f513f';
    gCtx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 30000; i++) {
      const gx = Math.random() * 512;
      const gy = Math.random() * 512;
      const tone = Math.floor(50 + Math.random() * 35);
      gCtx.fillStyle = `rgb(${tone + 15}, ${tone + 22}, ${tone + 10})`;
      gCtx.fillRect(gx, gy, 3, 3);
    }
    const groundTex = new THREE.CanvasTexture(groundCanvas);
    groundTex.wrapS = THREE.RepeatWrapping;
    groundTex.wrapT = THREE.RepeatWrapping;
    groundTex.repeat.set(12, 4);

    const groundMat = new THREE.MeshStandardMaterial({
      map: groundTex,
      roughness: 0.92,
      metalness: 0.05,
    });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.receiveShadow = true;

    // The procedural dam, reservoir, and river all use the dam foundation as
    // local y=0. Translate the DEM by the sampled foundation elevation so all
    // scene assets share that same vertical datum. A tiny clearance prevents
    // coplanar terrain faces from flickering through the dam foundation.
    groundMesh.position.set(0, -damGroundElevation - GROUND_CLEARANCE_M, 0);
    scene.add(groundMesh);

    // Procedural Machhu-II Dam Model
    const damModel = createMachhuDamModel({
      damLength: initialDamLength,
      displayedDamLength: DISPLAYED_DAM_LENGTH_M,
      damHeight: initialBreachParams.damHeight,
      reservoirLength: initialTerrainData?.reservoir_bounds_m?.length ?? RESERVOIR_LENGTH_M,
      reservoirWidth: initialTerrainData?.reservoir_bounds_m?.width ?? RESERVOIR_WIDTH_M,
      reservoirOutlineM: reservoirOutlineMeters(),
      spillwayWidth: 300,
      numPiers: 18,
      peakDischarge: initialBreachParams.peakDischarge,
      breachActive: false,
      initialReservoirSurfaceYM: reservoirSurfaceYForLevel(
        initialHydraulics.initial_water_level_m,
        initialBreachParams.damHeight,
      ),
    });

    // The model is built along a straight local axis. Rotate and translate the whole
    // group onto the surveyed crest so the wall and the measured water body agree:
    // a crest-aligned wall leaves no dry gap behind the gates. Solved in damFrame.ts.
    const frame = damFrame();
    damModel.rotation.y = frame.angleRad;
    damModel.position.set(frame.offsetX, 0, frame.offsetZ);
    scene.add(damModel);

    damModelRef.current = damModel;

    // Start close enough to read the true 22.56 m structural height. A whole-site
    // 1:1 overview necessarily makes a 4.93 km-long earthfill dam look very thin.
    const initialCamera = toScene(35, 360);
    const initialTarget = toScene(0, -45);
    camera.position.set(initialCamera.x, 155, initialCamera.z);
    controls.target.set(initialTarget.x, initialBreachParams.damHeight * 0.45, initialTarget.z);
    controls.update();

    // Animation Render Loop
    let animId: number;
    const clock = new THREE.Clock();

    const movementKeys = new Map<string, keyof typeof movementRef.current>([
      ['w', 'forward'], ['arrowup', 'forward'],
      ['s', 'backward'], ['arrowdown', 'backward'],
      ['a', 'left'], ['arrowleft', 'left'],
      ['d', 'right'], ['arrowright', 'right'],
    ]);
    const setMovementKey = (event: KeyboardEvent, pressed: boolean) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, select, button, [contenteditable="true"]')) return;
      const key = event.key.toLowerCase();
      const movementKey = movementKeys.get(key);
      if (movementKey) {
        movementRef.current[movementKey] = pressed;
        event.preventDefault();
      } else if (key === 'shift') {
        movementRef.current.boost = pressed;
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => setMovementKey(event, true);
    const handleKeyUp = (event: KeyboardEvent) => setMovementKey(event, false);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    const moveCamera = (delta: number) => {
      const movement = movementRef.current;
      const forward = new THREE.Vector3();
      camera.getWorldDirection(forward);
      forward.y = 0;
      if (forward.lengthSq() === 0) return;
      forward.normalize();
      const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
      const direction = new THREE.Vector3();
      if (movement.forward) direction.add(forward);
      if (movement.backward) direction.sub(forward);
      if (movement.right) direction.add(right);
      if (movement.left) direction.sub(right);
      if (direction.lengthSq() === 0) return;
      direction.normalize().multiplyScalar(delta * (movement.boost ? WALK_BOOST_MPS : WALK_SPEED_MPS));
      camera.position.add(direction);
      controls.target.add(direction);
    };

    const loop = () => {
      animId = requestAnimationFrame(loop);
      const delta = clock.getDelta();
      moveCamera(Math.min(delta, 0.05));

      if (damModelRef.current?.userData?.tick) {
        damModelRef.current.userData.tick(delta);
      }

      controls.update();
      renderer.render(scene, camera);
    };

    animId = requestAnimationFrame(loop);

    // Resize Observer
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      renderer.dispose();
      controls.dispose();
      groundGeo.dispose();
    };
  }, []);

  // 2. Update geometry parameters without creating water release.
  useEffect(() => {
    if (!damModelRef.current?.userData) return;
    damModelRef.current.userData.updateGateFailure(
      breachParams.type,
      breachParams.gateIndex,
      breachParams.failedGateCount,
      breachParams.crackSizeM,
      breachParams.holeWidthM,
      breachParams.holeHeightM,
    );
    damModelRef.current.userData.updateDamHeight(breachParams.damHeight);
  }, [
    breachParams.type,
    breachParams.gateIndex,
    breachParams.failedGateCount,
    breachParams.crackSizeM,
    breachParams.holeWidthM,
    breachParams.holeHeightM,
    breachParams.damHeight,
  ]);

  // 3. Drive the visible release from the conservation replay only.
  useEffect(() => {
    if (!damModelRef.current?.userData) return;
    // The water surface is the published level above the dam foundation, not a
    // stretched display fraction: the real operating band is only 2.7 m
    // (54.584-57.3 m) and mapping it across the full dam height moved the surface
    // by metres. Uses the configured dam height rather than breachParams.damHeight,
    // because the model already scales its own geometry with the live height.
    const reservoirSurfaceY = reservoirSurfaceYForLevel(
      snapshot.reservoirLevelM,
      PROJECT.dam_height_m,
    );

    const formationH = Math.max(breachParams.formationTimeHours || 0.5, 0.01);
    const rawProgress = THREE.MathUtils.clamp(currentTime / formationH, 0, 1);
    const smoothProgress = rawProgress * rawProgress * (3 - 2 * rawProgress);

    damModelRef.current.userData.setBreachActive(snapshot.breachActive);
    damModelRef.current.userData.updateEarthenBreach(
      smoothProgress,
      breachParams.initialBreachWidthM ?? 20,
      breachParams.finalBreachWidthM ?? 150,
      breachParams.breachDepthM ?? (breachParams.damHeight * 0.8),
      breachParams.breachSideSlope ?? 1.0,
    );
    damModelRef.current.userData.updateHydraulicState(
      snapshot.breachDischargeM3s,
      snapshot.spillwayDischargeM3s,
      reservoirSurfaceY,
    );
  }, [snapshot, hydraulics, breachParams, currentTime]);

  // 4. Camera Preset Handler
  const handleCameraSelect = (preset: CameraPreset) => {
    setActiveCamera(preset);
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    const h = breachParams.damHeight;
    const breachX = gateFailureCenter(
      breachParams.gateIndex,
      breachParams.type === 'full' ? breachParams.failedGateCount : 1,
    );
    const affectedWidth = breachParams.type === 'full'
      ? 300 / 18 * breachParams.failedGateCount
      : breachParams.type === 'partial'
        ? breachParams.holeWidthM
        : breachParams.crackSizeM;

    // Presets stay authored in dam-local coordinates and are mapped onto the solved
    // frame, so they frame the same structures wherever the crest puts the dam.
    const setShot = (positionX: number, height: number, positionZ: number, targetX: number, targetY: number, targetZ: number) => {
      const position = toScene(positionX, positionZ);
      const target = toScene(targetX, targetZ);
      camera.position.set(position.x, height, position.z);
      controls.target.set(target.x, targetY, target.z);
    };

    switch (preset) {
      case 'overview':
        setShot(displayedDamLength * 0.12, displayedDamLength * 0.55, displayedDamLength * 0.85, 0, h * 0.45, -80);
        break;
      case 'spillway':
        setShot(35, 155, 360, 0, h * 0.45, -45);
        break;
      case 'breach':
        setShot(
          breachX,
          Math.max(h * 1.15, affectedWidth * 0.38),
          THREE.MathUtils.clamp(affectedWidth * 1.8, 30, 320),
          breachX,
          h * 0.52,
          0,
        );
        break;
      case 'downstream':
        setShot(0, h + 120, 850, 0, h * 0.5, 0);
        break;
      case 'dam-walk':
        setShot(-damLength * 0.05, h + 2.5, 0, damLength * 0.05, h + 2.0, 0);
        break;
      case 'reservoir':
        setShot(0, h + sceneSpan * 0.35, -sceneSpan * 0.65, 0, h * 0.5, 0);
        break;
    }
    controls.update();
  };

  // Keep the diagnostic camera locked to the selected gate as the operator
  // moves the position or changes the number/size of affected gates.
  useEffect(() => {
    if (activeCamera !== 'breach') return;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    const failedGateCount = breachParams.type === 'full' ? breachParams.failedGateCount : 1;
    const affectedWidth = breachParams.type === 'full'
      ? 300 / 18 * failedGateCount
      : breachParams.type === 'partial'
        ? breachParams.holeWidthM
        : breachParams.crackSizeM;
    const breachX = gateFailureCenter(breachParams.gateIndex, failedGateCount);

    const position = toScene(
      breachX,
      THREE.MathUtils.clamp(affectedWidth * 1.8, 30, 320),
    );
    const target = toScene(breachX, 0);
    camera.position.set(
      position.x,
      Math.max(breachParams.damHeight * 1.15, affectedWidth * 0.38),
      position.z,
    );
    controls.target.set(target.x, breachParams.damHeight * 0.52, target.z);
    controls.update();
  }, [
    activeCamera,
    breachParams.type,
    breachParams.gateIndex,
    breachParams.failedGateCount,
    breachParams.crackSizeM,
    breachParams.holeWidthM,
    breachParams.damHeight,
  ]);

  return (
    <div className="digital-twin-container" ref={containerRef}>
      <canvas ref={canvasRef} className="three-canvas" />

      <div className="movement-hint" aria-label="3D movement controls">
        <span className="movement-hint-title">NAVIGATION</span>
        <span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> move</span>
        <span><kbd>Shift</kbd> faster</span>
        <span>Drag to orbit</span>
      </div>

      <div className="scene-scale-badge" aria-label="Rendered structural dimensions">
        <span>DISPLAY CROP <strong>{displayedDamLength.toLocaleString()} m</strong></span>
        <span>SPILLWAY <strong>300 m</strong></span>
        <span><strong>18</strong> GATES</span>
        <span>1 UNIT = 1 m</span>
      </div>

      {/* Top-Left Breach Parameters Card (Image 1) */}
      <BreachParametersCard
        params={breachParams}
        onChange={onBreachParamsChange}
      />

      <HydraulicStatusPanel
        snapshot={snapshot}
        currentTime={currentTime}
        provenance={hydraulics.provenance}
      />

      {/* Camera Presets Dock */}
      <CameraDock
        activePreset={activeCamera}
        onSelect={handleCameraSelect}
      />
    </div>
  );
};
