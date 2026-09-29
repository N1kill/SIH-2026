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
export function releaseProfile({elevation,speed,length,segments,supportAt,thickness=.04}){
  const points=[],v=Math.max(.05,speed),energy=elevation+v*v/(2*GRAVITY);
  let y=elevation,velocity=v;
  for(let i=0;i<=segments;i++){
    const distance=i*length/segments,support=supportAt(distance);
    if(!Number.isFinite(support)||support>energy+.001)break;
    const freeFall=elevation-GRAVITY*(distance/v)**2*.5;
    y=Math.max(freeFall,support)+thickness;
    velocity=Math.sqrt(Math.max(.0025,v*v+2*GRAVITY*(elevation-y)));
    points.push({distance,y,velocity});
  }
  return points;
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
