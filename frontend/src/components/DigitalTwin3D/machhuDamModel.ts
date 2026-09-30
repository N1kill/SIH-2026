import * as THREE from 'three';

export interface MachhuDamModelOptions {
  damLength?: number;
  displayedDamLength?: number;
  damHeight?: number;
  reservoirLength?: number;
  reservoirWidth?: number;
  reservoirOutlineM?: [number, number][];
  spillwayWidth?: number;
  numPiers?: number;
  breachWidth?: number;
  peakDischarge?: number;
  scale?: number;
  breachActive?: boolean;
}

export interface MachhuDamUserData {
  config: Required<MachhuDamModelOptions>;
  tick: (delta?: number) => void;
  updateGateFailure: (
    type: 'crack' | 'partial' | 'full',
    gateIndex: number,
    failedGateCount: number,
    crackSizeM: number,
    holeWidthM: number,
    holeHeightM: number,
  ) => void;
  updateDischarge: (q: number) => void;
  updateHydraulicState: (breachQ: number, spillwayQ: number, reservoirSurfaceY: number) => void;
  updateDamHeight: (h: number) => void;
  setBreachActive: (active: boolean) => void;
}

export type MachhuDamGroup = THREE.Group & {
  userData: MachhuDamUserData;
};

/**
 * Procedural canvas textures for realistic PBR materials
 */
function createProceduralTextures() {
  // 1. Concrete Pier & Masonry Texture
  const concreteCanvas = document.createElement('canvas');
  concreteCanvas.width = 512;
  concreteCanvas.height = 512;
  const ctxC = concreteCanvas.getContext('2d')!;
  ctxC.fillStyle = '#8c9197';
  ctxC.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 40000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const n = (Math.random() - 0.5) * 35;
    ctxC.fillStyle = `rgba(${135 + n}, ${140 + n}, ${145 + n}, 0.6)`;
    ctxC.fillRect(x, y, 2, 2);
  }
  ctxC.strokeStyle = 'rgba(70, 75, 80, 0.4)';
  ctxC.lineWidth = 1.5;
  for (let y = 32; y < 512; y += 48) {
    ctxC.beginPath();
    ctxC.moveTo(0, y);
    ctxC.lineTo(512, y);
    ctxC.stroke();
  }
  const concreteTex = new THREE.CanvasTexture(concreteCanvas);
  concreteTex.wrapS = THREE.RepeatWrapping;
  concreteTex.wrapT = THREE.RepeatWrapping;

  // 2. Earthen Embankment Riprap Rock Texture
  const riprapCanvas = document.createElement('canvas');
  riprapCanvas.width = 512;
  riprapCanvas.height = 512;
  const ctxR = riprapCanvas.getContext('2d')!;
  ctxR.fillStyle = '#7a6750';
  ctxR.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 60000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const gray = Math.floor(90 + Math.random() * 70);
    const tone = Math.random() > 0.4 ? gray : gray - 20;
    ctxR.fillStyle = `rgb(${tone + 20}, ${tone + 10}, ${tone})`;
    ctxR.fillRect(x, y, Math.random() * 4 + 1, Math.random() * 4 + 1);
  }
  const riprapTex = new THREE.CanvasTexture(riprapCanvas);
  riprapTex.wrapS = THREE.RepeatWrapping;
  riprapTex.wrapT = THREE.RepeatWrapping;

  // 3. Turbulent White Water & Foam Texture (Rapid churning cataract flow)
  const waterCanvas = document.createElement('canvas');
  waterCanvas.width = 512;
  waterCanvas.height = 512;
  const ctxW = waterCanvas.getContext('2d')!;

  // Base rapid flow gradient
  const grad = ctxW.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#7dd3fc');
  grad.addColorStop(0.2, '#ffffff');
  grad.addColorStop(0.5, '#e0f2fe');
  grad.addColorStop(0.8, '#ffffff');
  grad.addColorStop(1, '#38bdf8');
  ctxW.fillStyle = grad;
  ctxW.fillRect(0, 0, 512, 512);

  // High-speed vertical turbulence foam streaks
  for (let i = 0; i < 4000; i++) {
    const alpha = 0.35 + Math.random() * 0.65;
    ctxW.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const w = Math.random() * 5 + 1;
    const h = Math.random() * 70 + 20;
    ctxW.fillRect(x, y, w, h);
  }

  const waterTex = new THREE.CanvasTexture(waterCanvas);
  waterTex.wrapS = THREE.RepeatWrapping;
  waterTex.wrapT = THREE.RepeatWrapping;

  // 4. Soft Spray Mist Texture
  const sprayCanvas = document.createElement('canvas');
  sprayCanvas.width = 64;
  sprayCanvas.height = 64;
  const sCtx = sprayCanvas.getContext('2d')!;
  const sGrad = sCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
  sGrad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
  sGrad.addColorStop(0.35, 'rgba(230, 245, 255, 0.45)');
  sGrad.addColorStop(0.7, 'rgba(210, 235, 255, 0.12)');
  sGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  sCtx.fillStyle = sGrad;
  sCtx.fillRect(0, 0, 64, 64);
  const sprayTex = new THREE.CanvasTexture(sprayCanvas);

  return { concreteTex, riprapTex, waterTex, sprayTex };
}

