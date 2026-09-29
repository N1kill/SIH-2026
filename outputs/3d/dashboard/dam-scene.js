import * as THREE from 'three';
import {releaseProfile} from './scene-physics.js';

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

function seededNoise(seed){
  let state=seed>>>0;
  return ()=>((state=Math.imul(1664525,state)+1013904223>>>0)/4294967296);
}

function textureCanvas(base,variation,seed=1,size=256){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=size;
  const context=canvas.getContext('2d'),image=context.createImageData(size,size),random=seededNoise(seed);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const coarse=Math.sin(x*.16)+Math.sin(y*.11)+Math.sin((x+y)*.045);
    const grain=(random()-.5)*2,shade=coarse*variation*.22+grain*variation;
    const index=(y*size+x)*4;
    image.data[index]=clamp(base[0]+shade,0,255);
    image.data[index+1]=clamp(base[1]+shade,0,255);
    image.data[index+2]=clamp(base[2]+shade,0,255);
    image.data[index+3]=255;
  }
  context.putImageData(image,0,0);return canvas;
}

function repeatingTexture(base,variation,seed,repeat=24,color=true){
  const texture=new THREE.CanvasTexture(textureCanvas(base,variation,seed));
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(repeat,repeat);
  texture.anisotropy=8;if(color)texture.colorSpace=THREE.SRGBColorSpace;
  return texture;
}

export class MaterialLibrary {
  constructor(){this.materials=[];this.textures=[];}
  texture(base,variation,seed,repeat,color=true){const result=repeatingTexture(base,variation,seed,repeat,color);this.textures.push(result);return result;}
  standard(options){const material=new THREE.MeshStandardMaterial(options);this.materials.push(material);return material;}
  build(){
    const terrainMap=this.texture([78,96,64],34,11,150);
    const terrainBump=this.texture([128,128,128],62,12,150,false);
    const earthMap=this.texture([133,111,78],30,21,1);
    const earthBump=this.texture([128,128,128],75,22,1,false);
    const grassMap=this.texture([83,105,68],30,31,1);
    const grassBump=this.texture([128,128,128],55,32,1,false);
    const asphaltMap=this.texture([55,59,60],18,41,1);
    const concreteMap=this.texture([148,147,137],20,51,2);
    const rockMap=this.texture([100,96,84],36,61,1);
    return {
      terrain:this.standard({map:terrainMap,bumpMap:terrainBump,bumpScale:1.4,roughness:.98,color:0xb7c4a2,side:THREE.DoubleSide}),
      upstream:this.standard({map:grassMap,bumpMap:grassBump,bumpScale:.55,roughness:.97,color:0xaabf91,side:THREE.DoubleSide}),
      downstream:this.standard({map:earthMap,bumpMap:earthBump,bumpScale:.85,roughness:.96,color:0xc0aa82,side:THREE.DoubleSide}),
      crest:this.standard({map:asphaltMap,bumpMap:asphaltMap,bumpScale:.12,roughness:.91,color:0xc3c8c8,side:THREE.DoubleSide}),
      concrete:this.standard({map:concreteMap,roughness:.82,color:0xd5d2c8}),
      wetConcrete:this.standard({map:concreteMap,roughness:.42,color:0x777d7d}),
      steel:this.standard({color:0x536673,metalness:.72,roughness:.34}),
      gate:this.standard({color:0x2d7185,metalness:.58,roughness:.3}),
      rock:this.standard({map:rockMap,bumpMap:rockMap,bumpScale:.5,roughness:1,color:0xb5ad98}),
    };
  }
  dispose(){for(const material of this.materials)material.dispose();for(const texture of this.textures)texture.dispose();}
}

function cumulative(path){const values=[0];for(let i=1;i<path.length;i++)values.push(values.at(-1)+Math.hypot(path[i][0]-path[i-1][0],path[i][1]-path[i-1][1]));return values;}

