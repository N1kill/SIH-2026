import * as THREE from 'three';

export class QualityManager {
  constructor(renderer, select) {
    this.renderer=renderer;this.select=select;this.samples=[];
    this.reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
    this.tier=this.detect();
    this.reducedMotion.addEventListener('change',()=>this.apply());
    select?.addEventListener('change',()=>{this.tier=select.value==='auto'?this.detect():select.value;this.apply();});
    this.apply();
  }
  detect(){const gl=this.renderer.getContext();const high=gl.getParameter(gl.MAX_TEXTURE_SIZE)>=8192&&navigator.hardwareConcurrency>=8;return high?'high':navigator.hardwareConcurrency>=4?'medium':'low';}
  apply(){if(this.select&&this.select.value==='auto')this.select.dataset.resolved=this.tier;const scale={low:1,medium:1.5,high:2}[this.tier]||1;this.renderer.setPixelRatio(Math.min(devicePixelRatio,scale));this.noMotion=this.reducedMotion.matches;}
  sample(ms){this.samples.push(ms);if(this.samples.length>180)this.samples.shift();}
  stats(){const sorted=[...this.samples].sort((a,b)=>a-b);return {tier:this.tier,reduced_motion:this.noMotion,frame_ms_p50:sorted[Math.floor(sorted.length*.5)]??0,frame_ms_p95:sorted[Math.floor(sorted.length*.95)]??0,draw_calls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles};}
}

export class SceneDirector {
  constructor(scene,camera,controls){this.scene=scene;this.camera=camera;this.controls=controls;this.layers={};this.mode='engineering';}
  register(name,objects){this.layers[name]=objects.filter(Boolean);}
  setMode(mode){this.mode=mode;const policy={engineering:{engineering:true,overview:false,diagnostic:false},overview:{engineering:false,overview:true,diagnostic:false},diagnostic:{engineering:true,overview:false,diagnostic:true}}[mode];for(const [layer,objects] of Object.entries(this.layers))for(const object of objects)object.visible=Boolean(policy?.[layer]);this.camera.near=mode==='overview'?5:.25;this.camera.far=mode==='overview'?200000:12000;this.camera.updateProjectionMatrix();}
}

export class DamAssetLoader {
  constructor(manifest){this.manifest=manifest;}
  validate(){if(this.manifest?.scale?.vertical!==1||this.manifest?.scale?.horizontal!==1)throw new Error('Engineering assets must retain 1:1 scale');return this.manifest.components||[];}
  available(kind){return this.validate().filter(component=>component.kind===kind&&component.state!=='unavailable');}
  label(){return this.manifest?.reconstruction_label||'provenance unavailable';}
}

export class DamDeformer {
  constructor(meshOrMeshes){
    this.targets=[].concat(meshOrMeshes).filter(Boolean).map(mesh=>({mesh,position:mesh.geometry.attributes.position,base:mesh.geometry.attributes.position.array.slice(),meta:mesh.userData.deformation||[]}));
    this.mesh=this.targets[0]?.mesh;
  }
  apply(state){
    const bottom=state.width_m/2,top=Math.max(bottom,(state.top_width_m??state.width_m)/2),depth=state.depth_m;
    for(const target of this.targets){
      for(let i=0;i<target.meta.length;i++){
        const meta=target.meta[i];let cut=0;
        if(meta.distance<=bottom)cut=depth;
        else if(meta.distance<top)cut=depth*(top-meta.distance)/Math.max(top-bottom,1e-6);
        const offset=i*3;target.position.array[offset+1]=meta.surface?Math.max(meta.ground,target.base[offset+1]-cut):target.base[offset+1];
      }
      target.position.needsUpdate=true;target.mesh.geometry.computeVertexNormals();target.mesh.geometry.computeBoundingSphere();
      target.mesh.visible=state.width_m<=0||target.mesh.geometry.boundingSphere.radius>0;
    }
  }
}

export class ReplayClock {
  constructor(){this.frames=[];this.index=0;this.speed=1;}
  load(frames){this.frames=frames;this.index=0;}
  bounded(index){return Math.max(0,Math.min(index,this.frames.length-1));}
  seek(index){this.index=this.bounded(index);return this.frames[this.index];}
  step(direction=1){return this.seek(this.index+direction);}
  interpolate(a,b,time){if(!a||!b||b.time_s<=a.time_s)return a;const f=THREE.MathUtils.clamp((time-a.time_s)/(b.time_s-a.time_s),0,1);const lerp=(x,y)=>x+(y-x)*f;return {...a,time_s:time,reservoir:{...a.reservoir,elevation_m:lerp(a.reservoir.elevation_m,b.reservoir.elevation_m)},breach:{...a.breach,width_m:lerp(a.breach.width_m,b.breach.width_m),depth_m:lerp(a.breach.depth_m,b.breach.depth_m),invert_m:lerp(a.breach.invert_m,b.breach.invert_m),discharge_m3s:lerp(a.breach.discharge_m3s,b.breach.discharge_m3s)}};}
}

