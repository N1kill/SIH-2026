import assert from 'node:assert/strict';
import test from 'node:test';
import {GRAVITY,clipReservoirAtDam,foundationHeight,fromDamLocal,toDamLocal,releaseProfile,gateSlabInterval,timedRelease} from '../outputs/3d/dashboard/scene-physics.js';
import {gateAperture,wetAperture,fullReservoirLevel,apertureSources} from '../outputs/3d/dashboard/gate-aperture.js';

test('release starts dry and advances by travel time, not instantly across the apron',()=>{
  const path=releaseProfile({elevation:10,speed:5,length:50,segments:100,supportAt:()=>0});
  assert.deepEqual(timedRelease(path,0),[]);
  const early=timedRelease(path,.1),later=timedRelease(path,1);
  assert.ok(early.at(-1).distance>0 && early.at(-1).distance<1);
  assert.ok(later.at(-1).distance>early.at(-1).distance);
  assert.ok(later.at(-1).distance<50);
  assert.equal(timedRelease(path,100).at(-1).distance,50);
  assert.deepEqual(timedRelease(path,1),later,'Paused time must produce identical geometry');
});

test('crack is jagged with a millimetre opening and the gate hole is enclosed',()=>{
  const gate={width:18,max:9};
  const crack=gateAperture({type:'crack',holeWidthM:2,leakOpeningMm:10},gate);
  assert.equal(crack.sources.length,9);
  assert.ok(Math.abs(wetAperture(crack.polygon,9).area-.02)<1e-9);
  const hole=gateAperture({type:'partial',holeWidthM:2,holeHeightM:2},gate);
  assert.ok(hole.polygon.every(([x,y])=>Math.abs(x)<gate.width/2&&y>0&&y<gate.max));
  assert.equal(wetAperture(hole.polygon,0).area,0);
  const wet=wetAperture(hole.polygon,3);
  assert.ok(wet.area>0&&wet.area<wetAperture(hole.polygon,9).area);
  assert.ok(wet.y<3&&wet.polygon.every(p=>p[1]<=3));
});

test('full reservoir honors configured maximum rather than raising it to the crest',()=>{
  assert.equal(fullReservoirLevel({maximum_water_level_m:57.3,crest_elevation_m:63.7}).level,57.3);
  assert.equal(fullReservoirLevel({stage_storage:[[54,0],[57,100]],crest_elevation_m:63.7}).level,57);
  assert.match(fullReservoirLevel({crest_elevation_m:63.7}).source,/Assumed/);
});

test('partially submerged crack sources stay inside the cutout instead of being moved through steel',()=>{
  const crack=gateAperture({type:'crack',holeWidthM:11.3,leakOpeningMm:1},{width:11.7,max:9});
  for(const level of [1,2.7,4.1,5]){
    const wet=wetAperture(crack.polygon,level);
    for(const p of apertureSources(wet)){
      assert.ok(Number.isFinite(p.y)&&p.y<=level);
      let inside=false;
      for(let i=0,j=crack.polygon.length-1;i<crack.polygon.length;j=i++){
        const a=crack.polygon[i],b=crack.polygon[j];
        if((a[1]>p.y)!==(b[1]>p.y)&&p.x<(b[0]-a[0])*(p.y-a[1])/(b[1]-a[1])+a[0])inside=!inside;
      }
      assert.ok(inside,'Source must intersect the physical aperture');
    }
  }
});

test('reservoir triangles stop exactly at rotated concrete and embankment faces',()=>{
  const angle=1.17,positions=[];
  for(const [x,z] of [[-20,-20],[20,-20],[20,20],[-20,-20],[20,20],[-20,20]]){const p=fromDamLocal(x,z,angle);positions.push(p.x,0,p.z);}
  const clipped=clipReservoirAtDam(positions,{angle,upstream:-3,halfWidth:5,sideUpstream:-10});
  assert.ok(clipped.length>0);
  for(let i=0;i<clipped.length;i+=9){
    const points=[0,3,6].map(j=>toDamLocal(clipped[i+j],clipped[i+j+2],angle));
    const centre=points.reduce((v,p)=>v+p.x/3,0),limit=Math.abs(centre)<5?-3:-10;
    for(const p of points)assert.ok(p.z<=limit+1e-5,`${p.z} crossed ${limit}`);
  }
});

test('water falls under gravity then contacts the ground without penetrating it',()=>{
  const profile=releaseProfile({elevation:10,speed:5,length:15,segments:60,supportAt:()=>0,thickness:0});
  assert.equal(profile[0].y,10);
  assert.ok(Math.abs(profile[4].y-(10-.5*GRAVITY*(1/5)**2))<1e-8);
  assert.equal(profile.at(-1).y,0);
  for(const p of profile)assert.ok(p.y>=0);
});

test('release cannot pass through a solid wall above its available energy',()=>{
  const profile=releaseProfile({elevation:2,speed:1,length:10,segments:20,supportAt:d=>d>=3?10:0});
  assert.ok(profile.every(p=>p.distance<3));
});

test('foundation cut is local and lower than the structure without changing terrain outside it',()=>{
  const site={angle:0,halfWidth:20,upstream:-8,downstream:50,floor:-2.1,margin:10};
  assert.equal(foundationHeight(0,0,12,site),-2.1);
  assert.equal(foundationHeight(0,70,12,site),12);
  assert.equal(foundationHeight(100,0,12,site),12);
  assert.equal(foundationHeight(0,0,-10,site),-10);
});

test('broken gate collision rotates with the slab and excludes space outside its footprint',()=>{
  const slab={position:{x:0,y:4,z:5},angle:0,width:12,height:8};
  assert.deepEqual(gateSlabInterval(0,5,slab),{bottom:0,top:8});
  assert.equal(gateSlabInterval(0,7,slab),null);
  const fallen=gateSlabInterval(0,7,{...slab,angle:Math.PI/2});
  assert.ok(Math.abs(fallen.bottom-3.75)<1e-8);assert.ok(Math.abs(fallen.top-4.25)<1e-8);
  assert.equal(gateSlabInterval(7,5,slab),null);
});