function samplePath(path,spacing=10){
  const distances=cumulative(path),total=distances.at(-1),count=Math.max(2,Math.ceil(total/spacing)+1),result=[];
  for(let index=0;index<count;index++){
    const distance=index/(count-1)*total;let segment=1;
    while(segment<distances.length-1&&distances[segment]<distance)segment++;
    const span=Math.max(distances[segment]-distances[segment-1],1e-6),f=(distance-distances[segment-1])/span;
    const x=THREE.MathUtils.lerp(path[segment-1][0],path[segment][0],f),z=THREE.MathUtils.lerp(path[segment-1][1],path[segment][1],f);
    const dx=(path[segment][0]-path[segment-1][0])/span,dz=(path[segment][1]-path[segment-1][1])/span;
    result.push({x,z,nx:-dz,nz:dx,distance});
  }
  return {stations:result,total};
}

function nearestDistance(stations){let best=stations[0],value=Infinity;for(const station of stations){const d=Math.hypot(station.x,station.z);if(d<value){value=d;best=station;}}return best.distance;}

function evidenceValue(value,fallback){return Number.isFinite(value?.value)?value.value:fallback;}

function addRiprap(group,stations,breachDistance,height,materials,elevationAt,crestWidth){
  const selected=stations.filter((station,index)=>index%3===0&&Math.abs(station.distance-breachDistance)<440);
  if(!selected.length)return;
  const geometry=new THREE.DodecahedronGeometry(1,0),mesh=new THREE.InstancedMesh(geometry,materials.rock,selected.length*2),dummy=new THREE.Object3D();let instance=0;
  for(const station of selected){for(const side of [-1,1]){
    const offset=side*(crestWidth/2+height*2.12);const x=station.x+station.nx*offset,z=station.z+station.nz*offset;
    dummy.position.set(x,elevationAt(x,z)+.8,z);dummy.scale.set(1.4+((instance*17)%9)*.12,.65+((instance*7)%5)*.1,1.1+((instance*11)%7)*.12);dummy.rotation.set(instance*.7,instance*1.31,instance*.23);dummy.updateMatrix();mesh.setMatrixAt(instance++,dummy.matrix);
  }}
  mesh.count=instance;mesh.castShadow=mesh.receiveShadow=true;mesh.name='Reconstructed toe riprap · assumed dam-type treatment';group.add(mesh);
}

function buildApprovedSpillway(group,manifest,materials,height){
  const gates=(manifest.components||[]).filter(component=>component.kind==='gate'&&component.state==='available');
  if(!gates.length)return {objects:[],status:'unavailable'};
  const bayWidths=gates.map(gate=>evidenceValue(gate.dimensions.width,0)).filter(Boolean),bayWidth=bayWidths[0];if(!bayWidth)return {objects:[],status:'incomplete'};
  const assembly=new THREE.Group(),objects=[];assembly.name='Approved spillway and gate assembly';
  const total=bayWidth*gates.length,deck=new THREE.Mesh(new THREE.BoxGeometry(total+8,2,14),materials.concrete);deck.position.y=height*.7;assembly.add(deck);objects.push(deck);
  gates.forEach((gate,index)=>{
    const gateHeight=evidenceValue(gate.dimensions.height,height*.45),x=(index-(gates.length-1)/2)*bayWidth;
    const slab=new THREE.Mesh(new THREE.BoxGeometry(bayWidth*.88,gateHeight,.8),materials.gate);slab.position.set(x,height*.7-gateHeight/2,0);slab.name=`${gate.id} · ${gate.state}`;assembly.add(slab);objects.push(slab);
    const pier=new THREE.Mesh(new THREE.BoxGeometry(1.1,gateHeight+4,12),materials.concrete);pier.position.set(x-bayWidth/2,height*.7-(gateHeight-4)/2,0);assembly.add(pier);objects.push(pier);
  });
  assembly.position.set(-total/2,height*.3,0);assembly.traverse(object=>{if(object.isMesh){object.castShadow=object.receiveShadow=true;}});group.add(assembly);return {objects,status:'approved'};
}

