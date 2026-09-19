import * as THREE from 'three';
import { OrbitControls } from '/vendor/OrbitControls.js';

const $ = id => document.getElementById(id);
const api = async (path, options) => {
  const response = await fetch(path, options);
  const data = await response.json();
  if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail));
  return data;
};
let terrain, runId, socket, latest, selectedFrame=0, frameCount=0, playing=false, replayTimer;
let scene, renderer, camera, controls, terrainMesh, waterMesh, floodMesh, damGroup, riverGroup, debugGroup, particleMesh;
let damParts=[], projects=[], savedRuns=[], shelterGroup;
const viewport=$('viewport');
function message(text) { $('status').textContent=text; }
function scenario() {
  const values=Object.fromEntries(new FormData($('scenario')));
  for(const [key,value] of Object.entries(values)) if(!['name','project_id','breach_model','near_field'].includes(key)) values[key]=Number(value);
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
  for(let k=0;k<indices.length;k++) {
    const idx=indices[k],r=Math.floor(idx/n),c=idx%n,[x,y,z]=worldPoint(r,c,levels[k]);
    const points=[x-h,y,z-h,x-h,y,z+h,x+h,y,z-h,x+h,y,z-h,x-h,y,z+h,x+h,y,z+h];
    pos.set(points,k*18);
    const rgb=new THREE.Color(colors[k]);for(let j=0;j<6;j++)col.set([rgb.r,rgb.g,rgb.b],k*18+j*3);
  }
  mesh.geometry.setDrawRange(0,indices.length*6);mesh.geometry.attributes.position.needsUpdate=true;
  mesh.geometry.attributes.color.needsUpdate=true;mesh.geometry.computeBoundingSphere();
}
function reservoir(level) {
  const indices=[],levels=[],colors=[],n=terrain.grid_size;
  for(let r=0;r<n;r++)for(let c=0;c<n;c++)if(terrain.reservoir_mask[r][c]&&terrain.elevation[r][c]<level){indices.push(r*n+c);levels.push(level);colors.push(0x168cad);}
  fillCells(waterMesh,indices,levels,colors);
}
function disposeScene() {
  if(!scene)return;
  scene.traverse(o=>{o.geometry?.dispose();if(o.material){for(const m of [].concat(o.material)){m.map?.dispose();m.dispose();}}});
  controls?.dispose();renderer?.dispose();renderer?.domElement.remove();
}
function rebuildDam(breachWidth=0,breachDepth=0) {
  for(const part of damParts){part.geometry.dispose();part.material.dispose();damGroup.remove(part);}damParts=[];
  const p=terrain.project;if(!p.dam_length_m&&!terrain.crest_local)return;
  const a=p.downstream_bearing_deg*Math.PI/180,length=p.dam_length_m||1000,width=p.crest_width_m||6;
  const crest=p.crest_elevation_m==null?p.dam_height_m:p.crest_elevation_m-terrain.origin[2];
  const supplied=terrain.crest_local;
  const path=supplied&&supplied.length>=2?supplied.map(v=>[v[0],v[2]]):[[-Math.cos(a)*length/2,-Math.sin(a)*length/2],[Math.cos(a)*length/2,Math.sin(a)*length/2]];
  const distances=[0];for(let i=1;i<path.length;i++)distances.push(distances[i-1]+Math.hypot(path[i][0]-path[i-1][0],path[i][1]-path[i-1][1]));
  const total=distances.at(-1),positions=[],indices=[];
  for(let segment=0;segment<100;segment++){
    const mid=(segment+.5)/100*total;const breached=Math.abs(mid-total/2)<breachWidth/2;
    for(let edge=0;edge<2;edge++){
      const distance=(segment+edge)/100*total;let j=1;while(j<distances.length-1&&distances[j]<distance)j++;
      const span=distances[j]-distances[j-1],f=(distance-distances[j-1])/span;
      const x=path[j-1][0]+f*(path[j][0]-path[j-1][0]),z=path[j-1][1]+f*(path[j][1]-path[j-1][1]);
      const nx=-(path[j][1]-path[j-1][1])/span,nz=(path[j][0]-path[j-1][0])/span;
      const ground=elevationAt(x,z),top=Math.max(ground,crest-(breached?breachDepth:0));
      const base=width/2+Math.max(0,top-ground)*2;
      for(const [offset,y] of [[-base,null],[-width/2,top],[width/2,top],[base,null]]) {
        const px=x+nx*offset,pz=z+nz*offset;positions.push(px,y??elevationAt(px,pz),pz);
      }
    }
    const b=segment*8;for(let k=0;k<3;k++)indices.push(b+k,b+k+4,b+k+1,b+k+1,b+k+4,b+k+5);
  }
  const geom=new THREE.BufferGeometry();geom.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geom.setIndex(indices);geom.computeVertexNormals();
  const mesh=new THREE.Mesh(geom,new THREE.MeshStandardMaterial({color:0xa8916b,roughness:1,side:THREE.DoubleSide}));mesh.name='DEM-constrained embankment · '+terrain.reconstruction_tier;damGroup.add(mesh);damParts=[mesh];
}
function setupScene() {
  disposeScene();scene=new THREE.Scene();scene.background=new THREE.Color(0x0c1521);
  renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));viewport.appendChild(renderer.domElement);
  camera=new THREE.PerspectiveCamera(45,1,.5,200000);controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=!matchMedia('(prefers-reduced-motion: reduce)').matches;
  scene.add(new THREE.HemisphereLight(0xdceeff,0x524e3a,2));const sun=new THREE.DirectionalLight(0xffffff,2);sun.position.set(-5000,10000,3000);scene.add(sun);
  const g=gridGeometry();terrainMesh=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:0x657560,roughness:1,side:THREE.DoubleSide}));terrainMesh.name='DEM terrain';scene.add(terrainMesh);
  if(terrain.detail){const detailMesh=new THREE.Mesh(gridGeometry(true),terrainMesh.material);detailMesh.name='Near-dam source DEM';scene.add(detailMesh);}
  if(terrain.texture_url)new THREE.TextureLoader().load(terrain.texture_url,t=>{t.colorSpace=THREE.SRGBColorSpace;terrainMesh.material.map=t;terrainMesh.material.color.set(0xffffff);terrainMesh.material.needsUpdate=true;},undefined,()=>message('Supplied imagery failed to load'));
  waterMesh=cellMesh(0xffffff,.68);waterMesh.name='Reservoir: '+terrain.reservoir_geometry;scene.add(waterMesh);
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
  shelterGroup=new THREE.Group();scene.add(shelterGroup);
  cameraView();resize();$('sceneMessage').textContent=`${terrain.crs} · ${terrain.cell_size_m.toFixed(0)} m grid · 1:1 vertical scale · ${terrain.reconstruction_tier}`;
  waterMesh.visible=$('showWater').checked;riverGroup.visible=$('showRiver').checked;
  renderer.domElement.addEventListener('pointerdown',event=>{
    const box=renderer.domElement.getBoundingClientRect();const ray=new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(2*(event.clientX-box.left)/box.width-1,1-2*(event.clientY-box.top)/box.height),camera);
    const hit=ray.intersectObjects([terrainMesh,waterMesh,floodMesh,...damParts,...shelterGroup.children],false)[0];
    if(hit)$('selection').textContent=`${hit.object.name} · Easting ${(hit.point.x+terrain.origin[0]).toFixed(1)} m · Northing ${(terrain.origin[1]-hit.point.z).toFixed(1)} m · Elevation ${(hit.point.y+terrain.origin[2]).toFixed(1)} m`;
  });
}
function cameraView() {
  if(!terrain||!camera)return;const span=terrain.bounds[2]-terrain.bounds[0],height=terrain.project.dam_height_m;
  const mode=$('camera').value;
  if(mode==='dam'){camera.position.set(500,400,1000);controls.target.set(0,height/2,0);}
  else if(mode==='breach'){camera.position.set(80,65,100);controls.target.set(0,height/2,0);}
  else if(mode==='downstream'){camera.position.set(span*.15,span*.25,-span*.35);controls.target.set(0,0,-span*.25);}
  else{camera.position.set(span*.35,span*.6,span*.55);controls.target.set(0,0,0);}controls.update();
}
function resize(){if(!renderer)return;const w=viewport.clientWidth,h=viewport.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}
new ResizeObserver(resize).observe(viewport);
function animate(){requestAnimationFrame(animate);if(renderer){controls.update();renderer.render(scene,camera);}}animate();
function showFrame(frame) {
  latest=frame;selectedFrame=frame.index;$('timeline').value=frame.index;$('clock').textContent=`${frame.time_s.toFixed(1)} s`;
  const n=terrain.grid_size,field=frame.downstream,mode=$('layer').value;
  const palette=[0x34d3de,0x2882d9,0xf6ad45,0xf15d56];
  const colors=field.depth_m.map((d,k)=>{
    const v=field.velocity_ms[k],x=mode==='velocity'?v:d;
    return palette[mode==='risk'&&v>=2?3:x>=3?3:x>=1.5?2:x>=.5?1:0];
  });
  fillCells(floodMesh,field.indices,field.indices.map((i,k)=>terrain.elevation[Math.floor(i/n)][i%n]+field.depth_m[k]+.15),colors);
  reservoir(frame.reservoir.elevation_m);
  rebuildDam(frame.breach.width_m,frame.breach.depth_m);
  const a=terrain.project.downstream_bearing_deg*Math.PI/180;
  const positions=(frame.near_field.particles||[]).flatMap(([x,y])=>[x*Math.sin(a),y+frame.breach.invert_m-terrain.origin[2],-x*Math.cos(a)]);
  particleMesh.geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));particleMesh.geometry.computeBoundingSphere();
  const data=[['Reservoir level',frame.reservoir.elevation_m,'m'],['Storage',frame.reservoir.storage_m3,'m³'],['Breach width',frame.breach.width_m,'m'],['Breach discharge',frame.breach.discharge_m3s,'m³/s'],['Maximum depth',frame.metrics.max_depth_m,'m'],['Maximum velocity',frame.metrics.max_velocity_ms,'m/s'],['Inundated area',frame.metrics.inundated_area_km2,'km²'],['Mass residual',frame.metrics.mass_error_m3,'m³']];
  $('metrics').replaceChildren(...data.map(([label,value,unit])=>{const div=document.createElement('div');div.className='metric';const small=document.createElement('small');small.textContent=label;const b=document.createElement('b');b.textContent=`${value.toLocaleString(undefined,{maximumFractionDigits:2})} ${unit}`;div.append(small,b);return div;}));
}
async function prepare(values=scenario()) {
  message('Preparing terrain…');terrain=await api(`/api/terrain/metadata?project_id=${encodeURIComponent(values.project_id)}&grid_size=${values.grid_size}&half_width_m=${values.domain_half_width_m}`);
  setupScene();$('provenance').textContent=JSON.stringify({source:terrain.source,assumptions:terrain.project.assumptions,reservoir:terrain.reservoir_geometry,imagery:terrain.imagery},null,2);message('Ready. Configure a scenario and run.');
}
function setBusy(busy){$('start').disabled=busy;$('stop').disabled=!busy;$('project').disabled=busy;}
function connect(id) {
  socket?.close();socket=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}/ws/simulation/${id}`);
  socket.onmessage=async event=>{
    const msg=JSON.parse(event.data);
    if(msg.type==='simulation_frame'){frameCount=msg.index+1;$('timeline').max=msg.index;$('progress').value=msg.progress;showFrame(msg);message(`Running · ${(msg.progress*100).toFixed(0)}% · ${msg.time_s.toFixed(0)} s`);}
    if(msg.type==='simulation_progress')message(`${msg.status} · ${(msg.progress*100).toFixed(0)}%`);
    if(msg.type==='simulation_complete'){setBusy(false);$('play').disabled=false;$('reset').disabled=false;message('Complete. Replay and GIS exports ready.');await refresh();await evidence();}
    if(msg.type==='simulation_error'){setBusy(false);message(`${msg.status||'FAILED'}: ${msg.error}`);}
  };
  socket.onerror=()=>message('Stream disconnected. Stored frames remain available; check run status.');
  socket.onclose=async()=>{try{const state=await api('/api/simulation/status');if(['RUNNING','PREPARING','INITIALIZING','POSTPROCESSING'].includes(state.status))message('Stream closed; solver continues. Cancel or reload completed replay.');else setBusy(false);}catch{setBusy(false);}};
}
$('scenario').addEventListener('submit',async event=>{event.preventDefault();try{const values=scenario();setBusy(true);playing=false;clearTimeout(replayTimer);await prepare(values);const run=await api('/api/simulation/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(values)});runId=run.simulation_id;frameCount=0;connect(runId);}catch(error){setBusy(false);message(error.message);}});
$('stop').onclick=async()=>{try{await api('/api/simulation/stop',{method:'POST'});message('Cancellation requested…');}catch(error){message(error.message);}};
$('project').onchange=()=>prepare().catch(e=>message(e.message));$('camera').onchange=cameraView;
$('layer').onchange=()=>{const mode=$('layer').value;$('legend').textContent=mode==='risk'?'Project thresholds: LOW / MODERATE ≥0.5 m / HIGH ≥1.5 m / VERY HIGH ≥3 m or ≥2 m/s':`${mode==='depth'?'Depth (m)':'Velocity (m/s)'}: cyan <0.5 · blue 0.5–1.5 · amber 1.5–3 · red ≥3`;if(latest)showFrame(latest);};
$('showWater').onchange=()=>{if(waterMesh)waterMesh.visible=$('showWater').checked;};$('showRiver').onchange=()=>{if(riverGroup)riverGroup.visible=$('showRiver').checked;};$('debug').onchange=()=>{if(debugGroup)debugGroup.visible=$('debug').checked;};
async function seek(index){if(!runId)return;showFrame(await api(`/api/simulation/results/${runId}/frames/${index}`));}
$('timeline').oninput=()=>{playing=false;clearTimeout(replayTimer);$('play').textContent='Play replay';seek(Number($('timeline').value)).catch(e=>message(e.message));};
async function replay(){if(!playing)return;await seek((selectedFrame+1)%frameCount);replayTimer=setTimeout(()=>replay().catch(e=>message(e.message)),500/Number($('speed').value));}
$('play').onclick=()=>{playing=!playing;$('play').textContent=playing?'Pause replay':'Play replay';if(playing)replay().catch(e=>message(e.message));else clearTimeout(replayTimer);};
$('reset').onclick=()=>{playing=false;clearTimeout(replayTimer);$('play').textContent='Play replay';seek(0).catch(e=>message(e.message));};
async function refresh(){savedRuns=await api('/api/simulation/results');$('runs').replaceChildren(...savedRuns.map(r=>new Option(`${r.scenario.name} · ${r.started_at.slice(0,19)}`,r.simulation_id)));$('comparison').textContent=savedRuns.slice(0,5).map(r=>`${r.scenario.name}\nPeak Q: ${r.peak_discharge_m3s.toFixed(1)} m³/s\nMax depth: ${r.metrics.max_depth_m.toFixed(2)} m\nArea: ${r.metrics.inundated_area_km2.toFixed(3)} km²\nMass residual: ${r.mass_error_percent.toExponential(2)}%`).join('\n\n')||'No completed runs yet.';}
async function evidence(){const data=await api(`/api/shelters?simulation_id=${runId}`);$('shelters').textContent=data.status;shelterGroup.clear();for(const f of data.features){const p=document.createElement('p');p.textContent=`${f.properties.name}: ${f.properties.covered_by_model?(f.properties.outside_simulated_inundation?'outside simulated flood; candidate only':'exposed to simulated flood'):'outside model domain'}`;$('shelters').append(p);if(f.properties.covered_by_model){const marker=new THREE.Mesh(new THREE.ConeGeometry(25,70,6),new THREE.MeshBasicMaterial({color:f.properties.outside_simulated_inundation?0x72e7ae:0xf15d56}));marker.position.set(f.properties.local_x_m,f.properties.elevation_m-terrain.origin[2]+35,f.properties.local_z_m);marker.name=p.textContent;shelterGroup.add(marker);}}shelterGroup.visible=$('showShelters').checked;$('export').hidden=false;$('export').href=`/api/export/${runId}`;}
$('showShelters').onchange=()=>{if(shelterGroup)shelterGroup.visible=$('showShelters').checked;};
$('liveLayer').onclick=()=>{if(latest)showFrame(latest);$('layer').dispatchEvent(new Event('change'));};
$('arrival').onclick=async()=>{try{if(!runId)throw new Error('Complete or load a run first');playing=false;clearTimeout(replayTimer);const fields=await api(`/api/simulation/results/${runId}/fields`);const ids=[],levels=[],colors=[],n=terrain.grid_size;fields.arrival_time.forEach((t,i)=>{if(t>=0){ids.push(i);levels.push(terrain.elevation[Math.floor(i/n)][i%n]+fields.depth_max[i]+.15);colors.push(t<300?0xf15d56:t<900?0xf6ad45:t<1800?0x2882d9:0x34d3de);}});fillCells(floodMesh,ids,levels,colors);$('legend').textContent='Arrival: red <5 min · amber 5–15 min · blue 15–30 min · cyan ≥30 min; only simulated wet cells';}catch(e){message(e.message);}};
$('refresh').onclick=()=>refresh().catch(e=>message(e.message));
$('load').onclick=async()=>{try{const r=savedRuns.find(r=>r.simulation_id===$('runs').value);if(!r)return;playing=false;clearTimeout(replayTimer);runId=r.simulation_id;frameCount=r.frame_count;await prepare(r.scenario);$('timeline').max=frameCount-1;await seek(0);$('play').disabled=false;$('reset').disabled=false;await evidence();message('Stored replay loaded; no solver rerun.');}catch(e){message(e.message);}};
try{const health=await api('/api/health');$('health').textContent='Backend connected · protocol v1';$('services').textContent=JSON.stringify(health.optional,null,2);projects=await api('/api/project');$('project').replaceChildren(...projects.map(p=>new Option(p.dam_name,p.dam_id)));await prepare();await refresh();}catch(error){message(error.message);$('sceneMessage').textContent=error.message;}
