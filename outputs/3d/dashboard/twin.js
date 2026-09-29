import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { Water } from 'three/addons/objects/Water.js';
import {DamAssetLoader,DamDeformer,Diagnostics,ForecastLayer,HydraulicEffects,QualityManager,ReplayClock,SceneDirector,TelemetryPanel} from './replay-modules.js';
import {FlowSheet,MaterialLibrary,ReplaySeriesChart,buildDamAssembly,createSkyDome,disposeDamScene} from './dam-scene.js';
import {DamScenePlugin,fitReferenceGeometry} from './dam-scene-plugin.js';
import {studyShorelineSource,waterSurfacePositions} from './water-surface.js';
import {clipReservoirAtDam,foundationHeight,toDamLocal,gateSlabInterval} from './scene-physics.js';
import {fullReservoirLevel} from './gate-aperture.js';

const $ = id => document.getElementById(id);
const api = async (path, options) => {
  const response = await fetch(path, options);
  const data = await response.json();
  if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail));
  return data;
};
let terrain, assetManifest, runId, socket, latest, selectedFrame=0, frameCount=0, playing=false, replayTimer;
let scene, renderer, camera, controls, terrainMesh, detailTerrainMesh, waterMesh, engineeringWater, floodMesh, damGroup, riverGroup, debugGroup, particleMesh, flowGroup,skyDome;
let breachJet, spillwayJet, overtoppingJet;
let damParts=[], imageryMeshes=[], projects=[], savedRuns=[], shelterGroup,currentForecast,materialLibrary,sceneMaterials,damAssembly;
let studyManifest,studyPlugin,studyAssembly,studyFit,studyWaterSource,baseAssetStatus='';
let displayedBreachWidth=0,displayedWaterLevel=null;
let foundationSite=null,previewActive=true,previewLevelInfo=null,solverBusy=false;
let quality,director,deformer,effects,diagnostics,cameraGoal,targetGoal,lastAnimationTime=performance.now();
const replayClock=new ReplayClock();
const telemetry=new TelemetryPanel($('metrics'));
const forecastLayer=new ForecastLayer($('forecastChart'),$('forecastSummary'));
const replaySeries=new ReplaySeriesChart($('historyChart'),$('historySummary'));
const viewport=$('viewport');
function message(text) { $('status').textContent=text; }
function scenario() {
  const values=Object.fromEntries(new FormData($('scenario')));
  for(const [key,value] of Object.entries(values)) {
    if(value===''||value==null){delete values[key];continue;}
    if(key==='gate_schedule'){values[key]=value.trim()?JSON.parse(value):[];continue;}
    if(!['name','project_id','breach_model','breach_initiation','near_field'].includes(key)) values[key]=Number(value);
  }
  return values;
}
function worldPoint(row,col,height) {
  const b=terrain.bounds, n=terrain.grid_size, o=terrain.origin;
  return [(b[0]+(col+.5)*(b[2]-b[0])/n)-o[0],height-o[2],o[1]-(b[3]-(row+.5)*(b[3]-b[1])/n)];
}
function elevationAt(x,z) {
  const source=terrain.detail&&Math.abs(x)<1000&&Math.abs(z)<1000?terrain.detail:terrain;
  const b=source.bounds,n=source.grid_size,o=terrain.origin;
  const c=Math.min(n-1,Math.max(0,Math.floor((x+o[0]-b[0])/source.cell_size_m)));
  const r=Math.min(n-1,Math.max(0,Math.floor((z-o[1]+b[3])/source.cell_size_m)));
  return source.elevation[r][c]-o[2];
}
function gridGeometry(detail=false) {
  const original=terrain;if(detail)terrain={...terrain,...terrain.detail};
  const n=terrain.grid_size,positions=[],uv=[],indices=[];
  for(let r=0;r<n;r++) for(let c=0;c<n;c++) {
    const vertex=worldPoint(r,c,terrain.elevation[r][c]);positions.push(...vertex);
    const bounds=original.bounds;uv.push((vertex[0]+original.origin[0]-bounds[0])/(bounds[2]-bounds[0]),(original.origin[1]-vertex[2]-bounds[1])/(bounds[3]-bounds[1]));
    const pt=worldPoint(r,c,0),withinDetail=!detail&&original.detail&&Math.abs(pt[0])<1000-terrain.cell_size_m&&Math.abs(pt[2])<1000-terrain.cell_size_m;
    if(!withinDetail&&r<n-1&&c<n-1&&terrain.valid[r][c]&&terrain.valid[r+1][c]&&terrain.valid[r][c+1]&&terrain.valid[r+1][c+1]) {
      const a=r*n+c; indices.push(a,a+n,a+1,a+1,a+n,a+n+1);
    }
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();terrain=original;return g;
}
function fittedTerrainGeometry(base,site){
  const source=base.index?base.toNonIndexed():base.clone(),p=source.attributes.position,uv=source.attributes.uv;
  const positions=[],texcoords=[];
  const add=v=>{positions.push(v[0],foundationHeight(v[0],v[2],v[1],site),v[2]);texcoords.push(v[3],v[4]);};
  const mid=(a,b)=>a.map((v,i)=>(v+b[i])/2);
  const triangle=(a,b,c,depth)=>{if(!depth){add(a);add(b);add(c);return;}const ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);triangle(a,ab,ca,depth-1);triangle(ab,b,bc,depth-1);triangle(ca,bc,c,depth-1);triangle(ab,bc,ca,depth-1);};
  for(let i=0;i<p.count;i+=3){
    const vertices=[0,1,2].map(j=>[p.getX(i+j),p.getY(i+j),p.getZ(i+j),uv.getX(i+j),uv.getY(i+j)]);
    const near=vertices.some(v=>{const q=toDamLocal(v[0],v[2],site.angle);return Math.abs(q.x)<site.halfWidth+site.margin+150&&q.z>site.upstream-site.margin-150&&q.z<site.downstream+site.margin+150;});
    triangle(...vertices,near?2:0);
  }
  source.dispose();const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(texcoords,2));geometry.computeVertexNormals();return geometry;
}
function applyFoundation(active){
  for(const mesh of [terrainMesh,detailTerrainMesh,...imageryMeshes].filter(Boolean)){
    mesh.userData.uncutGeometry??=mesh.geometry;
    if(active&&foundationSite)mesh.userData.fittedGeometry??=fittedTerrainGeometry(mesh.userData.uncutGeometry,foundationSite);
    mesh.geometry=active&&foundationSite?mesh.userData.fittedGeometry:mesh.userData.uncutGeometry;
  }
}
function cellMesh(color,opacity) {
  const n=terrain.grid_size,g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(n*n*18),3));
  g.setAttribute('color',new THREE.BufferAttribute(new Float32Array(n*n*18),3));
  g.setDrawRange(0,0);
  return new THREE.Mesh(g,new THREE.MeshBasicMaterial({color,vertexColors:true,transparent:true,opacity,side:THREE.DoubleSide,depthWrite:false}));
}
function fillCells(mesh,indices,levels,colors) {
  const pos=mesh.geometry.attributes.position.array,col=mesh.geometry.attributes.color.array;
  const h=terrain.cell_size_m*.5,n=terrain.grid_size;
  const cells=[];
  for(let k=0;k<indices.length;k++){
    const idx=indices[k],r=Math.floor(idx/n),c=idx%n;
    if(idx>=0&&idx<n*n&&terrain.valid[r]?.[c]&&Number.isFinite(levels[k]))cells.push([idx,levels[k],colors[k]]);
  }
  for(let k=0;k<cells.length;k++) {
    const [idx,level,color]=cells[k],r=Math.floor(idx/n),c=idx%n,[x,y,z]=worldPoint(r,c,level);
    const points=[x-h,y,z-h,x-h,y,z+h,x+h,y,z-h,x+h,y,z-h,x-h,y,z+h,x+h,y,z+h];
    pos.set(points,k*18);
    const rgb=new THREE.Color(color);for(let j=0;j<6;j++)col.set([rgb.r,rgb.g,rgb.b],k*18+j*3);
  }
  mesh.geometry.setDrawRange(0,cells.length*6);mesh.geometry.attributes.position.needsUpdate=true;
  mesh.geometry.attributes.color.needsUpdate=true;mesh.geometry.computeBoundingSphere();
}
function makeWaterNormals() {
  // Tiled multi-scale waves give Water's reflection shader a moving normal field.
  // This is a visual effect; gravity and downstream discharge come from the solver.
  const size=128,data=new Uint8Array(size*size*3);
  const height=(x,y)=>Math.sin((x*.035+y*.011)*Math.PI*2)*.45
    +Math.sin((x*-.012+y*.052)*Math.PI*2)*.24
    +Math.sin((x*.077-y*.069)*Math.PI*2)*.09;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const slopeX=(height(x+1,y)-height(x-1,y))*.5;
    const slopeY=(height(x,y+1)-height(x,y-1))*.5;
    const normal=new THREE.Vector3(-slopeX,-slopeY,1).normalize();
    const i=(y*size+x)*3;
    data[i]=Math.round((normal.x*.5+.5)*255);
    data[i+1]=Math.round((normal.y*.5+.5)*255);
    data[i+2]=Math.round((normal.z*.5+.5)*255);
  }
  const texture=new THREE.DataTexture(data,size,size,THREE.RGBFormat);
  texture.wrapS=THREE.RepeatWrapping;texture.wrapT=THREE.RepeatWrapping;texture.needsUpdate=true;
  return texture;
}
function waterSurface(source,name) {
  const geometry=new THREE.BufferGeometry();
  const water=new Water(geometry,{textureWidth:1024,textureHeight:1024,waterNormals:makeWaterNormals(),sunDirection:new THREE.Vector3(-0.4,0.8,0.25).normalize(),sunColor:0xffffff,waterColor:0x2d7f88,distortionScale:3.2,fog:true,alpha:.88});
  // Water's reflection camera assumes a local +Z surface normal.
  water.rotation.x=-Math.PI/2;
  water.userData.shorelineSource=source;
  water.name=name;
  return water;
}
function reservoir(level) {
  const detailSource=studyPlugin?.root.visible&&studyWaterSource
    ?studyWaterSource:engineeringWater?.userData.shorelineSource;
  if(displayedWaterLevel===level&&waterMesh?.geometry.attributes.position
    &&engineeringWater?.geometry.attributes.position
    &&engineeringWater.userData.activeShorelineSource===detailSource)return;
  displayedWaterLevel=level;
  for(const mesh of [waterMesh,engineeringWater])if(mesh){
    const source=mesh===engineeringWater?detailSource:mesh.userData.shorelineSource;
    const active=studyPlugin?.root.visible;
    const angle=active?studyPlugin.root.rotation.y:Math.PI-terrain.project.downstream_bearing_deg*Math.PI/180;
    const crest=terrain.project.crest_elevation_m??terrain.origin[2]+terrain.project.dam_height_m;
    const bankFace=-(damAssembly?.crestWidth??6)/2-Math.max(0,crest-level)*2.5;
    const upstream=active?-studyPlugin.geometry.deck_width_m:bankFace;
    const positions=clipReservoirAtDam(waterSurfacePositions(source,terrain.origin,level),{angle,upstream,halfWidth:active?studyPlugin.width/2:Infinity,sideUpstream:bankFace});
    for(let i=0;i<positions.length;i+=3){positions[i+1]=-positions[i+2];positions[i+2]=0;}
    mesh.geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
    mesh.geometry.computeBoundingSphere();
    mesh.position.y=level-terrain.origin[2];
    mesh.userData.activeShorelineSource=source;
  }
}
function disposeScene() {
  if(!scene)return;
  studyPlugin?.dispose();studyPlugin=null;studyAssembly=null;studyFit=null;studyWaterSource=null;
  disposeDamScene(damAssembly,materialLibrary);damAssembly=null;materialLibrary=null;sceneMaterials=null;
  for(const sheet of [breachJet,spillwayJet,overtoppingJet])sheet?.dispose?.();
  scene.traverse(o=>{o.geometry?.dispose();if(o.material){for(const m of [].concat(o.material)){m.map?.dispose();m.dispose();}}});
  controls?.dispose();renderer?.dispose();renderer?.domElement.remove();
}
function rebuildDam(breachWidth=0,breachDepth=0,breachTopWidth=breachWidth,stressRatio=0) {
  if(deformer){
    deformer.apply({width_m:breachWidth,depth_m:breachDepth,top_width_m:breachTopWidth});
    for(const material of [].concat(deformer.mesh.material))material.emissive?.copy(new THREE.Color(0x000000).lerp(new THREE.Color(0x4a1008),Math.min(Math.max(stressRatio,0),1)*.55));
    return;
  }
  damAssembly=buildDamAssembly({terrain,manifest:assetManifest,elevationAt,materials:sceneMaterials});
  damGroup.add(damAssembly.group);damParts=damAssembly.pickables;deformer=new DamDeformer(damAssembly.deformMeshes);
  const check=damAssembly.dimensionCheck,status=damAssembly.structureStatus==='approved'?'approved hydraulic structures':'hydraulic structures unavailable';
  const visibleHeight=damAssembly.crest-elevationAt(0,0);
  const heightGap=Math.abs(visibleHeight-terrain.project.dam_height_m);
  baseAssetStatus=`${assetManifest.reconstruction_label} · parametric dam · ${check.path_length_m.toFixed(0)} m crest path · ${visibleHeight.toFixed(1)} m above DEM at site / ${terrain.project.dam_height_m.toFixed(1)} m reported height · ${status}`;
  $('assetStatus').textContent=baseAssetStatus;
  $('assetStatus').className=`scene-chip ${check.status==='pass'&&heightGap<=2?'ok':'warning'}`;
}
function showStudy(breachWidth=displayedBreachWidth){
  displayedBreachWidth=breachWidth;
  const active=Boolean(studyPlugin&&$('showStudy').checked&&(previewActive||breachWidth<=0));
  if(studyPlugin)studyPlugin.root.visible=active;
  if(studyAssembly)studyAssembly.group.visible=active;
  if(damAssembly)damAssembly.group.visible=!active;
  applyFoundation(active);
  $('studyWarning').hidden=!active;
  if(active)$('assetStatus').textContent=`Reconstructed study · ${studyPlugin.width.toFixed(0)} m wide · foundation ${studyFit.groundElevationM.toFixed(2)} m · sill ${(studyFit.groundElevationM+studyPlugin.geometry.height_m).toFixed(2)} m · deck ${studyFit.crestElevationM.toFixed(2)} m · local schematic excavation`;
  else if(damAssembly)$('assetStatus').textContent=baseAssetStatus;
}
function condition(){
  return {state:$('breachedState').getAttribute('aria-pressed')==='true'?'breached':'intact',
    type:$('damageType').value,gateIndex:Number($('affectedGate').value),failedGateCount:Number($('failedCount').value),
    holeWidthM:Number($('holeWidth').value),holeHeightM:Number($('holeHeight').value),
    leakOpeningMm:Number($('crackOpening').value),gateOpeningM:Number($('gateOpening').value)};
}
function configureConditionControls(){
  if(!studyPlugin)return;
  $('affectedGate').replaceChildren(...[...studyPlugin.gates.keys()].map((key,i)=>new Option(`Gate ${i+1}`,String(i+1))));
  const g=studyPlugin.geometry;
  $('gateOpening').max=g.gate_height_m;$('holeHeight').max=g.gate_height_m-.7;$('holeWidth').max=g.bay_width_m-.7;
  $('failedCount').max=g.bays;
}
function applyConditionPreview(){
  const c=condition(),g=studyPlugin?.geometry;
  $('breachFields').disabled=c.state==='intact';
  $('breachFields').hidden=c.state==='intact';
  $('holeWidthControl').hidden=c.type==='full';$('holeHeightControl').hidden=c.type!=='partial';
  $('crackControl').hidden=c.type!=='crack';$('failedCountControl').hidden=c.type!=='full';
  if(g){$('failedCount').max=g.bays-c.gateIndex+1;c.failedGateCount=Math.min(c.failedGateCount,Number($('failedCount').max));$('failedCount').value=c.failedGateCount;}
  $('holeWidthValue').textContent=`${c.holeWidthM.toFixed(1)} m`;$('holeHeightValue').textContent=`${c.holeHeightM.toFixed(1)} m`;
  $('crackOpeningValue').textContent=`${c.leakOpeningMm} mm`;$('failedCountValue').textContent=String(c.failedGateCount);
  $('gateOpeningValue').textContent=c.gateOpeningM?`${c.gateOpeningM.toFixed(1)} m`:'0.0 m · closed';
  if(!studyPlugin)return;
  playing=false;clearTimeout(replayTimer);previewActive=true;$('showStudy').checked=true;
  previewLevelInfo=fullReservoirLevel({...terrain.project,crest_elevation_m:terrain.project.crest_elevation_m??terrain.origin[2]+terrain.project.dam_height_m});
  showStudy(0);rebuildDam(0,0);displayedWaterLevel=null;reservoir(previewLevelInfo.level);
  for(const jet of [breachJet,spillwayJet,overtoppingJet])if(jet)jet.mesh.visible=false;
  floodMesh?.geometry.setDrawRange(0,0);
  if(particleMesh)particleMesh.geometry.setDrawRange(0,0);
  studyPlugin.setCondition(c,previewLevelInfo.level-terrain.origin[2]);
  $('reservoirLevel').textContent=`Full reservoir · ${previewLevelInfo.level.toFixed(2)} m`;
  $('reservoirLevel').title=previewLevelInfo.source;
  $('conditionMode').textContent='Interactive architectural preview';
  $('timeRegion').textContent='PREVIEW';$('timeRegion').className='time-region';
  updateVisualControls();
  applyViewVisibility();
  viewport.classList.remove('forecast-state');
}
function updateVisualControls(){
  if(!studyPlugin||!previewActive)return;
  const state=studyPlugin.simulationState,q=studyPlugin.previewRelease??0;
  $('previewStart').disabled=solverBusy||state==='running';$('previewStart').textContent=state==='paused'?'Resume simulation':'Start visual simulation';
  $('previewPause').disabled=solverBusy||state!=='running';$('previewReset').disabled=solverBusy||state==='ready';
  $('visualClock').textContent=`${studyPlugin.time.toFixed(1)} s`;$('visualState').textContent=state.toUpperCase();
  $('previewFlow').textContent=`${q.toFixed(2)} m³/s`;
  $('releaseStatus').textContent=state==='ready'?'Ready · no release until Start':state==='paused'?'Paused · water and clock frozen':q>0?'Running · release advancing downstream':'Running · intact dam, no release';
  $('physicsStatus').textContent=`${state==='ready'?'Ready to start':state==='paused'?'Paused':'Visual simulation running'} · full reservoir ${previewLevelInfo.level.toFixed(2)} m · gravity 9.81 m/s² · local release ${q.toFixed(2)} m³/s`;
}
for(const [id,state] of [['intactState','intact'],['breachedState','breached']])$(id).onclick=()=>{
  $('intactState').setAttribute('aria-pressed',String(state==='intact'));$('breachedState').setAttribute('aria-pressed',String(state==='breached'));applyConditionPreview();
};
for(const id of ['damageType','affectedGate','failedCount','holeWidth','holeHeight','crackOpening','gateOpening'])$(id).addEventListener('input',applyConditionPreview);
$('resetCondition').onclick=()=>{$('intactState').setAttribute('aria-pressed','true');$('breachedState').setAttribute('aria-pressed','false');$('gateOpening').value=0;applyConditionPreview();};
$('previewStart').onclick=()=>{if(!previewActive)applyConditionPreview();studyPlugin?.startSimulation();updateVisualControls();};
$('previewPause').onclick=()=>{studyPlugin?.pauseSimulation();updateVisualControls();};
$('previewReset').onclick=()=>{studyPlugin?.resetSimulation();updateVisualControls();};
$('inspectDamage').onclick=()=>{$('camera').value='damage';cameraView();if(innerWidth<900)viewport.scrollIntoView({block:'center',behavior:quality?.noMotion?'auto':'smooth'});};
$('camera').add(new Option('Inspect selected gate','damage'));
async function installStudy(){
  if(!studyManifest||studyPlugin||!$('showStudy').checked)return;
  if(studyManifest.assets.some(asset=>asset.role==='model'))throw new Error('Authored GLB cannot be site-fitted without a surveyed transform');
  const activeRenderer=renderer;
  const crest=terrain.project.crest_elevation_m??terrain.origin[2]+terrain.project.dam_height_m;
  const ground=crest-terrain.project.dam_height_m-terrain.origin[2];
  const fit={groundElevationM:ground+terrain.origin[2],waterElevationM:terrain.initial_level_m,crestElevationM:crest,sillElevationM:terrain.project.spillway_crest_elevation_m??undefined};
  const geometry=fitReferenceGeometry(studyManifest.geometry,fit);
  const plugin=await new DamScenePlugin(renderer,{embedded:true,geometry}).load(studyManifest,`/api/dam-scene/packages/${encodeURIComponent(studyManifest.package_id)}/assets/`);
  if(renderer!==activeRenderer){plugin.dispose();return;}
  plugin.root.name='Studio architectural study · not site verified';
  plugin.root.position.set(0,ground,0);
  const path=terrain.crest_local||[];
  if(path.length>=2){
    const nearest=path.reduce((best,point,index)=>point[0]**2+point[2]**2<path[best][0]**2+path[best][2]**2?index:best,0);
    const a=path[Math.max(0,nearest-1)],b=path[Math.min(path.length-1,nearest+1)];
    let angle=-Math.atan2(b[2]-a[2],b[0]-a[0]);
    const bearing=terrain.project.downstream_bearing_deg*Math.PI/180;
    if(Math.sin(angle)*Math.sin(bearing)-Math.cos(angle)*Math.cos(bearing)<0)angle+=Math.PI;
    plugin.root.rotation.y=angle;
  }
  plugin.setPreview(0);
  studyPlugin=plugin;
  studyFit=fit;
  foundationSite={angle:plugin.root.rotation.y,halfWidth:plugin.width/2+18,upstream:-geometry.deck_width_m-16,downstream:geometry.chute_length_m+geometry.basin_length_m+16,floor:ground-2.1,margin:35};
  studyWaterSource=studyShorelineSource(terrain.detail?.reservoir_mask?terrain.detail:terrain,terrain.origin,{widthM:plugin.width,bearingDeg:terrain.project.downstream_bearing_deg});
  studyAssembly=buildDamAssembly({terrain,manifest:assetManifest,elevationAt,materials:sceneMaterials,visualGapM:plugin.width+4});
  damGroup.add(studyAssembly.group,plugin.root);
  showStudy();displayedWaterLevel=null;reservoir(terrain.initial_level_m);configureConditionControls();applyConditionPreview();cameraView();
}
function makeFlowJet(color,name){
  const sheet=new FlowSheet(color,name);flowGroup.add(sheet.mesh);return sheet;
}
function updateFlowJet(mesh,discharge,velocity,elevation,lateral=0){
  if(!mesh)return;
  const a=terrain.project.downstream_bearing_deg*Math.PI/180;
  const direction=new THREE.Vector3(Math.sin(a),0,-Math.cos(a));
  const along=new THREE.Vector3(Math.cos(a),0,Math.sin(a));
  mesh.update({discharge,velocity,elevation:elevation??terrain.project.dam_height_m*.5,downstream:direction,along,lateral,time:performance.now(),supportAt:(x,z)=>{
    let ground=elevationAt(x,z);
    if(studyPlugin?.root.visible){
      ground=foundationHeight(x,z,ground,foundationSite);
      const p=toDamLocal(x,z,foundationSite.angle),g=studyPlugin.geometry;
      if(Math.abs(p.x)<=studyPlugin.width/2+6&&p.z>=-g.deck_width_m&&p.z<=g.chute_length_m+g.basin_length_m)
        ground=Math.max(ground,studyPlugin.root.position.y+(p.z<g.chute_length_m?studyPlugin.profile(g,p.z):0));
    }
    return ground;
  }});
}
function setupScene() {
  disposeScene();deformer=null;imageryMeshes=[];scene=new THREE.Scene();scene.background=new THREE.Color(0x0c1521);scene.fog=new THREE.Fog(0x0c1521,1200,7000);
  renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.domElement.setAttribute('role','img');renderer.domElement.setAttribute('aria-label','Interactive 1:1 scale dam and flood replay. Use the camera presets or drag to orbit and scroll to zoom.');viewport.appendChild(renderer.domElement);
  quality=new QualityManager(renderer,$('quality'));
  materialLibrary=new MaterialLibrary();sceneMaterials=materialLibrary.build();
  camera=new THREE.PerspectiveCamera(45,1,.25,200000);controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=!matchMedia('(prefers-reduced-motion: reduce)').matches;
  controls.minDistance=25;controls.maxDistance=30000;controls.maxPolarAngle=Math.PI*.49;
  skyDome=createSkyDome();scene.add(skyDome);
  scene.add(new THREE.HemisphereLight(0xdceeff,0x3f493b,1.65));const sun=new THREE.DirectionalLight(0xfff4dc,3.1);sun.position.set(-900,1300,620);sun.castShadow=quality.tier!=='low';sun.shadow.mapSize.set(quality.tier==='high'?2048:1024,quality.tier==='high'?2048:1024);sun.shadow.camera.left=-700;sun.shadow.camera.right=700;sun.shadow.camera.top=700;sun.shadow.camera.bottom=-700;sun.shadow.camera.near=10;sun.shadow.camera.far=3500;sun.shadow.bias=-.00015;scene.add(sun);
  const fill=new THREE.DirectionalLight(0x7bbbd6,.7);fill.position.set(500,350,-700);scene.add(fill);
  const g=gridGeometry();terrainMesh=new THREE.Mesh(g,sceneMaterials.terrain);terrainMesh.name='DEM terrain';terrainMesh.receiveShadow=true;scene.add(terrainMesh);
  const detailGeometry=terrain.detail?gridGeometry(true):null;
  detailTerrainMesh=detailGeometry?new THREE.Mesh(detailGeometry,sceneMaterials.terrain):null;
  if(detailTerrainMesh){detailTerrainMesh.name='Engineering terrain from near-dam DEM';detailTerrainMesh.receiveShadow=true;scene.add(detailTerrainMesh);}
  if(terrain.texture_url)new THREE.TextureLoader().load(terrain.texture_url,t=>{
    t.colorSpace=THREE.SRGBColorSpace;
    t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
    const material=new THREE.MeshStandardMaterial({map:t,color:0xffffff,roughness:1,side:THREE.DoubleSide,transparent:true,alphaTest:.02,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
    const overlay=new THREE.Mesh(g,material);overlay.name='Supplied imagery coverage';overlay.renderOrder=1;scene.add(overlay);imageryMeshes.push(overlay);
    if(detailGeometry){const detailOverlay=new THREE.Mesh(detailGeometry,material);detailOverlay.name='Supplied imagery coverage · near dam';detailOverlay.renderOrder=1;scene.add(detailOverlay);imageryMeshes.push(detailOverlay);}
    applyViewVisibility();
  },undefined,()=>message('Supplied imagery failed to load; showing DEM terrain only'));
  waterMesh=waterSurface(terrain,'Reservoir: '+terrain.reservoir_geometry);scene.add(waterMesh);
  engineeringWater=waterSurface(terrain.detail?.reservoir_mask?terrain.detail:terrain,'Simulated reservoir surface');
  engineeringWater.renderOrder=2;scene.add(engineeringWater);
  floodMesh=cellMesh(0xffffff,.8);floodMesh.name='Backend simulated flood';scene.add(floodMesh);
  reservoir(terrain.initial_level_m);
  damGroup=new THREE.Group();damParts=[];
  const p=terrain.project,height=p.dam_height_m;scene.add(damGroup);rebuildDam();
  riverGroup=new THREE.Group();
  for(const line of terrain.river_lines||[]) {
    const points=line.map(([x,z])=>new THREE.Vector3(x,elevationAt(x,z)+.4,z));
    riverGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0x5bbcd5})));
  }scene.add(riverGroup);
  debugGroup=new THREE.Group();const marker=new THREE.Mesh(new THREE.SphereGeometry(25),new THREE.MeshBasicMaterial({color:0xffdd44}));marker.position.set(0,height,0);debugGroup.add(marker);debugGroup.visible=$('debug').checked;scene.add(debugGroup);
  particleMesh=new THREE.Points(new THREE.BufferGeometry(),new THREE.PointsMaterial({color:0x9ff5ff,size:2}));scene.add(particleMesh);
  flowGroup=new THREE.Group();flowGroup.name='Hydraulic release components';scene.add(flowGroup);
  breachJet=makeFlowJet(0x54dcf2,'Simulated breach jet');
  spillwayJet=makeFlowJet(0x77a9ff,'Lumped configured spillway release');
  overtoppingJet=makeFlowJet(0xe5f5ff,'Lumped crest-overtopping release');
  shelterGroup=new THREE.Group();scene.add(shelterGroup);
  effects=new HydraulicEffects(engineeringWater,[breachJet.mesh,spillwayJet.mesh,overtoppingJet.mesh],particleMesh);
  diagnostics=new Diagnostics($('diagnostics'),quality);
  director=new SceneDirector(scene,camera,controls);
  director.register('engineering',[detailTerrainMesh,engineeringWater,damGroup,flowGroup,particleMesh]);
  director.register('overview',[terrainMesh,waterMesh,floodMesh,riverGroup,shelterGroup,...imageryMeshes]);
  director.register('diagnostic',[debugGroup]);
  cameraView();resize();
  renderer.domElement.addEventListener('pointerdown',event=>{
    const box=renderer.domElement.getBoundingClientRect();const ray=new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(2*(event.clientX-box.left)/box.width-1,1-2*(event.clientY-box.top)/box.height),camera);
    const hit=ray.intersectObjects([terrainMesh,detailTerrainMesh,waterMesh,engineeringWater,floodMesh,...damParts,studyPlugin?.root.visible?studyPlugin.root:null,...flowGroup.children,...shelterGroup.children].filter(Boolean),true)[0];
    if(hit){
      let part=hit.object,studio=false;
      while(part){if(part===studyPlugin?.root){studio=true;break;}part=part.parent;}
      const label=studio?'Studio architectural study (unverified)':hit.object.name;
      $('selection').textContent=`${label} · Easting ${(hit.point.x+terrain.origin[0]).toFixed(1)} m · Northing ${(terrain.origin[1]-hit.point.z).toFixed(1)} m · Elevation ${(hit.point.y+terrain.origin[2]).toFixed(1)} m`;
    }
  });
}
function applyViewVisibility() {
  if(!scene||!terrainMesh)return;
  const mode=$('viewMode').value,close=mode!=='overview',showWater=$('showWater').checked;
  director?.setMode(mode);
  terrainMesh.visible=!close;
  if(detailTerrainMesh)detailTerrainMesh.visible=close;
  for(const mesh of imageryMeshes)mesh.visible=!close;
  if(waterMesh)waterMesh.visible=!close&&showWater;
  if(engineeringWater)engineeringWater.visible=close&&showWater;
  if(floodMesh)floodMesh.visible=!close;
  if(riverGroup)riverGroup.visible=!close&&$('showRiver').checked;
  if(shelterGroup)shelterGroup.visible=!close;
  if(debugGroup)debugGroup.visible=mode==='diagnostic'&&$('debug').checked;
  const coverage=terrain.imagery_coverage_percent==null?'imagery unavailable':`imagery coverage ${terrain.imagery_coverage_percent.toFixed(1)}%`;
  if(close){
    scene.background.set(0x14222c);scene.fog.color.set(0x14222c);scene.fog.near=650;scene.fog.far=1800;
    $('sceneMessage').textContent=`${mode==='diagnostic'?'Diagnostic':'Engineering'} close-up · ${assetManifest?.reconstruction_label||'provenance unavailable'} · 1:1 metre units · ${previewActive?'illustrative gravity-flow preview':'diffusive-wave screening replay'}`;
  }else{
    scene.background.set(0x0c1521);scene.fog.color.set(0x0c1521);scene.fog.near=1200;scene.fog.far=7000;
    $('sceneMessage').textContent=`${terrain.crs} · ${terrain.cell_size_m.toFixed(0)} m grid · 1:1 vertical scale · ${coverage} · ${terrain.reconstruction_tier}`;
  }
}
function cameraView() {
  if(!terrain||!camera)return;const span=terrain.bounds[2]-terrain.bounds[0],height=terrain.project.dam_height_m;
  const mode=$('camera').value;
  const previousPosition=camera.position.clone(),previousTarget=controls.target.clone();
  if(mode==='damage'&&studyPlugin){
    const gate=[...studyPlugin.gates.values()][condition().gateIndex-1],g=studyPlugin.geometry;
    const y=gate.release?.elevation??g.height_m+g.gate_height_m*.3;
    studyPlugin.root.updateWorldMatrix(true,false);
    const target=studyPlugin.root.localToWorld(new THREE.Vector3(gate.x,y,1));
    const position=studyPlugin.root.localToWorld(new THREE.Vector3(gate.x+4,y+3,29));
    controls.target.copy(target);camera.position.copy(position);cameraGoal=null;targetGoal=null;
    applyViewVisibility();controls.update();return;
  }
  if(mode==='dam'||mode==='crest'){
    const box=new THREE.Box3().setFromObject(damGroup),center=box.getCenter(new THREE.Vector3());
    const extent=box.getSize(new THREE.Vector3()).length()||terrain.project.dam_length_m||1000;
    const distance=extent/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2)))*1.15;
    controls.target.copy(center);camera.position.copy(center).add(new THREE.Vector3(.25,.65,1).normalize().multiplyScalar(distance));
  }
  else if(['breach','spillway','upstream','abutment'].includes(mode)){
    const a=terrain.project.downstream_bearing_deg*Math.PI/180;
    const downstream=new THREE.Vector3(Math.sin(a),0,-Math.cos(a));
    const alongCrest=new THREE.Vector3(Math.cos(a),0,Math.sin(a));
    controls.target.set(0,height*.34,0);
    const direction=mode==='upstream'?-1:1,lateral=mode==='abutment'?(terrain.project.dam_length_m||1000)*.35:mode==='spillway'?-45:48;
    const inspectionDistance=mode==='breach'?285:220;
    camera.position.copy(controls.target).add(downstream.multiplyScalar(inspectionDistance*direction))
      .add(alongCrest.multiplyScalar(lateral));camera.position.y+=mode==='breach'?118:92;
  }
  else if(mode==='downstream'||mode==='downstream_inspection'){camera.position.set(span*.15,span*.25,-span*.35);controls.target.set(0,0,-span*.25);}
  else if(mode==='free'){applyViewVisibility();return;}
  else{camera.position.set(span*.35,span*.6,span*.55);controls.target.set(0,0,0);}
  cameraGoal=camera.position.clone();targetGoal=controls.target.clone();
  if(!quality?.noMotion){camera.position.copy(previousPosition);controls.target.copy(previousTarget);}
  applyViewVisibility();controls.update();
}
function resize(){if(!renderer)return;const w=viewport.clientWidth,h=viewport.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}
// Shared with browser QA and the diagnostic view; reports rendered geometry.
export function sceneDiagnostics(){
  if(!studyPlugin||!engineeringWater?.geometry.attributes.position)return {ready:false};
  const g=studyPlugin.geometry,p=engineeringWater.geometry.attributes.position;
  let reservoirCrossings=0,groundIntersections=0,releaseIntersections=0,debrisWaterIntersections=0,debrisGroundIntersections=0;
  for(let i=0;i<p.count;i++){
    const local=toDamLocal(p.getX(i),-p.getY(i),studyPlugin.root.rotation.y);
    if(Math.abs(local.x)<studyPlugin.width/2-.01&&local.z>-g.deck_width_m+.01)reservoirCrossings++;
  }
  const ground=detailTerrainMesh.geometry.attributes.position;
  for(let i=0;i<ground.count;i++){
    const local=toDamLocal(ground.getX(i),ground.getZ(i),studyPlugin.root.rotation.y);
    if(Math.abs(local.x)<studyPlugin.width/2&&local.z>=-g.deck_width_m&&local.z<=g.chute_length_m+g.basin_length_m
      &&ground.getY(i)>studyPlugin.root.position.y-.01)groundIntersections++;
  }
  for(const gate of studyPlugin.gates.values())if(gate.water.visible){
    const p=gate.water.geometry.attributes.position;
    for(let i=0;i<p.count;i++){
      const z=p.getZ(i),y=p.getY(i),solid=z<=g.chute_length_m?studyPlugin.profile(g,Math.max(0,z)):0;if(y<solid-.001)releaseIntersections++;
      for(const mesh of studyPlugin.debris){const hit=gateSlabInterval(p.getX(i),z,{position:mesh.position,angle:mesh.rotation.x,width:mesh.userData.width,height:g.gate_height_m});if(hit&&y>hit.bottom+.001&&y<hit.top-.001)debrisWaterIntersections++;}
    }
  }
  for(const mesh of studyPlugin.debris)for(const dy of [-g.gate_height_m/2,g.gate_height_m/2])for(const dz of [-.25,.25]){
    const c=Math.cos(mesh.rotation.x),s=Math.sin(mesh.rotation.x),y=mesh.position.y+dy*c-dz*s,z=mesh.position.z+dy*s+dz*c;
    if(y<studyPlugin.profile(g,z)-.001)debrisGroundIntersections++;
  }
  const apertures=[];studyPlugin.root.updateWorldMatrix(true,true);
  for(const [id,gate] of studyPlugin.gates)if(gate.damage){
    const source=gate.release.sources[Math.floor(gate.release.sources.length/2)];
    const origin=studyPlugin.root.localToWorld(new THREE.Vector3(gate.x+source.x,source.y,4));
    const direction=new THREE.Vector3(0,0,-1).transformDirection(studyPlugin.root.matrixWorld);
    const ray=new THREE.Raycaster(origin,direction,0,4);
    apertures.push({id,area:gate.release.area,physicalHole:ray.intersectObject(gate.damage,false).length===0});
  }
  return {ready:true,previewActive,condition:condition(),discharge:studyPlugin.previewRelease,
    simulationState:studyPlugin.simulationState,simulationTime:studyPlugin.time,apertures,
    fronts:[...studyPlugin.gates.values()].map(gate=>gate.frontDistance??0),
    reservoirCrossings,groundIntersections,releaseIntersections,debrisWaterIntersections,debrisGroundIntersections,
    gateCount:studyPlugin.gates.size,flowingGates:[...studyPlugin.gates.values()].filter(gate=>gate.water.visible).length,
    debris:studyPlugin.debris.length,foundationElevation:studyFit.groundElevationM,
    crestElevation:studyFit.crestElevationM,damHeight:terrain.project.dam_height_m,
    reservoirElevation:previewActive?previewLevelInfo?.level:displayedWaterLevel,sillElevation:studyFit.groundElevationM+g.height_m};
}
new ResizeObserver(resize).observe(viewport);
function animate(now=performance.now()){
  requestAnimationFrame(animate);if(!renderer)return;
  const elapsed=now-lastAnimationTime;lastAnimationTime=now;
  if(cameraGoal&&!quality?.noMotion){
    camera.position.lerp(cameraGoal,.1);controls.target.lerp(targetGoal,.1);
    if(camera.position.distanceTo(cameraGoal)<.05){camera.position.copy(cameraGoal);controls.target.copy(targetGoal);cameraGoal=null;}
  }
  controls.update();
  if(previewActive){studyPlugin?.advanceSimulation(document.hidden?0:elapsed/1000);updateVisualControls();}
  else if(!quality?.noMotion)effects?.animate(now,false);
  if(!quality?.noMotion){const time=previewActive?(studyPlugin?.time??0):now*.001;for(const mesh of [waterMesh,engineeringWater])if(mesh?.material?.uniforms?.time)mesh.material.uniforms.time.value=time;}
  renderer.render(scene,camera);quality?.sample(elapsed);diagnostics?.update(latest);
}animate();
function showFrame(frame) {
  previewActive=false;
  studyPlugin?.pauseSimulation();$('previewStart').disabled=solverBusy;$('previewStart').textContent='Start visual simulation';$('previewPause').disabled=true;$('previewReset').disabled=true;
  $('visualState').textContent='SAVED REPLAY';$('visualClock').textContent=`${frame.time_s.toFixed(1)} s`;
  $('reservoirLevel').textContent=`Replay reservoir · ${frame.reservoir.elevation_m.toFixed(2)} m`;$('reservoirLevel').title='Saved hydraulic model output';
  applyViewVisibility();
  $('conditionMode').textContent='Saved hydraulic replay · use a condition control to return to preview';
  $('previewFlow').textContent='—';$('releaseStatus').textContent='Replay discharge shown in telemetry';
  viewport.classList.remove('forecast-state');latest=frame;selectedFrame=frame.index;$('timeline').value=frame.index;$('clock').textContent=`${frame.time_s.toFixed(1)} s`;
  replaySeries.push(frame);
  const n=terrain.grid_size,field=frame.downstream,mode=$('layer').value;
  const palette=[0x34d3de,0x2882d9,0xf6ad45,0xf15d56];
  const colors=field.depth_m.map((d,k)=>{
    const v=field.velocity_ms[k],x=mode==='velocity'?v:d;
    return palette[mode==='risk'&&v>=2?3:x>=3?3:x>=1.5?2:x>=.5?1:0];
  });
  fillCells(floodMesh,field.indices,field.indices.map((i,k)=>terrain.elevation[Math.floor(i/n)][i%n]+field.depth_m[k]+.15),colors);
  const stressRatio=frame.breach.shear_stress_pa==null?0:frame.breach.shear_stress_pa/Math.max(frame.breach.collapse_shear_pa,1);
  rebuildDam(frame.breach.width_m,frame.breach.depth_m,frame.breach.top_width_m??frame.breach.width_m,stressRatio);
  showStudy(frame.breach.width_m);
  if(studyPlugin?.root.visible)studyPlugin.applyReplayFrame({...frame,gates:frame.spillway?.gates??frame.gates??[]});
  reservoir(frame.reservoir.elevation_m);
  updateFlowJet(breachJet,frame.breach.discharge_m3s,frame.breach.velocity_ms,frame.breach.invert_m-terrain.origin[2]);
  updateFlowJet(spillwayJet,frame.spillway?.discharge_m3s,frame.spillway?.exit_velocity_ms,(frame.spillway?.crest_elevation_m??terrain.origin[2])-terrain.origin[2],-45);
  updateFlowJet(overtoppingJet,frame.overtopping?.discharge_m3s,Math.sqrt(2*9.81*(frame.overtopping?.head_m||0)),terrain.project.dam_height_m,45);
  const a=terrain.project.downstream_bearing_deg*Math.PI/180;
  const positions=(frame.near_field.particles||[]).flatMap(([x,y])=>[x*Math.sin(a),y+frame.breach.invert_m-terrain.origin[2],-x*Math.cos(a)]);
  particleMesh.geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));particleMesh.geometry.computeBoundingSphere();
  particleMesh.geometry.setDrawRange(0,positions.length/3);
  const data=[['Reservoir level',frame.reservoir.elevation_m,'m'],['Level trend',frame.reservoir.level_change_rate_ms??0,'m/s'],['Breach width',frame.breach.width_m,'m'],['Breach flow',frame.breach.discharge_m3s,'m³/s'],['Spillway flow',frame.spillway?.discharge_m3s??0,'m³/s'],['Overtopping flow',frame.overtopping?.discharge_m3s??0,'m³/s'],['Material shear',frame.breach.shear_stress_pa??0,'Pa'],['Hydraulic pressure',frame.breach.hydrostatic_pressure_pa??0,'Pa'],['Maximum depth',frame.metrics.max_depth_m,'m'],['Maximum velocity',frame.metrics.max_velocity_ms,'m/s'],['Inundated area',frame.metrics.inundated_area_km2,'km²'],['Mass residual',frame.metrics.mass_error_m3,'m³']];
  telemetry.render(data.map(item=>[...item,frame.data_status||'simulated']));
  $('timeRegion').textContent=(frame.time_region||'history').toUpperCase();
  $('timeRegion').className=`time-region ${frame.time_region||'history'}`;
  const critical=frame.breach.critical_shear_pa??0,collapse=frame.breach.collapse_shear_pa??Infinity,shear=frame.breach.shear_stress_pa;
  const resistance=shear==null?'prescribed breach geometry':shear>=collapse?'slice-collapse threshold exceeded':shear>critical?'active excess-shear erosion':'below erosion threshold';
  const spillway=frame.spillway?.configured?`${(frame.spillway.discharge_m3s||0).toFixed(1)} m³/s`:'not configured from evidence';
  const head=frame.breach.hydraulic_head_m??Math.max(frame.reservoir.elevation_m-frame.breach.invert_m,0);
  $('physicsStatus').textContent=`${frame.breach.material||'Unspecified material'} · ${resistance} · head ${head.toFixed(2)} m · breach ${frame.breach.discharge_m3s.toFixed(1)} m³/s · spillway ${spillway} · overtopping ${(frame.overtopping?.discharge_m3s||0).toFixed(1)} m³/s`;
}
async function prepare(values=scenario()) {
  message('Preparing terrain…');replaySeries.clear();latest=null;displayedBreachWidth=0;displayedWaterLevel=null;foundationSite=null;previewActive=true;
  [terrain,assetManifest]=await Promise.all([api(`/api/terrain/metadata?project_id=${encodeURIComponent(values.project_id)}&grid_size=${values.grid_size}&half_width_m=${values.domain_half_width_m}`),api(`/api/project/${encodeURIComponent(values.project_id)}/assets`)]);
  new DamAssetLoader(assetManifest).validate();
  studyManifest=await api('/api/dam-scene/packages/spillway-reference').catch(()=>null);
  if(!studyManifest?.validation?.valid)studyManifest=null;
  $('showStudy').disabled=!studyManifest;
  if(!studyManifest)$('showStudy').checked=false;
  const breachDepth=$('scenario').elements.breach_depth_m;
  if(breachDepth.dataset.userSet!=='true'){
    const p=terrain.project,crest=p.crest_elevation_m??terrain.origin[2]+p.dam_height_m;
    const level=p.initial_water_level_m??terrain.origin[2]+p.dam_height_m*.9;
    breachDepth.value=Math.min(p.dam_height_m,Math.max(.1,crest-level+Math.min(1,p.dam_height_m*.05))).toFixed(2);
  }
  setupScene();
  if(studyManifest&&$('showStudy').checked){
    try{await installStudy();}catch(error){$('showStudy').checked=false;$('showStudy').disabled=true;message(`Studio study unavailable: ${error.message}`);}
  }
  $('provenance').textContent=JSON.stringify({source:terrain.source,assumptions:terrain.project.assumptions,reservoir:terrain.reservoir_geometry,imagery:terrain.imagery,structures:assetManifest.specification,asset_manifest_hash:assetManifest.manifest_hash,studio_study:studyManifest?{package_id:studyManifest.package_id,classification:studyManifest.classification,project_id:studyManifest.project_id,assumptions:studyManifest.assumptions,site_fit:studyFit,visual_shoreline_connection:studyWaterSource?'DEM-clipped local inference, not used by solver':null}:null},null,2);message('Ready. Configure a scenario and run.');
}
$('scenario').elements.breach_depth_m.addEventListener('input',event=>{event.target.dataset.userSet='true';});
$('scenario').addEventListener('invalid',event=>event.target.closest('details')?.setAttribute('open',''),true);
function setBusy(busy){solverBusy=busy;$('start').disabled=busy;$('stop').disabled=!busy;$('project').disabled=busy;$('conditionControls').disabled=busy;if(!previewActive)$('previewStart').disabled=busy;updateVisualControls();}
function connect(id) {
  socket?.close();socket=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}/ws/simulation/${id}`);
  socket.onmessage=async event=>{
    const msg=JSON.parse(event.data);
    if(msg.type==='simulation_frame'){frameCount=msg.index+1;$('timeline').max=msg.index;$('progress').value=msg.progress;showFrame(msg);message(`Running · ${(msg.progress*100).toFixed(0)}% · ${msg.time_s.toFixed(0)} s`);}
    if(msg.type==='simulation_progress')message(`${msg.status} · ${(msg.progress*100).toFixed(0)}%`);
    if(msg.type==='simulation_complete'){setBusy(false);for(const id of ['play','reset','stepBack','stepForward','forecast'])$(id).disabled=false;message('Complete. Replay and GIS exports ready.');await refresh();await evidence();}
    if(msg.type==='simulation_error'){setBusy(false);message(`${msg.status||'FAILED'}: ${msg.error}`);}
  };
  socket.onerror=()=>message('Stream disconnected. Stored frames remain available; check run status.');
  socket.onclose=async()=>{try{const state=await api('/api/simulation/status');if(['RUNNING','PREPARING','INITIALIZING','POSTPROCESSING'].includes(state.status))message('Stream closed; solver continues. Cancel or reload completed replay.');else setBusy(false);}catch{setBusy(false);}};
}
$('scenario').addEventListener('submit',async event=>{event.preventDefault();try{const values=scenario();setBusy(true);playing=false;clearTimeout(replayTimer);await prepare(values);const run=await api('/api/simulation/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(values)});runId=run.simulation_id;frameCount=0;connect(runId);}catch(error){setBusy(false);message(error.message);}});
$('stop').onclick=async()=>{try{await api('/api/simulation/stop',{method:'POST'});message('Cancellation requested…');}catch(error){message(error.message);}};
$('project').onchange=()=>prepare().catch(e=>message(e.message));$('camera').onchange=cameraView;$('viewMode').onchange=()=>{applyViewVisibility();cameraView();};
$('layer').onchange=()=>{const mode=$('layer').value;$('legend').textContent=mode==='risk'?'Project thresholds: LOW / MODERATE ≥0.5 m / HIGH ≥1.5 m / VERY HIGH ≥3 m or ≥2 m/s':`${mode==='depth'?'Depth (m)':'Velocity (m/s)'}: cyan <0.5 · blue 0.5–1.5 · amber 1.5–3 · red ≥3`;if(latest)showFrame(latest);};
$('showWater').onchange=applyViewVisibility;$('showRiver').onchange=applyViewVisibility;$('debug').onchange=applyViewVisibility;
$('showStudy').onchange=()=>{(studyPlugin?Promise.resolve():installStudy()).then(()=>{showStudy();reservoir(displayedWaterLevel??terrain.initial_level_m);}).catch(error=>{$('showStudy').checked=false;showStudy();message(`Studio study unavailable: ${error.message}`);});};
async function seek(index){if(!runId)return;showFrame(await api(`/api/simulation/results/${runId}/frames/${index}`));}
$('timeline').oninput=()=>{playing=false;clearTimeout(replayTimer);$('play').textContent='Play replay';seek(Number($('timeline').value)).catch(e=>message(e.message));};
async function replay(){if(!playing)return;await seek((selectedFrame+1)%frameCount);replayTimer=setTimeout(()=>replay().catch(e=>message(e.message)),500/Number($('speed').value));}
$('play').onclick=()=>{playing=!playing;$('play').textContent=playing?'Pause replay':'Play replay';if(playing)replay().catch(e=>message(e.message));else clearTimeout(replayTimer);};
$('reset').onclick=()=>{playing=false;clearTimeout(replayTimer);$('play').textContent='Play replay';seek(0).catch(e=>message(e.message));};
$('stepBack').onclick=()=>{playing=false;clearTimeout(replayTimer);seek(Math.max(0,selectedFrame-1)).catch(e=>message(e.message));};
$('stepForward').onclick=()=>{playing=false;clearTimeout(replayTimer);seek(Math.min(frameCount-1,selectedFrame+1)).catch(e=>message(e.message));};
async function refresh(){savedRuns=await api('/api/simulation/results');$('runs').replaceChildren(...savedRuns.map(r=>new Option(`${r.scenario.name} · ${r.started_at.slice(0,19)}`,r.simulation_id)));$('comparison').textContent=savedRuns.slice(0,5).map(r=>`${r.scenario.name}\nPeak Q: ${r.peak_discharge_m3s.toFixed(1)} m³/s\nMax depth: ${r.metrics.max_depth_m.toFixed(2)} m\nArea: ${r.metrics.inundated_area_km2.toFixed(3)} km²\nMass residual: ${r.mass_error_percent.toExponential(2)}%`).join('\n\n')||'No completed runs yet.';}
async function evidence(){const data=await api(`/api/shelters?simulation_id=${runId}`);$('shelters').textContent=data.status;shelterGroup.clear();for(const f of data.features){const p=document.createElement('p');p.textContent=`${f.properties.name}: ${f.properties.covered_by_model?(f.properties.outside_simulated_inundation?'outside simulated flood; candidate only':'exposed to simulated flood'):'outside model domain'}`;$('shelters').append(p);if(f.properties.covered_by_model){const marker=new THREE.Mesh(new THREE.ConeGeometry(25,70,6),new THREE.MeshBasicMaterial({color:f.properties.outside_simulated_inundation?0x72e7ae:0xf15d56}));marker.position.set(f.properties.local_x_m,f.properties.elevation_m-terrain.origin[2]+35,f.properties.local_z_m);marker.name=p.textContent;shelterGroup.add(marker);}}shelterGroup.visible=$('showShelters').checked;$('export').hidden=false;$('export').href=`/api/export/${runId}`;}
$('showShelters').onchange=applyViewVisibility;
$('liveLayer').onclick=()=>{if(latest)showFrame(latest);$('layer').dispatchEvent(new Event('change'));};
$('arrival').onclick=async()=>{try{if(!runId)throw new Error('Complete or load a run first');playing=false;clearTimeout(replayTimer);const fields=await api(`/api/simulation/results/${runId}/fields`);const ids=[],levels=[],colors=[],n=terrain.grid_size;fields.arrival_time.forEach((t,i)=>{if(t>=0){ids.push(i);levels.push(terrain.elevation[Math.floor(i/n)][i%n]+fields.depth_max[i]+.15);colors.push(t<300?0xf15d56:t<900?0xf6ad45:t<1800?0x2882d9:0x34d3de);}});fillCells(floodMesh,ids,levels,colors);$('legend').textContent='Arrival: red <5 min · amber 5–15 min · blue 15–30 min · cyan ≥30 min; only simulated wet cells';}catch(e){message(e.message);}};
$('refresh').onclick=()=>refresh().catch(e=>message(e.message));
$('load').onclick=async()=>{try{const r=savedRuns.find(r=>r.simulation_id===$('runs').value);if(!r)return;playing=false;clearTimeout(replayTimer);runId=r.simulation_id;frameCount=r.frame_count;await prepare(r.scenario);$('timeline').max=frameCount-1;await seek(0);for(const id of ['play','reset','stepBack','stepForward','forecast'])$(id).disabled=false;await evidence();message('Stored replay loaded; no solver rerun.');}catch(e){message(e.message);}};
function applyForecastTrajectory(){if(!currentForecast?.bands?.length)return;const key=$('trajectory').value,row=currentForecast.bands.at(-1),record={reservoir_level_m:row.reservoir_level_m[key],breach_width_m:row.breach_width_m[key],breach_invert_m:row.breach_invert_m[key],discharge_m3s:row.discharge_m3s[key]};const crest=(terrain.project.crest_elevation_m??terrain.origin[2]+terrain.project.dam_height_m);const depth=Math.max(0,crest-record.breach_invert_m);rebuildDam(record.breach_width_m,depth,record.breach_width_m+2*(latest?.breach?.side_slope_h_per_v??1)*depth,0);showStudy(record.breach_width_m);reservoir(record.reservoir_level_m);updateFlowJet(breachJet,record.discharge_m3s,Math.sqrt(2*9.81*Math.max(record.reservoir_level_m-record.breach_invert_m,0)),record.breach_invert_m-terrain.origin[2]);$('timeRegion').textContent='FORECAST';$('timeRegion').className='time-region forecast';viewport.classList.add('forecast-state');$('physicsStatus').textContent=`Forecast ${key.toUpperCase()} at horizon · simulated ensemble trajectory · not an observation · Q ${record.discharge_m3s.toFixed(1)} m³/s`;}
$('forecast').onclick=async()=>{try{if(!runId)throw new Error('Complete or load a run first');$('forecast').disabled=true;$('forecastSummary').textContent='Running bounded physics ensemble…';currentForecast=await api(`/api/simulation/results/${runId}/forecasts`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ensemble_size:9,horizon_s:3600,seed:20260921,include_far_field:$('forecastFarField').checked})});forecastLayer.render(currentForecast);applyForecastTrajectory();}catch(e){message(e.message);$('forecastSummary').textContent=e.message;}finally{$('forecast').disabled=false;}};
$('trajectory').onchange=applyForecastTrajectory;
let researchSocket,researchReconnect;
const researchReportLink=document.createElement('a');
researchReportLink.textContent='View saved research report and source quotes';
researchReportLink.target='_blank';researchReportLink.rel='noopener';researchReportLink.hidden=true;
$('researchEvents').before(researchReportLink);
function researchEventDetail(event){
  if(event.error)return event.error;
  if(event.title)return event.title;
  if(event.source_count!=null)return `${event.source_count} source link${event.source_count===1?'':'s'} returned`;
  if(event.query)return event.query;
  if(event.source_url)return event.source_url;
  if(event.message)return event.message;
  if(event.error)return event.error;
  return '';
}
function renderResearch(state){
  const reportProject=state.project_id||$('project').value;
  researchReportLink.hidden=!reportProject;
  if(reportProject)researchReportLink.href=`/api/research/report/${encodeURIComponent(reportProject)}`;
  const status=state.status||'idle',active=['planning','running','compiling'].includes(status);
  $('researchBadge').textContent=status.toUpperCase();$('researchBadge').className=`status-badge ${status}`;
  $('researchStatus').textContent=state.error?`${state.stage||status}: ${state.error}`:(state.result?.summary||state.stage||'No research run is active.');
  $('researchElapsed').textContent=state.elapsed_s==null?'—':`${Math.floor(state.elapsed_s/60)}m ${Math.floor(state.elapsed_s%60)}s`;
  $('researchEvidence').textContent=String(state.evidence_count||0);
  $('researchQuery').textContent=state.query?`Current query: ${state.query}`:'Waiting for a search query.';
  $('startResearch').disabled=active||!$('project').value;
  if(active&&state.total_tracks)$('researchProgress').value=(state.completed_tracks||0)/state.total_tracks;
  else if(active)$('researchProgress').removeAttribute('value');
  else $('researchProgress').value=['complete','partial'].includes(status)?1:0;
  const events=(state.events||[]).slice(-10).reverse();
  $('researchEvents').replaceChildren(...events.map(event=>{
    const li=document.createElement('li'),heading=document.createElement('strong'),detail=document.createElement('span'),stamp=document.createElement('time');
    heading.textContent=event.stage||event.event;detail.textContent=researchEventDetail(event);stamp.textContent=new Date(event.timestamp).toLocaleTimeString();
    li.append(heading,detail,stamp);return li;
  }));
}
function connectResearch(){
  clearTimeout(researchReconnect);researchSocket?.close();
  researchSocket=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}/ws/research`);
  researchSocket.onmessage=event=>renderResearch(JSON.parse(event.data));
  researchSocket.onclose=()=>{researchReconnect=setTimeout(connectResearch,2000);};
}
$('startResearch').onclick=async()=>{
  try{
    $('startResearch').disabled=true;
    renderResearch(await api('/api/research/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({project_id:$('project').value})}));
  }catch(error){$('researchStatus').textContent=error.message;$('startResearch').disabled=false;}
};
connectResearch();
try{const health=await api('/api/health');$('health').textContent='Backend connected · protocol v1';$('services').textContent=JSON.stringify(health.optional,null,2);projects=await api('/api/project');$('project').replaceChildren(...projects.map(p=>new Option(p.dam_name,p.dam_id)));await prepare();await refresh();}catch(error){message(error.message);$('sceneMessage').textContent=error.message;}
