// Local gate coordinates in metres. The same polygon drives the mesh and flow area.
export function gateAperture(condition,gate){
  if(condition.type==='full')return {polygon:[[-gate.width/2,0],[gate.width/2,0],[gate.width/2,gate.max],[-gate.width/2,gate.max]],sources:null};
  const width=Math.min(gate.width-.4,condition.holeWidthM);
  if(condition.type==='crack'){
    const height=Math.min(gate.max*.48,Math.max(.8,width*.85));
    const centre=Math.min(gate.max-height/2-.35,Math.max(height/2+.35,gate.max*.3));
    const sources=Array.from({length:9},(_,i)=>({x:-width/2+i*width/8,y:centre+(i/8-.5)*height+([0,.09,-.08,.12,-.1,.08,-.1,.07,0][i])*.4*height}));
    const half=condition.leakOpeningMm/2000;
    return {polygon:[...sources.map(p=>[p.x,p.y-half]),...sources.toReversed().map(p=>[p.x,p.y+half])],sources};
  }
  const height=Math.min(gate.max-.7,condition.holeHeightM),bottom=Math.min(gate.max-height-.35,Math.max(.35,gate.max*.22));
  // Enclosed, chipped opening; concrete sill and the rest of the gate remain solid.
  const x=width/2,chip=Math.min(.12,width*.1,height*.1);
  return {polygon:[[-x+chip,bottom],[x-chip,bottom],[x,bottom+chip],[x,bottom+height-chip],[x-chip,bottom+height],[-x+chip,bottom+height],[-x,bottom+height-chip],[-x,bottom+chip]],sources:null};
}

export function wetAperture(polygon,level){
  const clipped=[];
  for(let i=0;i<polygon.length;i++){
    const a=polygon[i],b=polygon[(i+1)%polygon.length],da=level-a[1],db=level-b[1];
    if(da>=0)clipped.push(a);
    if((da>=0)!==(db>=0)){const t=da/(da-db);clipped.push([a[0]+(b[0]-a[0])*t,level]);}
  }
  let twiceArea=0,cx=0,cy=0;
  for(let i=0;i<clipped.length;i++){const a=clipped[i],b=clipped[(i+1)%clipped.length],cross=a[0]*b[1]-b[0]*a[1];twiceArea+=cross;cx+=(a[0]+b[0])*cross;cy+=(a[1]+b[1])*cross;}
  return Math.abs(twiceArea)>1e-10?{polygon:clipped,area:Math.abs(twiceArea)/2,x:cx/(3*twiceArea),y:cy/(3*twiceArea)}:{polygon:[],area:0,x:0,y:0};
}

export function fullReservoirLevel(project){
  if(Number.isFinite(project.maximum_water_level_m))return {level:project.maximum_water_level_m,source:'Configured maximum water level'};
  if(project.stage_storage?.length)return {level:project.stage_storage.at(-1)[0],source:'Top of configured stage–storage curve'};
  return {level:project.crest_elevation_m-1.5,source:'Assumed at reconstructed gate top (1.5 m below deck)'};
}

// Emit only through the submerged polygon, including a crack that crosses the
// waterline. Clamping an above-water source vertically can move it into solid steel.
export function apertureSources(wet){
  if(!wet.area)return [{x:0,y:0},{x:0,y:0}];
  const xs=[...new Set(wet.polygon.map(p=>p[0]))].sort((a,b)=>a-b),inset=(xs.at(-1)-xs[0])*.02;
  const left=xs[0]+inset,right=xs.at(-1)-inset;
  return [left,...xs.filter(x=>x>left&&x<right),right].map(x=>{
    const ys=[];
    for(let i=0;i<wet.polygon.length;i++){
      const a=wet.polygon[i],b=wet.polygon[(i+1)%wet.polygon.length];
      if(a[0]!==b[0]&&x>=Math.min(a[0],b[0])&&x<=Math.max(a[0],b[0]))ys.push(a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]));
    }
    return {x,y:(Math.min(...ys)+Math.max(...ys))/2};
  });
}
