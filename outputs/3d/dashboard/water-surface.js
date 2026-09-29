// Mesh only the supplied reservoir footprint below the replayed water level.
// Grid samples are cell centres, matching the DEM terrain mesh coordinates.
export function waterSurfacePositions(source,origin,level){
  const n=source.grid_size,b=source.bounds,dx=(b[2]-b[0])/n,dz=(b[3]-b[1])/n;
  const points=[];
  const vertex=(r,c)=>({x:b[0]+(c+.5)*dx-origin[0],z:origin[1]-(b[3]-(r+.5)*dz),height:source.elevation[r][c],mask:source.reservoir_mask[r][c]?1:-1});
  const clip=(vertices,distance)=>{
    const clipped=[];
    for(let i=0;i<vertices.length;i++){
      const a=vertices[i],b=vertices[(i+1)%vertices.length],da=distance(a),db=distance(b),insideA=da>0,insideB=db>0;
      if(insideA)clipped.push(a);
      if(insideA!==insideB){const t=da/(da-db);clipped.push({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,height:a.height+(b.height-a.height)*t,mask:a.mask+(b.mask-a.mask)*t});}
    }
    return clipped;
  };
  const triangle=(vertices)=>{
    // Clip footprint and elevation independently: a masked high bank must not be
    // treated as an invented low elevation at the edge of a water triangle.
    const clipped=clip(clip(vertices,p=>p.mask),p=>level-p.height);
    for(let i=1;i<clipped.length-1;i++){
      for(const p of [clipped[0],clipped[i],clipped[i+1]])points.push(p.x,0,p.z);
    }
  };
  for(let r=0;r<n-1;r++)for(let c=0;c<n-1;c++){
    if(!source.valid[r][c]||!source.valid[r+1][c]||!source.valid[r][c+1]||!source.valid[r+1][c+1])continue;
    const a=vertex(r,c),b=vertex(r+1,c),d=vertex(r,c+1),e=vertex(r+1,c+1);
    triangle([a,b,d]);triangle([d,b,e]);
  }
  return new Float32Array(points);
}

// Local presentation aid for an approximate shoreline that ends short of the dam.
// The returned mask never changes the source grid, project water level or solver.
export function studyShorelineSource(source,origin,{widthM,bearingDeg}){
  const bearing=bearingDeg*Math.PI/180,upX=-Math.sin(bearing),upZ=Math.cos(bearing);
  const n=source.grid_size,b=source.bounds,dx=(b[2]-b[0])/n,dz=(b[3]-b[1])/n;
  const mask=source.reservoir_mask.map(row=>[...row]);
  for(let r=0;r<n;r++)for(let c=0;c<n;c++){
    if(!source.valid[r][c])continue;
    const x=b[0]+(c+.5)*dx-origin[0],z=origin[1]-(b[3]-(r+.5)*dz);
    const upstream=x*upX+z*upZ,across=x*upZ-z*upX;
    if(upstream>=0&&upstream<=widthM&&Math.abs(across)<=widthM/2)mask[r][c]=true;
  }
  return {...source,reservoir_mask:mask};
}