export class ForecastLayer {
  constructor(canvas,summary){this.canvas=canvas;this.summary=summary;}
  render(forecast){const ctx=this.canvas.getContext('2d'),bands=forecast.bands||[];ctx.clearRect(0,0,this.canvas.width,this.canvas.height);if(!bands.length)return;const values=bands.flatMap(row=>[row.discharge_m3s.p10,row.discharge_m3s.p90]),max=Math.max(...values,1),x=i=>32+i*(this.canvas.width-48)/Math.max(bands.length-1,1),y=v=>this.canvas.height-24-v*(this.canvas.height-40)/max;ctx.strokeStyle='#31465d';ctx.strokeRect(32,8,this.canvas.width-48,this.canvas.height-32);ctx.beginPath();bands.forEach((row,i)=>{const px=x(i),py=y(row.discharge_m3s.p90);i?ctx.lineTo(px,py):ctx.moveTo(px,py)});[...bands].reverse().forEach((row,i)=>ctx.lineTo(x(bands.length-1-i),y(row.discharge_m3s.p10)));ctx.closePath();ctx.fillStyle='rgba(246,173,69,.18)';ctx.fill();for(const [key,dash,color] of [['p50',[7,5],'#f6ad45'],['p10',[2,4],'#9db0c5'],['p90',[2,4],'#9db0c5']]){ctx.beginPath();ctx.setLineDash(dash);ctx.strokeStyle=color;bands.forEach((row,i)=>{const px=x(i),py=y(row.discharge_m3s[key]);i?ctx.lineTo(px,py):ctx.moveTo(px,py)});ctx.stroke();}ctx.setLineDash([]);this.summary.textContent=`Forecast begins ${new Date(forecast.initialized_at).toLocaleString()} · ${forecast.ensemble_size} members · P10/P50/P90 discharge · ${forecast.classification}`;}
}

export class TelemetryPanel {
  constructor(container){this.container=container;}
  render(items){this.container.replaceChildren(...items.map(([label,value,unit,status='simulated'])=>{const div=document.createElement('div');div.className='metric';const small=document.createElement('small');small.textContent=`${label} · ${status}`;const strong=document.createElement('b');strong.textContent=`${Number(value).toLocaleString(undefined,{maximumFractionDigits:2})} ${unit}`;div.append(small,strong);return div;}));}
}

export class Diagnostics {
  constructor(output,quality){this.output=output;this.quality=quality;}
  update(frame){if(!this.output)return;const stats=this.quality.stats();this.output.textContent=`${stats.tier} quality · ${stats.frame_ms_p50.toFixed(1)} ms p50 / ${stats.frame_ms_p95.toFixed(1)} ms p95 · ${stats.draw_calls} draws · ${stats.triangles.toLocaleString()} triangles · mass residual ${(frame?.metrics?.mass_error_m3??0).toExponential(2)} m³`;}
}

export function waterMaterial(){return new THREE.ShaderMaterial({
  transparent:true,depthWrite:false,side:THREE.DoubleSide,
  uniforms:{time:{value:0},colorDeep:{value:new THREE.Color(0x06384f)},colorShallow:{value:new THREE.Color(0x35a8b8)},sunColor:{value:new THREE.Color(0xd7f5ff)}},
  vertexShader:`uniform float time;varying vec3 vWorld;varying vec3 vNormal;varying float vWave;void main(){vec3 p=position;float a=sin(p.x*.021+time*.72);float b=sin(p.z*.034-time*.91);float c=sin((p.x+p.z)*.009+time*.34);vWave=a*.18+b*.11+c*.08;p.y+=vWave;vec4 world=modelMatrix*vec4(p,1.);vWorld=world.xyz;vNormal=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*viewMatrix*world;}`,
  fragmentShader:`uniform vec3 colorDeep;uniform vec3 colorShallow;uniform vec3 sunColor;varying vec3 vWorld;varying vec3 vNormal;varying float vWave;void main(){vec3 viewDir=normalize(cameraPosition-vWorld);float fresnel=pow(1.-max(dot(viewDir,normalize(vNormal)),0.),3.);float ripples=.5+.5*sin(vWorld.x*.16+vWorld.z*.11+vWave*10.);vec3 base=mix(colorDeep,colorShallow,.5+vWave*.65);vec3 color=mix(base,sunColor,clamp(fresnel*.62+ripples*.045,0.,.72));gl_FragColor=vec4(color,.86);}`
});}

export class HydraulicEffects {
  constructor(water,jets,particles){this.water=water;this.jets=jets;this.particles=particles;}
  animate(time,reduced){if(this.water?.material?.uniforms&&!reduced)this.water.material.uniforms.time.value=time*.001;}
}