export function buildDamAssembly({terrain,manifest,elevationAt,materials,visualGapM=0}){
  const group=new THREE.Group();group.name='Evidence-aware dam assembly';const project=terrain.project,spec=manifest.specification||{};
  const angle=project.downstream_bearing_deg*Math.PI/180,length=project.dam_length_m||1000;
  const source=terrain.crest_local;
  const path=source?.length>=2?source.map(point=>[point[0],point[2]]):[[-Math.cos(angle)*length/2,-Math.sin(angle)*length/2],[Math.cos(angle)*length/2,Math.sin(angle)*length/2]];
  const {stations,total}=samplePath(path,10),breachDistance=nearestDistance(stations),height=project.dam_height_m;
  const crest=project.crest_elevation_m==null?height:project.crest_elevation_m-terrain.origin[2];
  const crestWidth=evidenceValue(spec.crest_width,Math.max(6,height*.3));
  const upSlope=evidenceValue(spec.upstream_slope,2.5),downSlope=evidenceValue(spec.downstream_slope,2.0);
  const positions=[],uv=[],indices=[],meta=[];
  for(const station of stations){
    const centerGround=elevationAt(station.x,station.z),top=Math.max(centerGround,crest);
    const upBase=crestWidth/2+Math.max(0,top-centerGround)*upSlope,downBase=crestWidth/2+Math.max(0,top-centerGround)*downSlope;
    const cross=[[-upBase,null],[-crestWidth/2,top],[crestWidth/2,top],[downBase,null]];
    cross.forEach(([offset,y],crossIndex)=>{
      const x=station.x+station.nx*offset,z=station.z+station.nz*offset,ground=elevationAt(x,z),finalY=y??ground;
      positions.push(x,finalY,z);uv.push(station.distance/28,crossIndex/3);meta.push({distance:Math.abs(station.distance-breachDistance),surface:crossIndex>0&&crossIndex<3,ground,baseY:finalY});
    });
  }
  const groups=[];
  for(let band=0;band<3;band++){
    const start=indices.length;
    for(let station=0;station<stations.length-1;station++){
      const midpoint=(stations[station].distance+stations[station+1].distance)/2;
      if(Math.abs(midpoint-breachDistance)<visualGapM/2)continue;
      const a=station*4+band,b=a+4;indices.push(a,b,a+1,a+1,b,b+1);
    }
    groups.push([start,indices.length-start,band]);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);
  geometry.clearGroups();for(const [start,count,band] of groups)geometry.addGroup(start,count,band);
  geometry.computeVertexNormals();geometry.computeBoundingSphere();
  const dam=new THREE.Mesh(geometry,[materials.downstream,materials.crest,materials.upstream]);dam.castShadow=dam.receiveShadow=true;
  dam.name=`Continuous earthfill embankment · ${manifest.reconstruction_label}`;dam.userData.deformation=meta;group.add(dam);
  // A narrow crest overlay makes the roadway legible without inventing structural details.
  const roadPositions=[],roadUv=[],roadIndices=[],roadMeta=[];
  stations.forEach((station,index)=>{
    for(const offset of [-crestWidth*.43,crestWidth*.43]){const x=station.x+station.nx*offset,z=station.z+station.nz*offset,ground=elevationAt(x,z);roadPositions.push(x,crest+.06,z);roadUv.push(station.distance/18,index);roadMeta.push({distance:Math.abs(station.distance-breachDistance),surface:true,ground,baseY:crest+.06});}
    if(index<stations.length-1){
      const midpoint=(station.distance+stations[index+1].distance)/2;
      if(Math.abs(midpoint-breachDistance)>=visualGapM/2){const a=index*2;roadIndices.push(a,a+2,a+1,a+1,a+2,a+3);}
    }
  });
  const roadGeometry=new THREE.BufferGeometry();roadGeometry.setAttribute('position',new THREE.Float32BufferAttribute(roadPositions,3));roadGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(roadUv,2));roadGeometry.setIndex(roadIndices);roadGeometry.computeVertexNormals();
  const road=new THREE.Mesh(roadGeometry,materials.crest);road.castShadow=road.receiveShadow=true;road.name=`Crest surface · assumed width ${crestWidth.toFixed(1)} m`;road.userData.deformation=roadMeta;group.add(road);
  addRiprap(group,stations,breachDistance,height,materials,elevationAt,crestWidth);
  const structures=buildApprovedSpillway(group,manifest,materials,height);
  const sourceLength=total,dimensionError=project.dam_length_m?Math.abs(sourceLength-project.dam_length_m)/project.dam_length_m:0;
  return {group,deformMeshes:[dam,road],pickables:[dam,road,...structures.objects],breachDistance,height,crest,crestWidth,
    dimensionCheck:{configured_length_m:project.dam_length_m,path_length_m:sourceLength,error_percent:dimensionError*100,status:dimensionError<=.12?'pass':'warning'},
    structureStatus:structures.status};
}