/**
 * Creates the Machhu-II Dam procedural Three.js model
 */
export function createMachhuDamModel(options: MachhuDamModelOptions = {}): MachhuDamGroup {
  const config: Required<MachhuDamModelOptions> = {
    damLength: options.damLength || 4930,
    displayedDamLength: options.displayedDamLength ?? options.damLength ?? 4930,
    damHeight: options.damHeight || 22.56,
    reservoirLength: options.reservoirLength || 6189,
    reservoirWidth: options.reservoirWidth || 5328,
    reservoirOutlineM: options.reservoirOutlineM || [],
    spillwayWidth: options.spillwayWidth || 300,
    numPiers: options.numPiers || 18,
    breachWidth: options.breachWidth || 156,
    peakDischarge: options.peakDischarge || 6647,
    scale: options.scale || 1.0,
    breachActive: options.breachActive ?? false,
  };

  const root = new THREE.Group() as MachhuDamGroup;
  root.name = 'Machhu2Dam_Reconstruction';

  const textures = createProceduralTextures();

  // Materials
  const concreteMat = new THREE.MeshStandardMaterial({
    map: textures.concreteTex,
    roughness: 0.85,
    metalness: 0.1,
    color: 0x9ca3af,
  });

  const darkSteelMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.4,
    metalness: 0.8,
  });

  const gateRadialMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.5,
    metalness: 0.7,
  });

  const riprapMat = new THREE.MeshStandardMaterial({
    map: textures.riprapTex,
    roughness: 0.95,
    metalness: 0.05,
    color: 0x8b7355,
  });

  const reservoirWaterMat = new THREE.MeshStandardMaterial({
    color: 0x0a4b60,
    roughness: 0.12,
    metalness: 0.35,
    transparent: true,
    opacity: 0.94,
    depthWrite: true,
  });

  // GLSL Shader Noise snippet
  const noiseGLSL = `
    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }
    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));
      return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }
    float fbm(vec2 p) {
      float v = 0.0;
      float a = 0.5;
      mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
      for (int i = 0; i < 4; ++i) {
        v += a * noise(p);
        p = rot * p * 2.0 + vec2(100.0);
        a *= 0.5;
      }
      return v;
    }
  `;

  // 1. Roaring Cataract Waterfall Shader (Multi-layer GPU fluid simulation)
  const cataractUniforms = {
    uTime: { value: 0 },
    uSunDir: { value: new THREE.Vector3(0.5, 0.7, -0.4).normalize() },
    uDeepColor: { value: new THREE.Color(0x0e6074) },
    uFoamColor: { value: new THREE.Color(0xffffff) },
    uIntensity: { value: 1.0 },
  };

  const cascadeWaterMat = new THREE.ShaderMaterial({
    uniforms: cataractUniforms,
    vertexShader: `
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vWorldPos;
      void main() {
        vUv = uv;
        vec3 pos = position;
        // Dynamic fluid surge displacement
        float surge = sin(pos.z * 0.35 - uTime * 7.0) * cos(pos.x * 0.12 + uTime * 2.5) * 0.45;
        pos.y += surge;
        vec4 worldPos = modelMatrix * vec4(pos, 1.0);
        vWorldPos = worldPos.xyz;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uSunDir;
      uniform vec3 uDeepColor;
      uniform vec3 uFoamColor;
      uniform float uIntensity;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vWorldPos;
      ${noiseGLSL}
      void main() {
        // High-velocity dual-scrolling turbulence vectors
        vec2 flow1 = vUv * vec2(8.0, 2.5) + vec2(0.0, -uTime * 3.8);
        vec2 flow2 = vUv * vec2(14.0, 4.0) + vec2(sin(vUv.y * 7.0 + uTime * 3.5) * 0.12, -uTime * 5.2);
        
        float n1 = fbm(flow1);
        float n2 = fbm(flow2);
        float turb = (n1 + n2 * 0.8) * 0.8;
        
        // Foam generation
        float foam = smoothstep(0.38, 0.72, turb) * uIntensity;
        
        // Sun specular highlight
        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        vec3 halfDir = normalize(uSunDir + viewDir);
        float spec = pow(max(dot(vNormal, halfDir), 0.0), 36.0) * 1.4;
        
        // Fresnel glancing glow
        float fresnel = pow(1.0 - max(dot(vNormal, viewDir), 0.0), 2.8);
        
        vec3 col = mix(uDeepColor, uFoamColor, foam);
        col += vec3(spec * 0.9) + vec3(fresnel * 0.3);
        
        gl_FragColor = vec4(col, 0.94);
      }
    `,
    transparent: true,
    side: THREE.DoubleSide,
  });

  const riverWaterMat = new THREE.MeshStandardMaterial({
    color: 0x0d5f57,
    roughness: 0.18,
    metalness: 0.2,
    transparent: true,
    opacity: 0.9,
  });

  // 1. Central Spillway Section
  const spillwayGroup = new THREE.Group();
  spillwayGroup.name = 'Central_Spillway';

  const spillwayHalfW = config.spillwayWidth / 2;
  const pierSpacing = config.spillwayWidth / config.numPiers;
  const pierWidth = 2.4;
  const pierHeight = config.damHeight;
  const pierDepth = 18.0;

  // Substructure Ogee overflow weir with realistic curved sloping downstream chute
  const basinLength = 42.0;
  const ogeeShape = new THREE.Shape();
  ogeeShape.moveTo(-pierDepth * 0.55, 0);
  ogeeShape.lineTo(-pierDepth * 0.55, pierHeight * 0.7);
  // Ogee crest curve
  ogeeShape.quadraticCurveTo(0, pierHeight * 0.74, 3.0, pierHeight * 0.65);
  // Sloping discharge chute down to stilling basin apron
  ogeeShape.lineTo(pierDepth * 0.5 + basinLength * 0.45, 1.8);
  ogeeShape.lineTo(pierDepth * 0.5 + basinLength, 1.8);
  ogeeShape.lineTo(pierDepth * 0.5 + basinLength, 0);
  ogeeShape.closePath();

  const ogeeGeo = new THREE.ExtrudeGeometry(ogeeShape, {
    steps: 6,
    depth: config.spillwayWidth,
    bevelEnabled: false,
  });
  // Profile X is downstream distance: map it to +Z. Extrusion maps to
  // -X, so translate by its width to keep the original lateral placement.
  ogeeGeo.rotateY(-Math.PI / 2);
  ogeeGeo.translate(config.spillwayWidth, 0, 0);
  const ogeeMesh = new THREE.Mesh(ogeeGeo, concreteMat);
  ogeeMesh.position.set(-spillwayHalfW, 0, 0);
  ogeeMesh.castShadow = true;
  ogeeMesh.receiveShadow = true;
  spillwayGroup.add(ogeeMesh);

  // 18 Concrete Piers & Tainter Radial Gates
  const piersGroup = new THREE.Group();
  const gatesGroup = new THREE.Group();
  const spillwayCascadesGroup = new THREE.Group();
  spillwayCascadesGroup.visible = false;
  const gateMeshes: THREE.Mesh[] = [];
  const gateCascadeMeshes: THREE.Mesh[] = [];
  const gateCenters: number[] = [];

  for (let i = 0; i <= config.numPiers; i++) {
    const pierX = -spillwayHalfW + i * pierSpacing;

    // Hydrodynamic Pier body (tapered downstream)
    const pierShape = new THREE.Shape();
    pierShape.moveTo(-pierDepth * 0.5, 0);
    pierShape.lineTo(-pierDepth * 0.5, pierHeight + 3.2);
    pierShape.lineTo(pierDepth * 0.35, pierHeight + 3.2);
    pierShape.lineTo(pierDepth * 0.5 + 10.0, 4.0);
    pierShape.lineTo(pierDepth * 0.5 + 10.0, 0);
    pierShape.closePath();

    const pierGeo = new THREE.ExtrudeGeometry(pierShape, {
      steps: 2,
      depth: pierWidth,
      bevelEnabled: true,
      bevelThickness: 0.2,
      bevelSize: 0.2,
    });
    pierGeo.rotateY(-Math.PI / 2);
    pierGeo.translate(pierWidth, 0, 0);
    const pierMesh = new THREE.Mesh(pierGeo, concreteMat);
    pierMesh.position.set(pierX - pierWidth / 2, 0, 0);
    pierMesh.castShadow = true;
    pierMesh.receiveShadow = true;
    piersGroup.add(pierMesh);

    // Upstream Rounded Bullnose
    const bullnoseGeo = new THREE.CylinderGeometry(pierWidth / 2, pierWidth / 2, pierHeight + 3.2, 16);
    const bullnoseMesh = new THREE.Mesh(bullnoseGeo, concreteMat);
    bullnoseMesh.position.set(pierX, (pierHeight + 3.2) / 2, -pierDepth * 0.5);
    piersGroup.add(bullnoseMesh);

    // Radial Gate
    if (i < config.numPiers) {
      const gateX = pierX + pierSpacing / 2;
      const gateWidth = pierSpacing - pierWidth - 0.4;
      const gateRadius = 9.5;

      const gateGeo = new THREE.CylinderGeometry(
        gateRadius,
        gateRadius,
        gateWidth,
        18,
        1,
        true,
        Math.PI * 0.22,
        Math.PI * 0.26
      );
      gateGeo.rotateZ(Math.PI / 2);
      const gateMesh = new THREE.Mesh(gateGeo, gateRadialMat);
      gateMesh.position.set(gateX, pierHeight * 0.56, -2.5);
      gateMesh.castShadow = true;
      gatesGroup.add(gateMesh);
      gateMeshes.push(gateMesh);
      gateCenters.push(gateX);

      // Spillway active cascade water sheet
      const cascadeGeo = new THREE.PlaneGeometry(gateWidth * 0.96, pierHeight * 1.15, 6, 12);
      cascadeGeo.rotateX(Math.PI * 0.34);
      const cascadeMesh = new THREE.Mesh(cascadeGeo, cascadeWaterMat);
      cascadeMesh.position.set(gateX, pierHeight * 0.35, pierDepth * 0.45);
      cascadeMesh.visible = false;
      spillwayCascadesGroup.add(cascadeMesh);
      gateCascadeMeshes.push(cascadeMesh);
    }
  }
  spillwayGroup.add(piersGroup);
  spillwayGroup.add(gatesGroup);
  spillwayGroup.add(spillwayCascadesGroup);

  // Gate-local failure visuals. These are deliberately attached to the
  // concrete spillway assembly; the earthfill flanks are never modified.
  const gateDamageGroup = new THREE.Group();
  gateDamageGroup.name = 'Gate_Failure_Visuals';
  gateDamageGroup.visible = false;

  // Illustrative fractures, not a structural failure prediction. Seed by gate
  // so the irregular branches remain stable while the timeline advances.
  const fractureVertices = (gateIndex: number) => {
    let seed = gateIndex * 2654435761 >>> 0;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const vertices: number[] = [];
    let x = (random() - 0.5) * 0.4;
    let y = -0.95;
    for (let i = 0; i < 13; i++) {
      const nextX = THREE.MathUtils.clamp(x + (random() - 0.5) * 0.42, -0.6, 0.6);
      const nextY = y + 1.9 / 13;
      vertices.push(x, y, 0, nextX, nextY, 0);
      if (i > 1 && i < 11 && random() > 0.48) {
        let bx = nextX;
        let by = nextY;
        const direction = random() > 0.5 ? 1 : -1;
        const segments = 2 + Math.floor(random() * 3);
        for (let j = 0; j < segments; j++) {
          const nx = THREE.MathUtils.clamp(bx + direction * (0.07 + random() * 0.14), -0.95, 0.95);
          const ny = THREE.MathUtils.clamp(by + (random() - 0.35) * 0.23, -0.95, 0.95);
          vertices.push(bx, by, 0, nx, ny, 0);
          bx = nx;
          by = ny;
        }
      }
      x = nextX;
      y = nextY;
    }
    return vertices;
  };
  const crackGeo = new THREE.BufferGeometry();
  let crackPatternGate = 9;
  crackGeo.setAttribute('position', new THREE.Float32BufferAttribute(fractureVertices(crackPatternGate), 3));
  const crackMesh = new THREE.LineSegments(
    crackGeo,
    new THREE.LineBasicMaterial({ color: 0x101820, depthTest: false }),
  );
  crackMesh.renderOrder = 5;
  gateDamageGroup.add(crackMesh);

  const holeMesh = new THREE.Mesh(
    new THREE.CircleGeometry(1, 32),
    new THREE.MeshBasicMaterial({ color: 0x07111d, side: THREE.DoubleSide, depthTest: false }),
  );
  holeMesh.renderOrder = 4;
  gateDamageGroup.add(holeMesh);

  const failureOutline = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(pierSpacing - pierWidth, pierHeight * 0.78, 0.4)),
    new THREE.LineBasicMaterial({ color: 0xff8a4c, depthTest: false }),
  );
  failureOutline.renderOrder = 4;
  gateDamageGroup.add(failureOutline);
  spillwayGroup.add(gateDamageGroup);

  let selectedFailureType: 'crack' | 'partial' | 'full' = 'partial';
  let selectedGateIndex = 9;
  let selectedFailedGateCount = 1;
  let selectedCrackSizeM = 3;
  let selectedHoleWidthM = 6;
  let selectedHoleHeightM = 5;

  const applyGateFailure = () => {
    gateMeshes.forEach((gate) => { gate.visible = true; });
    gateCascadeMeshes.forEach((cascade) => {
      cascade.visible = false;
      cascade.scale.set(1, 1, 1);
    });
    crackMesh.visible = false;
    holeMesh.visible = false;
    failureOutline.visible = false;
    gateDamageGroup.visible = config.breachActive;
    if (!config.breachActive) return;

    const startIndex = THREE.MathUtils.clamp(Math.round(selectedGateIndex) - 1, 0, config.numPiers - 1);
    const centerX = gateCenters[startIndex];
    const faceZ = pierDepth * 0.52;

    if (selectedFailureType === 'crack') {
      if (crackPatternGate !== selectedGateIndex) {
        crackPatternGate = selectedGateIndex;
        crackGeo.setAttribute('position', new THREE.Float32BufferAttribute(fractureVertices(crackPatternGate), 3));
        crackGeo.computeBoundingSphere();
      }
      crackMesh.visible = true;
      crackMesh.position.set(centerX, pierHeight * 0.56, faceZ);
      crackMesh.scale.setScalar(selectedCrackSizeM / 2);
      gateCascadeMeshes[startIndex].visible = true;
      gateCascadeMeshes[startIndex].scale.x = 0.08;
      return;
    }

    if (selectedFailureType === 'partial') {
      holeMesh.visible = true;
      holeMesh.position.set(centerX, pierHeight * 0.5, faceZ);
      holeMesh.scale.set(selectedHoleWidthM / 2, selectedHoleHeightM / 2, 1);
      gateCascadeMeshes[startIndex].visible = true;
      gateCascadeMeshes[startIndex].scale.set(
        Math.min(1, selectedHoleWidthM / (pierSpacing - pierWidth)),
        Math.min(1, selectedHoleHeightM / pierHeight),
        1,
      );
      return;
    }

    const count = Math.min(selectedFailedGateCount, config.numPiers - startIndex);
    const endIndex = startIndex + count - 1;
    for (let index = startIndex; index <= endIndex; index++) {
      gateMeshes[index].visible = false;
      gateCascadeMeshes[index].visible = true;
    }
    failureOutline.visible = true;
    failureOutline.position.set(
      (gateCenters[startIndex] + gateCenters[endIndex]) / 2,
      pierHeight * 0.5,
      faceZ,
    );
    failureOutline.scale.x = count;
  };

  // Overhead Gantry Walkway & Crest Road
  const deckLength = config.spillwayWidth + pierWidth * 2;
  const deckGeo = new THREE.BoxGeometry(deckLength, 1.2, 5.2);
  const deckMesh = new THREE.Mesh(deckGeo, concreteMat);
  deckMesh.position.set(0, pierHeight + 3.2, 0);
  deckMesh.castShadow = true;
  spillwayGroup.add(deckMesh);

  const railGeo = new THREE.BoxGeometry(deckLength, 0.9, 0.1);
  const railNorth = new THREE.Mesh(railGeo, darkSteelMat);
  railNorth.position.set(0, pierHeight + 4.2, 2.5);
  const railSouth = new THREE.Mesh(railGeo, darkSteelMat);
  railSouth.position.set(0, pierHeight + 4.2, -2.5);
  spillwayGroup.add(railNorth);
  spillwayGroup.add(railSouth);

  // Concrete Retaining Training Walls (Sloped, matching reference image)
  function createTrainingWall(side: 'left' | 'right') {
    const wallShape = new THREE.Shape();
    wallShape.moveTo(-pierDepth * 0.55, 0);
    wallShape.lineTo(-pierDepth * 0.55, pierHeight * 1.05);
    wallShape.lineTo(pierDepth * 0.35, pierHeight * 1.05);
    // Smooth downstream slope following chute
    wallShape.lineTo(pierDepth * 0.5 + basinLength + 8.0, 3.5);
    wallShape.lineTo(pierDepth * 0.5 + basinLength + 8.0, 0);
    wallShape.closePath();

    const wallGeo = new THREE.ExtrudeGeometry(wallShape, {
      steps: 2,
      depth: 3.5,
      bevelEnabled: true,
      bevelThickness: 0.3,
      bevelSize: 0.3,
    });
    wallGeo.rotateY(-Math.PI / 2);
    wallGeo.translate(3.5, 0, 0);
    const wallMesh = new THREE.Mesh(wallGeo, concreteMat);
    const sign = side === 'left' ? -1 : 1;
    wallMesh.position.set(sign * (spillwayHalfW + (side === 'left' ? 3.5 : 0)), 0, 0);
    wallMesh.castShadow = true;
    wallMesh.receiveShadow = true;
    return wallMesh;
  }

  const leftTrainingWall = createTrainingWall('left');
  spillwayGroup.add(leftTrainingWall);
  const rightTrainingWall = createTrainingWall('right');
  spillwayGroup.add(rightTrainingWall);

  // Stilling Basin / Energy Dissipator Concrete Apron
  const basinWidth = config.spillwayWidth + 4.0;
  const apronGeo = new THREE.BoxGeometry(basinWidth, 1.8, basinLength);
  const apronMesh = new THREE.Mesh(apronGeo, concreteMat);
  apronMesh.position.set(0, 0.9, pierDepth / 2 + basinLength / 2);
  apronMesh.receiveShadow = true;
  spillwayGroup.add(apronMesh);

  // Chute Baffle Blocks (Energy Dissipators) on Apron
  const baffleCount = 14;
  const baffleSpacing = basinWidth / baffleCount;
  for (let b = 0; b < baffleCount; b++) {
    const baffleGeo = new THREE.BoxGeometry(3.5, 2.5, 3.0);
    const baffleMesh = new THREE.Mesh(baffleGeo, concreteMat);
    const bx = -basinWidth / 2 + (b + 0.5) * baffleSpacing;
    baffleMesh.position.set(bx, 1.8 + 1.25, pierDepth / 2 + 15.0);
    baffleMesh.castShadow = true;
    spillwayGroup.add(baffleMesh);
  }

  root.add(spillwayGroup);

  // 2. Earthen Embankment Flanks
  const embankmentGroup = new THREE.Group();
  embankmentGroup.name = 'Earthen_Embankments';

  const crestRoadWidth = 7.0;
  const baseWidth = pierDepth * 2.8;

  function createEmbankmentMesh(length: number, material: THREE.Material, height = config.damHeight) {
    const shape = new THREE.Shape();
    shape.moveTo(-baseWidth * 0.55, 0);
    shape.lineTo(-crestRoadWidth / 2, height);
    shape.lineTo(crestRoadWidth / 2, height);
    shape.lineTo(baseWidth * 0.45, 0);
    shape.closePath();

    const extrudeSettings = { steps: 2, depth: length, bevelEnabled: false };
    const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geo.rotateY(-Math.PI / 2);
    geo.translate(length, 0, 0);
    const mesh = new THREE.Mesh(geo, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  const flankGap = spillwayHalfW + 2.5;
  // A display crop, not a rescaling or a change to the physical dam length.
  const displayedLength = Math.min(config.damLength, config.displayedDamLength);
  const damLeftEdge = -displayedLength / 2;
  const damRightEdge = displayedLength / 2;
  const intactEmbankmentGroup = new THREE.Group();
  intactEmbankmentGroup.name = 'Intact_Earthfill_Flanks';
  const leftFlankMesh = createEmbankmentMesh(-flankGap - damLeftEdge, riprapMat);
  leftFlankMesh.position.set(damLeftEdge, 0, 0);
  intactEmbankmentGroup.add(leftFlankMesh);
  const intactRightFlankMesh = createEmbankmentMesh(damRightEdge - flankGap, riprapMat);
  intactRightFlankMesh.position.set(flankGap, 0, 0);
  intactEmbankmentGroup.add(intactRightFlankMesh);
  intactEmbankmentGroup.visible = !config.breachActive;
  embankmentGroup.add(intactEmbankmentGroup);

  root.add(embankmentGroup);

  // 4. Upstream reservoir clipped to the evidence-backed shoreline. The
  // rectangle is retained only as an explicit fallback for another project
  // that has not supplied an outline.
  let reservoirGeo: THREE.BufferGeometry;
  if (config.reservoirOutlineM.length >= 3) {
    const shape = new THREE.Shape();
    config.reservoirOutlineM.forEach(([x, z], index) => {
      if (index === 0) shape.moveTo(x, -z);
      else shape.lineTo(x, -z);
    });
    shape.closePath();
    reservoirGeo = new THREE.ShapeGeometry(shape);
    // Reflect the input before triangulation, then rotate the front face UP.
    // This preserves the original X/Z shoreline; +PI/2 made the front face
    // point down and back-face culling hid all water from above.
    reservoirGeo.rotateX(-Math.PI / 2);
  } else {
    reservoirGeo = new THREE.PlaneGeometry(config.reservoirWidth, config.reservoirLength, 32, 32);
    reservoirGeo.rotateX(-Math.PI / 2);
    reservoirGeo.translate(0, 0, -(config.reservoirLength / 2 + 12));
  }
  const reservoirMesh = new THREE.Mesh(reservoirGeo, reservoirWaterMat);
  let reservoirSurfaceY = config.damHeight * 0.85;
  reservoirMesh.position.set(0, reservoirSurfaceY, 0);
  reservoirMesh.receiveShadow = true;
  root.add(reservoirMesh);

  // 5. Downstream Machhu River Channel (Spanning from spillway & breach downstream)
  const riverGeo = new THREE.PlaneGeometry(config.spillwayWidth * 1.4 + 180, 1500.0, 32, 32);
  riverGeo.rotateX(-Math.PI / 2);
  const riverMesh = new THREE.Mesh(riverGeo, riverWaterMat);
  riverMesh.position.set(50.0, 0.35, 780.0);
  riverMesh.visible = false;
  riverMesh.receiveShadow = true;
  root.add(riverMesh);

  // 6. 3D Floating Location Pin: Morbi
  const morbiGroup = new THREE.Group();
  morbiGroup.name = 'Marker_Morbi';
  morbiGroup.position.set(-120.0, 35.0, 2400.0);

  const badgeCanvas = document.createElement('canvas');
  badgeCanvas.width = 256;
  badgeCanvas.height = 80;
  const ctxB = badgeCanvas.getContext('2d')!;
  ctxB.fillStyle = 'rgba(15, 23, 42, 0.85)';
  if (ctxB.roundRect) {
    ctxB.roundRect(4, 4, 248, 72, 16);
  } else {
    ctxB.rect(4, 4, 248, 72);
  }
  ctxB.fill();
  ctxB.lineWidth = 3;
  ctxB.strokeStyle = '#38bdf8';
  ctxB.stroke();
  ctxB.fillStyle = '#ffffff';
  ctxB.font = 'bold 36px "Inter", "Segoe UI", sans-serif';
  ctxB.textAlign = 'center';
  ctxB.textBaseline = 'middle';
  ctxB.fillText('Morbi', 128, 40);

  const badgeTex = new THREE.CanvasTexture(badgeCanvas);
  const badgeMat = new THREE.SpriteMaterial({ map: badgeTex, depthTest: false });
  const morbiSprite = new THREE.Sprite(badgeMat);
  morbiSprite.scale.set(120, 38, 1);
  morbiGroup.add(morbiSprite);

  root.add(morbiGroup);

  // Dynamic API
  let timeElapsed = 0;

  root.userData = {
    config,
    tick: (delta = 0.016) => {
      timeElapsed += delta;

      textures.waterTex.offset.y -= delta * 3.8;
      textures.waterTex.offset.x += Math.sin(timeElapsed * 4.0) * 0.005;

      reservoirMesh.position.y = reservoirSurfaceY + Math.sin(timeElapsed * 1.5) * 0.03;
      cascadeWaterMat.uniforms.uTime.value = timeElapsed;
    },

    updateGateFailure: (
      type,
      gateIndex,
      failedGateCount,
      crackSizeM,
      holeWidthM,
      holeHeightM,
    ) => {
      selectedFailureType = type;
      selectedGateIndex = THREE.MathUtils.clamp(Math.round(gateIndex), 1, config.numPiers);
      selectedFailedGateCount = THREE.MathUtils.clamp(
        Math.round(failedGateCount),
        1,
        config.numPiers - selectedGateIndex + 1,
      );
      selectedCrackSizeM = THREE.MathUtils.clamp(crackSizeM, 0.25, 8);
      selectedHoleWidthM = THREE.MathUtils.clamp(holeWidthM, 0.5, pierSpacing - pierWidth);
      selectedHoleHeightM = THREE.MathUtils.clamp(holeHeightM, 0.5, pierHeight * 0.8);
      applyGateFailure();
    },

    updateDischarge: (newQ: number) => {
      config.peakDischarge = newQ;
      const ratio = Math.max(0, Math.min(2.5, newQ / 6647));

      cascadeWaterMat.uniforms.uIntensity.value = ratio;

      riverMesh.scale.y = 0.04 * (1.0 + (ratio - 1.0) * 0.5);
    },

    updateHydraulicState: (breachQ: number, spillwayQ: number, nextReservoirSurfaceY: number) => {
      root.userData.updateDischarge(breachQ);
      spillwayCascadesGroup.visible = breachQ + spillwayQ > 0.01;
      riverMesh.visible = breachQ + spillwayQ > 0.01;
      reservoirSurfaceY = THREE.MathUtils.clamp(nextReservoirSurfaceY, 0.4, config.damHeight - 0.4);
    },

    updateDamHeight: (newH: number) => {
      config.damHeight = Math.max(10, Math.min(35, newH));
      root.scale.y = config.damHeight / 22.56;
    },

    setBreachActive: (active: boolean) => {
      config.breachActive = active;
      intactEmbankmentGroup.visible = true;
      applyGateFailure();
    },
  };

  return root;
}
