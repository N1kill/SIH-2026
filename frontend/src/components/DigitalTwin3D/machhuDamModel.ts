import * as THREE from 'three';

export interface MachhuDamModelOptions {
  damLength?: number;
  damHeight?: number;
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
  updateBreachWidth: (width: number) => void;
  updateDischarge: (q: number) => void;
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
    damLength: options.damLength || 1940,
    damHeight: options.damHeight || 22.56,
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

  const erodedSoilMat = new THREE.MeshStandardMaterial({
    map: textures.riprapTex,
    roughness: 0.9,
    color: 0x6e5239,
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

  // 2. Plunge Pool & Boiling Churn Wake Shader
  const boilUniforms = {
    uTime: { value: 0 },
    uSunDir: { value: new THREE.Vector3(0.5, 0.7, -0.4).normalize() },
    uDeepColor: { value: new THREE.Color(0x0a524a) },
    uFoamColor: { value: new THREE.Color(0xffffff) },
    uIntensity: { value: 1.0 },
  };

  const boilWaterMat = new THREE.ShaderMaterial({
    uniforms: boilUniforms,
    vertexShader: `
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vWorldPos;
      void main() {
        vUv = uv;
        vec3 pos = position;
        float d = length(uv - vec2(0.5, 0.25));
        float boil = sin(d * 30.0 - uTime * 6.5) * exp(-d * 2.8) * 0.65;
        pos.y += boil;
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
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vWorldPos;
      ${noiseGLSL}
      void main() {
        vec2 center = vec2(0.5, 0.2);
        float d = length(vUv - center);
        
        // Concentric expanding boiling waves
        float waves = sin(d * 32.0 - uTime * 6.0) * 0.5 + 0.5;
        
        // Swirling foam eddies
        vec2 uvRot = vUv - center;
        float angle = atan(uvRot.y, uvRot.x) + uTime * 1.5;
        vec2 turbUv = vec2(cos(angle), sin(angle)) * d * 8.0 + vec2(0.0, -uTime * 1.8);
        float n = fbm(turbUv);
        
        float boilFoam = smoothstep(0.35, 0.65, n * 0.7 + waves * 0.45) * exp(-d * 2.2);
        
        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        vec3 halfDir = normalize(uSunDir + viewDir);
        float spec = pow(max(dot(vNormal, halfDir), 0.0), 32.0);
        
        vec3 col = mix(uDeepColor, uFoamColor, boilFoam);
        col += vec3(spec * 0.6);
        
        float alpha = mix(0.92, 0.75, smoothstep(0.3, 0.7, d));
        gl_FragColor = vec4(col, alpha);
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
  ogeeGeo.rotateY(Math.PI / 2);
  const ogeeMesh = new THREE.Mesh(ogeeGeo, concreteMat);
  ogeeMesh.position.set(-spillwayHalfW, 0, 0);
  ogeeMesh.castShadow = true;
  ogeeMesh.receiveShadow = true;
  spillwayGroup.add(ogeeMesh);

  // 18 Concrete Piers & Tainter Radial Gates
  const piersGroup = new THREE.Group();
  const gatesGroup = new THREE.Group();
  const spillwayCascadesGroup = new THREE.Group();

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
    pierGeo.rotateY(Math.PI / 2);
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

      // Spillway active cascade water sheet
      const cascadeGeo = new THREE.PlaneGeometry(gateWidth * 0.96, pierHeight * 1.15, 6, 12);
      cascadeGeo.rotateX(Math.PI * 0.34);
      const cascadeMesh = new THREE.Mesh(cascadeGeo, cascadeWaterMat);
      cascadeMesh.position.set(gateX, pierHeight * 0.35, pierDepth * 0.45);
      spillwayCascadesGroup.add(cascadeMesh);
    }
  }
  spillwayGroup.add(piersGroup);
  spillwayGroup.add(gatesGroup);
  spillwayGroup.add(spillwayCascadesGroup);

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
    wallGeo.rotateY(Math.PI / 2);
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

  function createEmbankmentMesh(length: number, material: THREE.Material) {
    const shape = new THREE.Shape();
    shape.moveTo(-baseWidth * 0.55, 0);
    shape.lineTo(-crestRoadWidth / 2, config.damHeight);
    shape.lineTo(crestRoadWidth / 2, config.damHeight);
    shape.lineTo(baseWidth * 0.45, 0);
    shape.closePath();

    const extrudeSettings = { steps: 2, depth: length, bevelEnabled: false };
    const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geo.rotateY(Math.PI / 2);
    const mesh = new THREE.Mesh(geo, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  // Left Flank Embankment (Always intact)
  const leftFlankLength = (config.damLength - config.spillwayWidth) * 0.48;
  const leftFlankMesh = createEmbankmentMesh(leftFlankLength, riprapMat);
  leftFlankMesh.position.set(-spillwayHalfW - 2.5 - leftFlankLength, 0, 0);
  embankmentGroup.add(leftFlankMesh);

  // Intact Full Right Embankment
  const rightFlankTotalLength = (config.damLength - config.spillwayWidth) * 0.52;
  const intactRightFlankMesh = createEmbankmentMesh(rightFlankTotalLength, riprapMat);
  intactRightFlankMesh.position.set(spillwayHalfW + 2.5, 0, 0);
  intactRightFlankMesh.visible = !config.breachActive;
  embankmentGroup.add(intactRightFlankMesh);

  // Broken Right Flank Group (Only visible when breach is active)
  const brokenRightFlankGroup = new THREE.Group();
  brokenRightFlankGroup.name = 'Broken_Right_Flank';
  brokenRightFlankGroup.visible = config.breachActive;

  const breachStartX = spillwayHalfW + 2.5 + 80.0;
  let currentBreachWidth = config.breachWidth;

  const rightFlankA_Length = 80.0;
  const rightFlankA = createEmbankmentMesh(rightFlankA_Length, riprapMat);
  rightFlankA.position.set(spillwayHalfW + 2.5, 0, 0);
  brokenRightFlankGroup.add(rightFlankA);

  const rightFlankB_Length = Math.max(10, rightFlankTotalLength - rightFlankA_Length - currentBreachWidth);
  const rightFlankB = createEmbankmentMesh(rightFlankB_Length, riprapMat);
  rightFlankB.position.set(breachStartX + currentBreachWidth, 0, 0);
  brokenRightFlankGroup.add(rightFlankB);

  embankmentGroup.add(brokenRightFlankGroup);
  root.add(embankmentGroup);

  // 3. Catastrophic Breach Cavity & Violent Cataract
  const breachGroup = new THREE.Group();
  breachGroup.name = 'Breach_Gorge_And_Torrent';
  breachGroup.visible = config.breachActive;

  const breachErosionGroup = new THREE.Group();
  const erosionGeo = new THREE.BoxGeometry(8.0, config.damHeight * 0.9, baseWidth * 0.85);
  const leftErodedEdge = new THREE.Mesh(erosionGeo, erodedSoilMat);
  leftErodedEdge.position.set(breachStartX + 4.0, (config.damHeight * 0.9) / 2, 0);
  leftErodedEdge.rotation.z = 0.22;
  breachErosionGroup.add(leftErodedEdge);

  const rightErodedEdge = new THREE.Mesh(erosionGeo, erodedSoilMat);
  rightErodedEdge.position.set(breachStartX + currentBreachWidth - 4.0, (config.damHeight * 0.9) / 2, 0);
  rightErodedEdge.rotation.z = -0.22;
  breachErosionGroup.add(rightErodedEdge);
  breachGroup.add(breachErosionGroup);

  // 3D Curved Cascading Water Cataract (Curving from reservoir over eroded crest down to river)
  const cataractCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, config.damHeight * 0.88, -20.0),
    new THREE.Vector3(0, config.damHeight * 0.85, -8.0),
    new THREE.Vector3(0, config.damHeight * 0.68, 6.0),
    new THREE.Vector3(0, config.damHeight * 0.35, 24.0),
    new THREE.Vector3(0, 1.8, 50.0),
    new THREE.Vector3(0, 0.5, 80.0),
  ]);
  const curvePts = cataractCurve.getPoints(24);
  const cataractWidth = currentBreachWidth * 0.94;
  const breachCascadeGeo = new THREE.PlaneGeometry(cataractWidth, 1, 16, 24);
  const cascadePos = breachCascadeGeo.attributes.position;
  for (let row = 0; row <= 24; row++) {
    const pt = curvePts[row];
    const widthExp = 1.0 + (row / 24) * 0.35;
    for (let col = 0; col <= 16; col++) {
      const u = (col / 16 - 0.5) * cataractWidth * widthExp;
      const idx = row * 17 + col;
      const arch = Math.cos((col / 16 - 0.5) * Math.PI) * 1.8;
      cascadePos.setXYZ(idx, u, pt.y + arch, pt.z);
    }
  }
  breachCascadeGeo.computeVertexNormals();
  const breachCascadeMesh = new THREE.Mesh(breachCascadeGeo, cascadeWaterMat);
  breachCascadeMesh.position.set(breachStartX + currentBreachWidth / 2, 0, 0);
  breachGroup.add(breachCascadeMesh);

  // Plunge Pool & Boiling Churn Wake into River
  const plungePoolGeo = new THREE.PlaneGeometry(currentBreachWidth * 1.6, 95.0, 32, 32);
  plungePoolGeo.rotateX(-Math.PI / 2);
  const plungePoolMesh = new THREE.Mesh(plungePoolGeo, boilWaterMat);
  plungePoolMesh.position.set(breachStartX + currentBreachWidth / 2, 0.7, 68.0);
  breachGroup.add(plungePoolMesh);

  // Aeration Spray Mist Particles (1,200 particles)
  const particleCount = 1200;
  const particlePositions = new Float32Array(particleCount * 3);
  interface Vel {
    vx: number;
    vy: number;
    vz: number;
    baseY: number;
  }
  const particleVelocities: Vel[] = [];

  for (let i = 0; i < particleCount; i++) {
    const px = breachStartX + (Math.random() * 0.9 + 0.05) * currentBreachWidth;
    const py = Math.random() * (config.damHeight * 0.85);
    const pz = 10.0 + Math.random() * 65.0;
    particlePositions[i * 3] = px;
    particlePositions[i * 3 + 1] = py;
    particlePositions[i * 3 + 2] = pz;

    particleVelocities.push({
      vx: (Math.random() - 0.5) * 6.0,
      vy: Math.random() * 8.0 + 2.0,
      vz: Math.random() * 26.0 + 10.0,
      baseY: config.damHeight * 0.85,
    });
  }

  const particleGeo = new THREE.BufferGeometry();
  particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

  const particleMat = new THREE.PointsMaterial({
    map: textures.sprayTex,
    color: 0xffffff,
    size: 10.0,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const sprayParticles = new THREE.Points(particleGeo, particleMat);
  breachGroup.add(sprayParticles);

  root.add(breachGroup);

  // 4. Upstream Reservoir Water Expanse (Directly behind the dam wall)
  const reservoirGeo = new THREE.PlaneGeometry(config.damLength * 1.4, 900.0, 32, 32);
  reservoirGeo.rotateX(-Math.PI / 2);
  const reservoirMesh = new THREE.Mesh(reservoirGeo, reservoirWaterMat);
  reservoirMesh.position.set(0, config.damHeight * 0.85, -450.0);
  reservoirMesh.receiveShadow = true;
  root.add(reservoirMesh);

  // 5. Downstream Machhu River Channel (Spanning from spillway & breach downstream)
  const riverGeo = new THREE.PlaneGeometry(config.spillwayWidth * 1.4 + 180, 1500.0, 32, 32);
  riverGeo.rotateX(-Math.PI / 2);
  const riverMesh = new THREE.Mesh(riverGeo, riverWaterMat);
  riverMesh.position.set(50.0, 0.35, 780.0);
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

      const pos = particleGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < particleCount; i++) {
        const v = particleVelocities[i];
        pos[i * 3] += v.vx * delta;
        pos[i * 3 + 1] += v.vy * delta;
        pos[i * 3 + 2] += v.vz * delta;

        if (pos[i * 3 + 1] <= 0.5 || pos[i * 3 + 2] > 95.0) {
          pos[i * 3] = breachStartX + (Math.random() * 0.9 + 0.05) * currentBreachWidth;
          pos[i * 3 + 1] = Math.random() * 6.0 + 2.0;
          pos[i * 3 + 2] = 25.0 + Math.random() * 15.0;
        }
      }
      particleGeo.attributes.position.needsUpdate = true;

      reservoirMesh.position.y = config.damHeight * 0.85 + Math.sin(timeElapsed * 1.5) * 0.15;
      cascadeWaterMat.uniforms.uTime.value = timeElapsed;
      boilWaterMat.uniforms.uTime.value = timeElapsed;
    },

    updateBreachWidth: (newWidth: number) => {
      currentBreachWidth = Math.max(40, Math.min(320, newWidth));
      config.breachWidth = currentBreachWidth;

      rightErodedEdge.position.x = breachStartX + currentBreachWidth - 4.0;
      breachCascadeMesh.scale.x = currentBreachWidth / 156.0;
      breachCascadeMesh.position.x = breachStartX + currentBreachWidth / 2;
      plungePoolMesh.scale.x = currentBreachWidth / 156.0;
      plungePoolMesh.position.x = breachStartX + currentBreachWidth / 2;
      rightFlankB.position.x = breachStartX + currentBreachWidth;
    },

    updateDischarge: (newQ: number) => {
      config.peakDischarge = newQ;
      const ratio = Math.max(0.3, Math.min(2.5, newQ / 6647));

      cascadeWaterMat.uniforms.uIntensity.value = ratio;
      boilWaterMat.uniforms.uIntensity.value = ratio;
      particleMat.size = 2.5 * ratio;

      for (let i = 0; i < particleCount; i++) {
        particleVelocities[i].vz = (Math.random() * 22.0 + 8.0) * ratio;
      }

      riverMesh.scale.y = 0.04 * (1.0 + (ratio - 1.0) * 0.5);
    },

    updateDamHeight: (newH: number) => {
      config.damHeight = Math.max(10, Math.min(35, newH));
      root.scale.y = config.damHeight / 22.56;
    },

    setBreachActive: (active: boolean) => {
      config.breachActive = active;
      intactRightFlankMesh.visible = !active;
      brokenRightFlankGroup.visible = active;
      breachGroup.visible = active;
    },
  };

  return root;
}
