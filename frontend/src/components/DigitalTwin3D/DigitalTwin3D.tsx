import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Terrain3DData, BreachParameters, CameraPreset } from '../../types/simulation';
import { createMachhuDamModel, type MachhuDamGroup } from './machhuDamModel';
import { BreachParametersCard } from './BreachParametersCard';
import { CameraDock } from './CameraDock';

interface DigitalTwin3DProps {
  terrainData?: Terrain3DData;
  breachParams: BreachParameters;
  onBreachParamsChange: (params: Partial<BreachParameters>) => void;
  currentTime: number;
}

export const DigitalTwin3D: React.FC<DigitalTwin3DProps> = ({
  terrainData: _terrainData,
  breachParams,
  onBreachParamsChange,
  currentTime,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const damModelRef = useRef<MachhuDamGroup | null>(null);

  const [activeCamera, setActiveCamera] = React.useState<CameraPreset>('overview');
  const [breachActive, setBreachActive] = React.useState<boolean>(true);

  // 1. Initialize Scene & Three.js Engine
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    // Warm atmospheric sky matching reference image
    scene.background = new THREE.Color(0xb0c7de);
    scene.fog = new THREE.FogExp2(0xb0c7de, 0.00035);
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
    sun.position.set(400, 480, -320);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 2500;
    const d = 500;
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
    const groundGeo = new THREE.PlaneGeometry(3200, 2400, 32, 32);
    groundGeo.rotateX(-Math.PI / 2);
    const groundCanvas = document.createElement('canvas');
    groundCanvas.width = 512;
    groundCanvas.height = 512;
    const gCtx = groundCanvas.getContext('2d')!;
    gCtx.fillStyle = '#837258';
    gCtx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 30000; i++) {
      const gx = Math.random() * 512;
      const gy = Math.random() * 512;
      const col = Math.floor(100 + Math.random() * 50);
      gCtx.fillStyle = `rgb(${col + 25}, ${col + 15}, ${col})`;
      gCtx.fillRect(gx, gy, 3, 3);
    }
    const groundTex = new THREE.CanvasTexture(groundCanvas);
    groundTex.wrapS = THREE.RepeatWrapping;
    groundTex.wrapT = THREE.RepeatWrapping;
    groundTex.repeat.set(16, 12);
    const groundMat = new THREE.MeshStandardMaterial({
      map: groundTex,
      roughness: 0.92,
      metalness: 0.05,
    });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.position.set(0, -0.2, 0);
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    // Procedural Machhu-II Dam Model (Placed at center origin 0,0,0)
    const damModel = createMachhuDamModel({
      damLength: 1940,
      damHeight: breachParams.damHeight,
      spillwayWidth: 300,
      numPiers: 18,
      breachWidth: breachParams.breachWidth,
      peakDischarge: breachParams.peakDischarge,
      breachActive: true,
    });
    damModel.position.set(0, 0, 0);
    scene.add(damModel);
    damModelRef.current = damModel;

    // Initial Camera View: Hero Aerial Angle (Framing both spillway and breach torrent)
    camera.position.set(90, breachParams.damHeight + 80, 225);
    controls.target.set(80, breachParams.damHeight * 0.45, 10);
    controls.update();

    // Animation Render Loop
    let animId: number;
    const clock = new THREE.Clock();

    const loop = () => {
      animId = requestAnimationFrame(loop);
      const delta = clock.getDelta();

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
      renderer.dispose();
      controls.dispose();
      groundGeo.dispose();
    };
  }, []);

  // 2. React to Breach Parameter Changes
  useEffect(() => {
    if (!damModelRef.current?.userData) return;
    damModelRef.current.userData.updateBreachWidth(breachParams.breachWidth);
    damModelRef.current.userData.updateDischarge(breachParams.peakDischarge);
    damModelRef.current.userData.updateDamHeight(breachParams.damHeight);
    damModelRef.current.userData.setBreachActive(breachActive);
  }, [breachParams, breachActive]);

  // 3. React to Timeline Time Changes
  useEffect(() => {
    if (!damModelRef.current?.userData) return;
    // Scale water waterfall based on timeline discharge progression
    let q = breachParams.peakDischarge;
    if (currentTime < 0.5) {
      q = 500; // pre-breach base flow
    } else if (currentTime <= 2.5) {
      q = (currentTime / 2.5) * breachParams.peakDischarge;
    } else {
      q = breachParams.peakDischarge * Math.exp(-(currentTime - 2.5) / 12.0);
    }
    damModelRef.current.userData.updateDischarge(q);
  }, [currentTime, breachParams.peakDischarge]);

  // 4. Camera Preset Handler
  const handleCameraSelect = (preset: CameraPreset) => {
    setActiveCamera(preset);
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    const h = breachParams.damHeight;
    const breachX = 150 + 2.5 + 80 + breachParams.breachWidth / 2;

    switch (preset) {
      case 'overview':
        // Hero Aerial matching user's photo
        camera.position.set(25, h + 85, 230);
        controls.target.set(0, h * 0.45, 0);
        break;
      case 'spillway':
        camera.position.set(0, h * 0.75, 110);
        controls.target.set(0, h * 0.45, 0);
        break;
      case 'breach':
        camera.position.set(breachX + 50, h + 35, 90);
        controls.target.set(breachX, h * 0.4, 10);
        break;
      case 'downstream':
        camera.position.set(0, h + 45, 380);
        controls.target.set(0, h * 0.5, 0);
        break;
      case 'dam-walk':
        camera.position.set(-180, h + 2.5, 0);
        controls.target.set(80, h + 2.0, 0);
        break;
      case 'reservoir':
        camera.position.set(0, h + 80, -250);
        controls.target.set(0, h * 0.5, 0);
        break;
    }
    controls.update();
  };

  return (
    <div className="digital-twin-container" ref={containerRef}>
      <canvas ref={canvasRef} className="three-canvas" />

      {/* Top-Left Breach Parameters Card (Image 1) */}
      <BreachParametersCard
        params={breachParams}
        onChange={onBreachParamsChange}
      />

      {/* Camera Presets Dock */}
      <CameraDock
        activePreset={activeCamera}
        onSelect={handleCameraSelect}
        breachActive={breachActive}
        onToggleBreach={setBreachActive}
      />
    </div>
  );
};
