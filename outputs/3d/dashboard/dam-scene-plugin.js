import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {RGBELoader} from 'three/addons/loaders/RGBELoader.js';
import {KTX2Loader} from 'three/addons/loaders/KTX2Loader.js';
import {DRACOLoader} from 'three/addons/loaders/DRACOLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {GRAVITY,releaseProfile,gateSlabInterval,timedRelease} from './scene-physics.js';
import {gateAperture,wetAperture,apertureSources} from './gate-aperture.js';

const DECK_ABOVE_GATE_M=1.5;

// Visual reconstruction only: derive the sill and deck from configured levels.
// This changes the reference template's vertical dimensions, never the world scale.
export function fitReferenceGeometry(geometry,{groundElevationM,waterElevationM,crestElevationM,sillElevationM}){
  const sill=sillElevationM??crestElevationM-DECK_ABOVE_GATE_M-geometry.gate_height_m;
  const height=sill-groundElevationM;
  const gateHeight=crestElevationM-sill-DECK_ABOVE_GATE_M;
  if(![height,gateHeight].every(Number.isFinite)||height<=0||gateHeight<=0)
    throw new Error('Configured ground, water and crest elevations cannot fit the studio reference');
  return {...geometry,height_m:height,gate_height_m:gateHeight};
}

// Portable, metre-scale local scene. Never changes the project's georeferenced terrain.
export class DamScenePlugin {
  constructor(renderer,{embedded=false,geometry=null}={}) { this.renderer=renderer; this.embedded=embedded; this.geometry=geometry; this.root=new THREE.Group(); this.gates=new Map(); this.waters=[]; this.time=0; this.debris=[]; this.simulationState=embedded?'ready':null; }
  async load(manifest, baseURL) {
    this.manifest=manifest;
    const model=manifest.assets.find(a=>a.role==='model');
    if(model){
      this.draco=new DRACOLoader().setDecoderPath('/vendor/addons/libs/draco/gltf/');
      this.ktx=new KTX2Loader().setTranscoderPath('/vendor/addons/libs/basis/').detectSupport(this.renderer);
      const loader=new GLTFLoader().setDRACOLoader(this.draco).setKTX2Loader(this.ktx).setMeshoptDecoder(MeshoptDecoder);
      const gltf=await loader.loadAsync(baseURL+model.filename); this.root.add(gltf.scene);
      for(const b of manifest.gate_bindings){const node=gltf.scene.getObjectByName(b.node); if(!node)throw Error('Missing gate node '+b.node);this.gates.set(b.gate_id,{node,base:node.position[b.axis],axis:b.axis,max:b.maximum_opening_m});}
    } else this.assemble(this.geometry||manifest.geometry);
    this.root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
    const env=manifest.assets.find(a=>a.role==='environment');
    if(env){const hdr=await new RGBELoader().loadAsync(baseURL+env.filename);hdr.mapping=THREE.EquirectangularReflectionMapping;this.environment=hdr;}
    return this;
  }
  concrete() {
    const c=document.createElement('canvas');c.width=512;c.height=512;const ctx=c.getContext('2d');
    let seed=927;const rand=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
    ctx.fillStyle='#aaa79b';ctx.fillRect(0,0,512,512);
    for(let i=0;i<22000;i++){const v=100+rand()*90;ctx.fillStyle=`rgba(${v},${v},${v*.94},.17)`;ctx.fillRect(rand()*512,rand()*512,1+rand()*4,1+rand()*5);}
    for(let i=0;i<190;i++){ctx.fillStyle=`rgba(45,49,40,${rand()*.12})`;ctx.fillRect(rand()*512,rand()*512,rand()*9,30+rand()*250);}
    ctx.strokeStyle='rgba(45,43,38,.28)';ctx.lineWidth=2;for(let y=0;y<512;y+=128){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(512,y);ctx.stroke();}
    const map=new THREE.CanvasTexture(c);map.colorSpace=THREE.SRGBColorSpace;map.wrapS=map.wrapT=THREE.RepeatWrapping;map.repeat.set(2,3);map.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy());
    return new THREE.MeshStandardMaterial({map,bumpMap:map,bumpScale:.12,color:0xd4cbb5,roughness:.94});
  }
  box(w,h,d,x,y,z,mat,parent=this.root){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);o.position.set(x,y,z);parent.add(o);return o;}
  rod(a,b,r,mat,parent=this.root){const v=new THREE.Vector3(...b).sub(new THREE.Vector3(...a));const o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,v.length(),6),mat);o.position.copy(new THREE.Vector3(...a).add(new THREE.Vector3(...b)).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());parent.add(o);return o;}
  profile(g,z){return g.height_m*Math.pow(1-Math.min(1,Math.max(0,z/g.chute_length_m)),2.15);}
  sheet(g,x,width,material,offset=0){const positions=[],uv=[],idx=[];for(let j=0;j<=64;j++){const z=j/64*g.chute_length_m;for(let i=0;i<2;i++){positions.push(x+(i-.5)*width,this.profile(g,z)+offset,z);uv.push(i,j/64);}}for(let j=0;j<64;j++){const k=j*2;idx.push(k,k+2,k+1,k+1,k+2,k+3);}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();const mesh=new THREE.Mesh(geo,material);this.root.add(mesh);return mesh;}
  waterMaterial(flow=false){const mat=new THREE.ShaderMaterial({transparent:true,side:THREE.DoubleSide,uniforms:{time:{value:0},release:{value:.65},flow:{value:flow?1:0}},vertexShader:`varying vec2 vUv;varying vec3 world;void main(){vUv=uv;world=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`uniform float time;uniform float release;uniform float flow;varying vec2 vUv;varying vec3 world;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
      void main(){vec2 p=world.xz;float n=noise(p*.85-vec2(0,time*2.5))+noise(p*3.3+vec2(time*.8,-time*4.))*.35;float pulse=pow(.5+.5*sin((vUv.y-time)*8.+sin(vUv.x*17.)*.7),8.);float foam=flow*clamp(pulse*.7+n*.35,0.,.9);vec3 water=mix(vec3(.025,.19,.24),vec3(.13,.48,.55),n*.45);water+=pow(max(0.,sin(p.x*.7+p.y*1.1+time)*.5+.5),32.)*.07;vec3 col=mix(water,vec3(.83,.96,1.),foam);gl_FragColor=vec4(col,flow>.5?clamp(release*3.,0.,.97):.98);}`});this.waters.push(mat);return mat;}
  assemble(g){
    this.geometry=g;
    const concrete=this.concrete(),steel=new THREE.MeshStandardMaterial({color:0x343f40,metalness:.8,roughness:.4}),road=new THREE.MeshStandardMaterial({color:0x535656,roughness:1}),wet=concrete.clone();wet.color.set(0x6b746b);
    const pitch=g.bay_width_m+g.pier_width_m,W=g.bays*pitch+g.pier_width_m,H=g.height_m,L=g.chute_length_m;
    this.width=W;
    // Solid curved gravity section: profile extruded across all bays.
    const shape=new THREE.Shape();shape.moveTo(-g.deck_width_m,0);shape.lineTo(-g.deck_width_m,H);shape.lineTo(0,H);for(let j=1;j<=64;j++)shape.lineTo(j/64*L,this.profile(g,j/64*L));shape.lineTo(L,-2);shape.lineTo(-g.deck_width_m,-2);
    const geo=new THREE.ExtrudeGeometry(shape,{depth:W,bevelEnabled:false,steps:1});
    // shape X -> downstream Z, extrusion Z -> across X; shape Y stays up.
    geo.applyMatrix4(new THREE.Matrix4().set(0,0,1,-W/2,0,1,0,0,1,0,0,0,0,0,0,1));geo.computeVertexNormals();this.root.add(new THREE.Mesh(geo,concrete));
    for(let i=0;i<=g.bays;i++){
      const x=-W/2+g.pier_width_m/2+i*pitch;
      this.box(g.pier_width_m,H+g.gate_height_m+1,9,x,(H+g.gate_height_m+1)/2,1,concrete);
      const rib=new THREE.Shape();rib.moveTo(0,H+1);for(let j=1;j<=32;j++)rib.lineTo(j/32*L,this.profile(g,j/32*L)+1.4);rib.lineTo(L,0);rib.lineTo(0,0);
      const rgeo=new THREE.ExtrudeGeometry(rib,{depth:g.pier_width_m*.42,bevelEnabled:false});rgeo.applyMatrix4(new THREE.Matrix4().set(0,0,1,x-g.pier_width_m*.21,0,1,0,0,1,0,0,0,0,0,0,1));rgeo.computeVertexNormals();this.root.add(new THREE.Mesh(rgeo,concrete));
      this.box(g.pier_width_m+1,1,10,x,H+g.gate_height_m+1,1,concrete);
      this.rod([x,H+g.gate_height_m+2,1],[x,H+g.gate_height_m+7,1],.09,steel);this.rod([x,H+g.gate_height_m+7,1],[x+2,H+g.gate_height_m+7,1],.08,steel);
      this.box(.9,.2,.45,x+2,H+g.gate_height_m+6.9,1,new THREE.MeshStandardMaterial({color:0xd9dbc8,emissive:0x55513b}));
    }
    for(let i=0;i<g.bays;i++){
      const x=-W/2+g.pier_width_m+g.bay_width_m/2+i*pitch;
      const gate=new THREE.Group();gate.position.set(x,H,1);this.root.add(gate);
      this.box(g.bay_width_m-.3,g.gate_height_m,.5,0,g.gate_height_m/2,0,steel,gate);
      for(let y=1;y<g.gate_height_m;y+=1.8)this.box(g.bay_width_m,.22,.6,0,y,.4,steel,gate);
      this.rod([-g.bay_width_m/2,0,.8],[g.bay_width_m/2,g.gate_height_m,.8],.13,steel,gate);this.rod([g.bay_width_m/2,0,.8],[-g.bay_width_m/2,g.gate_height_m,.8],.13,steel,gate);
      this.gates.set('gate-'+(i+1),{node:gate,base:H,axis:'y',max:g.gate_height_m,x,width:g.bay_width_m-.3,material:steel});
      this.box(2,1.3,1.8,x,H+g.gate_height_m+2,1,steel);
      const sheet=this.sheet(g,x,g.bay_width_m-.35,this.waterMaterial(true),.13);sheet.userData.gateId='gate-'+(i+1);this.gates.get(sheet.userData.gateId).water=sheet;
      for(const side of [-1,1])this.rod([x+side*g.bay_width_m*.3,H+g.gate_height_m,1],[x+side*g.bay_width_m*.3,H+g.gate_height_m+2,1],.045,steel);
    }
    const deckY=H+g.gate_height_m+DECK_ABOVE_GATE_M;
    this.box(W+6,1,g.deck_width_m,0,deckY,-1,concrete);this.box(W+6,.08,g.deck_width_m-1,0,deckY+.55,-1,road);
    for(const z of [-1-g.deck_width_m/2,-1+g.deck_width_m/2]){for(let x=-W/2;x<=W/2;x+=2.5)this.rod([x,deckY+.5,z],[x,deckY+1.9,z],.055,steel);for(const y of [deckY+1.1,deckY+1.9])this.rod([-W/2-3,y,z],[W/2+3,y,z],.055,steel);}
    // Lower inspection catwalk and diagonal support brackets.
    this.box(W,.25,2.2,0,H*.65,12,steel);for(let x=-W/2;x<=W/2;x+=2.5){this.rod([x,H*.65,13],[x,H*.65+1.2,13],.05,steel);this.rod([x,H*.65,13],[x+2.5,H*.65+1.2,13],.035,steel);}this.rod([-W/2,H*.65+1.2,13],[W/2,H*.65+1.2,13],.06,steel);
    for(const x of [-W/2-2,W/2+2])this.box(8,H+3,12,x,(H+3)/2,-3,concrete);
    if(this.embedded){
      this.box(W+12,2,L+g.basin_length_m,0,-1,(L+g.basin_length_m)/2,wet);
      for(const x of [-W/2-2,W/2+2])this.box(4,4,L+g.basin_length_m,x,2,(L+g.basin_length_m)/2,concrete);
    }
    if(!this.embedded){
      for(const x of [-W/2-2,W/2+2])this.box(4,7,L+g.basin_length_m,x,1.5,(L+g.basin_length_m)/2,concrete);
      this.box(W+12,2,L+g.basin_length_m,0,-2,(L+g.basin_length_m)/2,wet);
      const basin=new THREE.Mesh(new THREE.PlaneGeometry(W,g.basin_length_m,1,1),this.waterMaterial());basin.rotation.x=-Math.PI/2;basin.position.set(0,.1,L+g.basin_length_m/2);this.root.add(basin);
      const reservoir=new THREE.Mesh(new THREE.PlaneGeometry(W,100),this.waterMaterial());reservoir.rotation.x=-Math.PI/2;reservoir.position.set(0,H-1,-58);this.root.add(reservoir);
      // These walls belong to the standalone studio preview, not the terrain view.
      for(const x of [-W/2-2,W/2+2])this.box(4,H+1,112,x,(H-3)/2,-53,concrete);
      this.box(W+8,H+1,4,0,(H-3)/2,-110,concrete);
    }
    const points=[];let s=13;const random=()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};for(let i=0;i<2500;i++)points.push((random()-.5)*(W-5),random()*3,L+random()*12);
    const pg=new THREE.BufferGeometry();pg.setAttribute('position',new THREE.Float32BufferAttribute(points,3));this.spray=new THREE.Points(pg,new THREE.PointsMaterial({color:0xd8e4df,size:.24,transparent:true,opacity:.25,depthWrite:false}));this.root.add(this.spray);
  }
  setPreview(openingFraction){if(!Number.isFinite(openingFraction))throw Error('Preview fraction must be finite');openingFraction=THREE.MathUtils.clamp(openingFraction,0,1);for(const gate of this.gates.values()){gate.node.visible=true;gate.node.position[gate.axis]=gate.base+openingFraction*gate.max;if(gate.water){gate.water.visible=openingFraction>0;gate.water.material.uniforms.release.value=openingFraction;}}if(this.spray)this.spray.visible=openingFraction>0;}
  setCondition(condition,waterElevation){
    const g=this.geometry;
    if(!g)return;
    this.debris.forEach(mesh=>{this.root.remove(mesh);mesh.geometry.dispose();});this.debris=[];
    this.conditionConfig={...condition};this.waterElevation=waterElevation;this.simulationState='ready';this.time=0;
    this.previewRelease=0;this.potentialRelease=0;
    let index=0;
    for(const gate of this.gates.values()){
      index++;
      if(gate.water&&!gate.replayGeometry)gate.replayGeometry=gate.water.geometry.clone();
      this.clearGateDamage(gate);
      const affected=condition.state==='breached'&&index>=condition.gateIndex
        &&index<condition.gateIndex+(condition.type==='full'?condition.failedGateCount:1);
      let width=gate.width,opening=condition.gateOpeningM,aperture={polygon:[[-width/2,0],[width/2,0],[width/2,opening],[-width/2,opening]],sources:null};
      gate.node.visible=true;gate.node.position.y=gate.base+opening;
      if(affected){
        aperture=gateAperture(condition,gate);
        width=Math.max(...aperture.polygon.map(p=>p[0]))-Math.min(...aperture.polygon.map(p=>p[0]));
        gate.node.visible=false;
        if(condition.type!=='full'){
          const shape=new THREE.Shape();shape.moveTo(-gate.width/2,0);shape.lineTo(gate.width/2,0);shape.lineTo(gate.width/2,gate.max);shape.lineTo(-gate.width/2,gate.max);shape.closePath();
          const hole=new THREE.Path();aperture.polygon.forEach(([x,y],i)=>i?hole.lineTo(x,y):hole.moveTo(x,y));hole.closePath();shape.holes.push(hole);
          const face=gate.material.clone();face.color.set(0x708780);face.metalness=.25;face.roughness=.65;
          const edge=new THREE.MeshStandardMaterial({color:0xd3a377,roughness:.8,metalness:.1});
          gate.damage=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.5,bevelEnabled:false,curveSegments:1}),[face,edge]);
          gate.damage.position.set(gate.x,gate.base,.75);gate.damage.castShadow=true;this.root.add(gate.damage);
          const outline=new THREE.BufferGeometry().setFromPoints(aperture.polygon.map(([x,y])=>new THREE.Vector3(x,y,.505)));
          gate.fracture=new THREE.LineLoop(outline,new THREE.LineBasicMaterial({color:0xf2c18e}));gate.damage.add(gate.fracture);
        }else{
          const debris=new THREE.Mesh(new THREE.BoxGeometry(gate.width,gate.max,.5),gate.material);
          debris.position.set(gate.x,gate.base+gate.max/2,3);debris.userData={start:this.time,initialY:debris.position.y,width:gate.width};debris.castShadow=true;this.root.add(debris);this.debris.push(debris);
        }
      }
      const head=Math.max(0,waterElevation-this.root.position.y-gate.base);
      const wet=wetAperture(aperture.polygon,head),velocity=Math.sqrt(2*GRAVITY*Math.max(0,head-wet.y));
      // Explicit architectural preview: ideal gravity head with a stated 0.62 orifice coefficient.
      const discharge=.62*wet.area*velocity;
      this.potentialRelease+=discharge;
      gate.aperture=affected?aperture:null;
      const sources=apertureSources(wet);
      width=sources.at(-1).x-sources[0].x;
      gate.release={width,opening:wet.area/Math.max(width,.001),velocity,discharge,elevation:gate.base+wet.y,sources:sources.map(p=>({...p,y:gate.base+p.y})),area:wet.area};
      if(!gate.tracers){const points=new THREE.BufferGeometry();points.setAttribute('position',new THREE.BufferAttribute(new Float32Array(64*3),3));gate.tracers=new THREE.Points(points,new THREE.PointsMaterial({color:0xcdfaff,size:.28,transparent:true,opacity:.85,depthWrite:false}));this.root.add(gate.tracers);}
      gate.tracers.visible=false;
      this.updateRelease(gate);
    }
    this.setReservoirLevel(waterElevation);
    if(this.spray)this.spray.visible=false;
  }
  clearGateDamage(gate){
    if(gate.fracture){gate.fracture.geometry.dispose();gate.fracture.material.dispose();gate.fracture=null;}
    if(gate.damage){this.root.remove(gate.damage);gate.damage.geometry.dispose();for(const m of [].concat(gate.damage.material))m.dispose();gate.damage=null;}
  }
  setReservoirLevel(level){
    const g=this.geometry,depth=Math.max(0,level-this.root.position.y-g.height_m),length=g.deck_width_m+.74;
    for(const gate of this.gates.values()){
      if(!gate.pool){gate.pool=new THREE.Mesh(new THREE.BoxGeometry(gate.width,1,length),new THREE.MeshPhysicalMaterial({color:0x377d89,roughness:.15,metalness:.05,transparent:true,opacity:.8}));this.root.add(gate.pool);}
      gate.pool.visible=depth>0;gate.pool.scale.y=depth;gate.pool.position.set(gate.x,g.height_m+depth/2,-g.deck_width_m+length/2);
    }
  }
  startSimulation(){if(this.simulationState==='ready'||this.simulationState==='paused')this.simulationState='running';}
  pauseSimulation(){if(this.simulationState==='running')this.simulationState='paused';}
  resetSimulation(){if(this.conditionConfig)this.setCondition(this.conditionConfig,this.waterElevation);}
  advanceSimulation(dt){if(this.simulationState!=='running')return;this.previewRelease=this.potentialRelease;this.update(this.time+Math.max(0,Math.min(dt,1)));}
  updateRelease(gate){
    if(!gate.water||!gate.release)return;
    const g=this.geometry,r=gate.release;
    gate.water.visible=r.discharge>0&&this.simulationState!=='ready'&&this.time>0;
    if(!gate.water.visible){gate.frontDistance=0;if(gate.tracers)gate.tracers.visible=false;return;}
    // Follow the concrete chute, apron and collision terrain under gravity.
    const start=1.3,length=g.chute_length_m+g.basin_length_m-start;
    const obstacles=this.debris.filter(mesh=>Math.abs(mesh.position.x-gate.x)<r.width);
    const support=z=>{
      let y=z<=g.chute_length_m?this.profile(g,Math.max(0,z)):0;
      for(const mesh of obstacles){const hit=gateSlabInterval(gate.x,z,{position:mesh.position,angle:mesh.rotation.x,width:mesh.userData.width,height:g.gate_height_m});if(hit)y=Math.max(y,hit.top);}
      return y;
    };
    const distances=Array.from({length:65},(_,i)=>i*length/64);
    // Sample every slab corner so interpolated triangles cannot cut through its edges.
    for(const mesh of obstacles)for(const dy of [-g.gate_height_m/2,g.gate_height_m/2])for(const dz of [-.25,.25]){
      const d=mesh.position.z+dy*Math.sin(mesh.rotation.x)+dz*Math.cos(mesh.rotation.x)-start;
      for(const offset of [-.01,0,.01])if(d+offset>0&&d+offset<length)distances.push(d+offset);
    }
    distances.sort((a,b)=>a-b);
    const path=releaseProfile({elevation:r.elevation,speed:r.velocity,length,segments:64,distances,supportAt:d=>support(start+d),thickness:Math.min(.12,r.opening*.15)});
    const profile=timedRelease(path,this.time),lanes=r.sources.length;
    gate.frontDistance=profile.at(-1)?.distance??0;
    if(gate.water.geometry.attributes.position.count!==profile.length*lanes){
      gate.water.geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(profile.length*lanes*3),3));
      gate.water.geometry.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(profile.length*lanes*2),2));
      const indices=[];for(let j=0;j<profile.length-1;j++)for(let i=0;i<lanes-1;i++){const a=j*lanes+i;indices.push(a,a+lanes,a+1,a+1,a+lanes,a+lanes+1);}gate.water.geometry.setIndex(indices);
      gate.water.geometry.deleteAttribute('normal');
    }
    const pos=gate.water.geometry.attributes.position,uv=gate.water.geometry.attributes.uv;
    profile.forEach((point,j)=>r.sources.forEach((source,i)=>{
      const y=Math.max(support(start+point.distance)+.001,point.y+(source.y-r.elevation)*Math.max(0,1-point.distance/10));
      pos.setXYZ(j*lanes+i,gate.x+source.x,y,start+point.distance);uv.setXY(j*lanes+i,i/(lanes-1),point.arrival);
    }));uv.needsUpdate=true;
    gate.water.geometry.setDrawRange(0,Math.max(0,profile.length-1)*(lanes-1)*6);
    pos.needsUpdate=true;gate.water.geometry.computeVertexNormals();gate.water.geometry.computeBoundingSphere();
    gate.water.material.uniforms.release.value=Math.min(1,.35+r.opening);
    if(gate.tracers&&profile.length>1){
      const points=gate.tracers.geometry.attributes.position,life=profile.at(-1).arrival;
      for(let i=0;i<points.count;i++){
        const age=(this.time+i*.173)%Math.max(.01,life);let j=1;while(j<profile.length-1&&profile[j].arrival<age)j++;
        const a=profile[j-1],b=profile[j],f=(age-a.arrival)/Math.max(.0001,b.arrival-a.arrival),z=start+a.distance+(b.distance-a.distance)*f;
        const lane=(.5+Math.sin(i*7.13)*.48)*(lanes-1),left=Math.floor(lane),mix=lane-left;
        const sourceX=r.sources[left].x+(r.sources[left+1].x-r.sources[left].x)*mix,sourceY=r.sources[left].y+(r.sources[left+1].y-r.sources[left].y)*mix;
        points.setXYZ(i,gate.x+sourceX,Math.max(support(z),a.y+(b.y-a.y)*f+(sourceY-r.elevation)*Math.max(0,1-(z-start)/10))+.045,z);
      }
      points.needsUpdate=true;gate.tracers.geometry.computeBoundingSphere();gate.tracers.visible=true;
    }
  }
  applyReplayFrame(frame){
    // Callers must supply explicit per-gate states. No inference from aggregate discharge.
    if(!Number.isFinite(frame.time_s))throw Error('Replay time_s must be finite');
    this.simulationState='replay';this.previewRelease=0;
    this.debris.forEach(mesh=>{this.root.remove(mesh);mesh.geometry.dispose();});this.debris=[];
    for(const gate of this.gates.values()){
      this.clearGateDamage(gate);if(gate.tracers)gate.tracers.visible=false;if(gate.pool)gate.pool.visible=false;
      if(gate.replayGeometry){gate.water.geometry.dispose();gate.water.geometry=gate.replayGeometry;gate.replayGeometry=null;}
      gate.release=null;gate.node.visible=true;gate.node.position[gate.axis]=gate.base;if(gate.water)gate.water.visible=false;
    }
    for(const state of frame.gates??[]){const g=this.gates.get(state.gate_id);if(!g)continue;if(!Number.isFinite(state.opening_m)||state.opening_m<0)throw Error('Invalid opening_m');g.node.visible=true;g.node.position[g.axis]=g.base+Math.min(g.max,state.opening_m);if(g.water)g.water.visible=Number.isFinite(state.discharge_m3s)&&state.discharge_m3s>0;}
    if(this.spray)this.spray.visible=false;this.update(frame.time_s);
  }
  update(time){
    this.time=time;for(const m of this.waters)m.uniforms.time.value=time;
    for(const mesh of this.debris){
      const t=Math.min(5,Math.max(0,time-mesh.userData.start)),z=3+t*2;
      mesh.rotation.x=-Math.min(Math.PI/2,t*1.8);
      const c=Math.cos(mesh.rotation.x),s=Math.sin(mesh.rotation.x);
      let contact=-Infinity;
      for(const dy of [-this.geometry.gate_height_m/2,this.geometry.gate_height_m/2])for(const dz of [-.25,.25])
        contact=Math.max(contact,this.profile(this.geometry,z+dy*s+dz*c)-(dy*c-dz*s)+.04);
      mesh.position.z=z;mesh.position.y=Math.max(contact,mesh.userData.initialY-GRAVITY*t*t*.5);
    }
    for(const gate of this.gates.values())if(gate.release)this.updateRelease(gate);
  }
  dispose(){const geos=new Set(),mats=new Set(),textures=new Set();for(const gate of this.gates.values())if(gate.replayGeometry)geos.add(gate.replayGeometry);this.root.traverse(o=>{if(o.geometry)geos.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[]){mats.add(m);for(const value of Object.values(m))if(value?.isTexture)textures.add(value);}});geos.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());this.environment?.dispose();this.draco?.dispose();this.ktx?.dispose();this.root.clear();}
}
