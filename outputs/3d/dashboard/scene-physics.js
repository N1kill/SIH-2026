// Metre/second collision helpers for the interactive architectural preview.
// These visual boundaries never mutate the DEM or the saved hydraulic solution.
export const GRAVITY=9.81;
export function toDamLocal(x,z,angle){
  const c=Math.cos(angle),s=Math.sin(angle);
  return {x:c*x-s*z,z:s*x+c*z};
}
export function fromDamLocal(x,z,angle){
  const c=Math.cos(angle),s=Math.sin(angle);
  return {x:c*x+s*z,z:-s*x+c*z};
}

export function foundationHeight(x,z,ground,site){
  if(!site)return ground;
  const p=toDamLocal(x,z,site.angle);
  const distance=Math.max(Math.abs(p.x)-site.halfWidth,site.upstream-p.z,p.z-site.downstream,0);
  const blend=Math.min(1,distance/site.margin);
  // A local excavation accommodates the reconstructed foundation and apron.
  return Math.min(ground,site.floor+(ground-site.floor)*blend);
}

// Gravity trajectory with unilateral contact against the solid chute/ground.
// Stops when a solid obstacle is above the available hydraulic energy head.
export function releaseProfile({elevation,speed,length,segments,supportAt,thickness=.04,distances}){
  const points=[],v=Math.max(.05,speed),energy=elevation+v*v/(2*GRAVITY);
  let y=elevation,velocity=v;
  for(const distance of distances??Array.from({length:segments+1},(_,i)=>i*length/segments)){
    const support=supportAt(distance);
    if(!Number.isFinite(support)||support>energy+.001)break;
    const freeFall=elevation-GRAVITY*(distance/v)**2*.5;
    y=Math.max(freeFall,support)+thickness;
    velocity=Math.sqrt(Math.max(.0025,v*v+2*GRAVITY*(elevation-y)));
    points.push({distance,y,velocity});
  }
  return points;
}

export function timedRelease(profile,time){
  if(time<=0||!profile.length)return [];
  let arrival=0;const visible=[];
  for(let i=0;i<profile.length;i++){
    const point={...profile[i]};
    if(i)arrival+=(point.distance-profile[i-1].distance)/Math.max(.05,(point.velocity+profile[i-1].velocity)/2);
    point.arrival=arrival;
    if(arrival>time){
      const a=visible.at(-1);if(a){const f=(time-a.arrival)/(arrival-a.arrival);visible.push({distance:a.distance+(point.distance-a.distance)*f,y:a.y+(point.y-a.y)*f,velocity:a.velocity+(point.velocity-a.velocity)*f,arrival:time});}break;
    }
    visible.push(point);
  }
  return visible;
}

// Vertical collision interval through a gate slab rotated about its local X axis.
export function gateSlabInterval(x,z,{position,angle,width,height,thickness=.5}){
  if(Math.abs(x-position.x)>width/2+1e-7)return null;
  const c=Math.cos(angle),s=Math.sin(angle),dz=z-position.z;
  let lower=-Infinity,upper=Infinity;
  for(const [a,b,extent] of [[c,s*dz,height/2],[-s,c*dz,thickness/2]]){
    if(Math.abs(a)<1e-8){if(Math.abs(b)>extent+1e-7)return null;continue;}
    const y1=(-extent-b)/a,y2=(extent-b)/a;
    lower=Math.max(lower,Math.min(y1,y2));upper=Math.min(upper,Math.max(y1,y2));
  }
  return lower<=upper+1e-7?{bottom:position.y+lower,top:position.y+upper}:null;
}

// Clip complete triangles at the dam's upstream face, including edge crossings.
// Cell masks alone can interpolate triangles through thin walls.
export function clipReservoirAtDam(positions,{angle,upstream,halfWidth=Infinity,sideUpstream=upstream}){
  const result=[];
  const clip=(polygon,distance)=>{
    const clipped=[];
    for(let j=0;j<polygon.length;j++){
      const a=polygon[j],b=polygon[(j+1)%polygon.length],da=distance(a),db=distance(b);
      if(da>=0)clipped.push(a);
      if((da>=0)!==(db>=0)){
        const t=da/(da-db);clipped.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t,lx:a.lx+(b.lx-a.lx)*t,lz:a.lz+(b.lz-a.lz)*t});
      }
    }
    return clipped;
  };
  for(let i=0;i<positions.length;i+=9){
    const polygon=[];
    for(let j=0;j<9;j+=3){const p={x:positions[i+j],y:positions[i+j+1],z:positions[i+j+2]},local=toDamLocal(p.x,p.z,angle);polygon.push({...p,lx:local.x,lz:local.z});}
    const regions=Number.isFinite(halfWidth)?[
      [p=>p.lx+halfWidth,p=>halfWidth-p.lx,p=>upstream-p.lz],
      [p=>-halfWidth-p.lx,p=>sideUpstream-p.lz],
      [p=>p.lx-halfWidth,p=>sideUpstream-p.lz],
    ]:[[p=>upstream-p.lz]];
    for(const boundaries of regions){
      const clipped=boundaries.reduce((points,boundary)=>clip(points,boundary),polygon);
      for(let j=1;j<clipped.length-1;j++)for(const p of [clipped[0],clipped[j],clipped[j+1]])result.push(p.x,p.y,p.z);
    }
  }
  return new Float32Array(result);
}