export class FlowSheet {
  constructor(color,name){
    this.segments=36;const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array((this.segments+1)*2*3),3));geometry.setAttribute('uv',new THREE.BufferAttribute(new Float32Array((this.segments+1)*2*2),2));
    const indices=[];for(let i=0;i<this.segments;i++){const a=i*2;indices.push(a,a+2,a+1,a+1,a+2,a+3);}geometry.setIndex(indices);
    const material=new THREE.MeshPhysicalMaterial({color,transparent:true,opacity:.78,roughness:.14,metalness:0,transmission:.08,depthWrite:false,side:THREE.DoubleSide,emissive:new THREE.Color(color).multiplyScalar(.08)});
    this.mesh=new THREE.Mesh(geometry,material);this.mesh.name=name;this.mesh.visible=false;this.mesh.renderOrder=4;
  }
  update({discharge,velocity,elevation,downstream,along,lateral=0,time=0,supportAt=()=>0}){
    if(!Number.isFinite(discharge)||discharge<=0){this.mesh.visible=false;return;}
    const speed=Math.max(velocity||1,.5),area=discharge/speed,width=clamp(Math.sqrt(area)*2.1,2.5,70),length=clamp(speed*11+Math.sqrt(discharge)*2,25,420),positions=this.mesh.geometry.attributes.position.array,uv=this.mesh.geometry.attributes.uv.array;
    const profile=releaseProfile({elevation,speed,length,segments:this.segments,supportAt:distance=>{
      const x=downstream.x*distance+along.x*lateral,z=downstream.z*distance+along.z*lateral;
      return Math.max(...[-1,0,1].map(side=>supportAt(x+along.x*side*width/2,z+along.z*side*width/2)));
    }});
    for(let i=0;i<profile.length;i++){
      const f=i/this.segments,{distance,y}=profile[i],ribbon=width*(1-.45*f);
      for(let side=0;side<2;side++){
        const edge=side?1:-1,index=(i*2+side)*3,x=downstream.x*distance+along.x*(lateral+edge*ribbon/2),z=downstream.z*distance+along.z*(lateral+edge*ribbon/2);
        positions[index]=x;positions[index+1]=Math.max(y,supportAt(x,z)+.04);positions[index+2]=z;const u=(i*2+side)*2;uv[u]=side;uv[u+1]=f;
      }
    }
    this.mesh.geometry.setDrawRange(0,Math.max(0,profile.length-1)*6);this.mesh.geometry.attributes.position.needsUpdate=true;this.mesh.geometry.computeVertexNormals();this.mesh.geometry.computeBoundingSphere();this.mesh.material.opacity=clamp(.55+Math.log10(discharge+1)*.08,.58,.9);this.mesh.visible=profile.length>1;
  }
  dispose(){this.mesh.geometry.dispose();this.mesh.material.dispose();}
}

export function createSkyDome(){
  const material=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{top:{value:new THREE.Color(0x193d55)},horizon:{value:new THREE.Color(0x9aafa9)},ground:{value:new THREE.Color(0x26362f)}},vertexShader:'varying vec3 vWorld; void main(){vWorld=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform vec3 top;uniform vec3 horizon;uniform vec3 ground;varying vec3 vWorld;void main(){float h=normalize(vWorld).y;vec3 c=h>0.?mix(horizon,top,pow(h,.65)):mix(horizon,ground,min(1.,-h*2.));gl_FragColor=vec4(c,1.);}'});
  const mesh=new THREE.Mesh(new THREE.SphereGeometry(9000,32,18),material);mesh.name='Atmospheric sky';mesh.frustumCulled=false;return mesh;
}

export class ReplaySeriesChart {
  constructor(canvas,summary){this.canvas=canvas;this.summary=summary;this.frames=new Map();}
  clear(){this.frames.clear();this.render();}
  push(frame){if(frame?.time_s==null)return;this.frames.set(frame.time_s,frame);this.render(frame.time_s);}
  render(selectedTime){
    const canvas=this.canvas,ctx=canvas.getContext('2d'),ratio=Math.max(1,Math.min(devicePixelRatio||1,2)),width=Math.max(canvas.clientWidth,360),height=Math.max(canvas.clientHeight,210);
    if(canvas.width!==Math.round(width*ratio)||canvas.height!==Math.round(height*ratio)){canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);}ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,width,height);ctx.fillStyle='#091522';ctx.fillRect(0,0,width,height);
    const frames=[...this.frames.values()].sort((a,b)=>a.time_s-b.time_s);if(frames.length<2){ctx.fillStyle='#8fa7bc';ctx.font='12px system-ui';ctx.fillText('Replay traces appear as solver frames arrive.',16,30);return;}
    const definitions=[['Reservoir level','m',frame=>frame.reservoir.elevation_m,'#72d5df'],['Breach width','m',frame=>frame.breach.width_m,'#f6ad45'],['Release','m³/s',frame=>frame.breach.discharge_m3s+(frame.spillway?.discharge_m3s||0)+(frame.overtopping?.discharge_m3s||0),'#f37c6b']];
    const left=106,right=18,top=14,rowHeight=(height-34)/definitions.length,minT=frames[0].time_s,maxT=frames.at(-1).time_s,x=time=>left+(time-minT)/Math.max(maxT-minT,1)*(width-left-right);
    definitions.forEach((definition,row)=>{
      const [label,unit,accessor,color]=definition,values=frames.map(accessor),min=Math.min(...values),max=Math.max(...values),yTop=top+row*rowHeight,y=value=>yTop+rowHeight-13-(value-min)/Math.max(max-min,1e-9)*(rowHeight-24);
      ctx.strokeStyle='#263a4d';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(left,yTop+rowHeight-9);ctx.lineTo(width-right,yTop+rowHeight-9);ctx.stroke();ctx.fillStyle='#b7c9d9';ctx.font='600 11px system-ui';ctx.fillText(label,12,yTop+18);ctx.fillStyle='#7f98ad';ctx.font='10px ui-monospace,monospace';ctx.fillText(`${min.toFixed(unit==='m³/s'?0:2)}–${max.toFixed(unit==='m³/s'?0:2)} ${unit}`,12,yTop+34);
      ctx.strokeStyle=color;ctx.lineWidth=2;ctx.beginPath();frames.forEach((frame,index)=>{const px=x(frame.time_s),py=y(accessor(frame));index?ctx.lineTo(px,py):ctx.moveTo(px,py);});ctx.stroke();
      if(selectedTime!=null){ctx.strokeStyle='#edf5ff';ctx.setLineDash([3,4]);ctx.beginPath();ctx.moveTo(x(selectedTime),yTop+4);ctx.lineTo(x(selectedTime),yTop+rowHeight-9);ctx.stroke();ctx.setLineDash([]);}
    });
    ctx.fillStyle='#7890a4';ctx.font='10px ui-monospace,monospace';ctx.fillText(`${minT.toFixed(0)} s`,left,height-4);ctx.textAlign='right';ctx.fillText(`${maxT.toFixed(0)} s`,width-right,height-4);ctx.textAlign='left';
    if(this.summary){const current=frames.reduce((best,frame)=>Math.abs(frame.time_s-selectedTime)<Math.abs(best.time_s-selectedTime)?frame:best,frames[0]);this.summary.textContent=`Selected ${current.time_s.toFixed(1)} s · reservoir ${current.reservoir.elevation_m.toFixed(2)} m · breach ${current.breach.width_m.toFixed(1)} m · total release ${(current.breach.discharge_m3s+(current.spillway?.discharge_m3s||0)+(current.overtopping?.discharge_m3s||0)).toFixed(1)} m³/s · simulated`;}
  }
}

export function disposeDamScene(assembly,library){
  assembly?.group?.traverse(object=>{if(object.userData?.ownedTexture)object.userData.ownedTexture.dispose();if(object.isInstancedMesh)object.geometry.dispose();});
  library?.dispose();
}
