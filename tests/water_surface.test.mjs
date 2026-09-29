import assert from 'node:assert/strict';
import test from 'node:test';
import {studyShorelineSource,waterSurfacePositions} from '../outputs/3d/dashboard/water-surface.js';

const source={grid_size:3,bounds:[0,0,3,3],valid:Array.from({length:3},()=>[true,true,true]),
  reservoir_mask:Array.from({length:3},()=>[true,true,true]),
  elevation:Array.from({length:3},()=>[0,0,0])};
const area=positions=>{
  let result=0;
  for(let i=0;i<positions.length;i+=9){
    const ax=positions[i],az=positions[i+2],bx=positions[i+3],bz=positions[i+5],cx=positions[i+6],cz=positions[i+8];
    result+=Math.abs((bx-ax)*(cz-az)-(bz-az)*(cx-ax))/2;
  }
  return result;
};

test('water uses metric DEM cell centres at 1:1 scale',()=>{
  const positions=waterSurfacePositions(source,[0,0,0],1);
  assert.equal(area(positions),4);
  const x=positions.filter((_,i)=>i%3===0),z=positions.filter((_,i)=>i%3===2);
  assert.equal(Math.min(...x),.5);assert.equal(Math.max(...x),2.5);
  assert.equal(Math.min(...z),-2.5);assert.equal(Math.max(...z),-.5);
});

test('water clips against elevation and source footprint as level changes',()=>{
  const hill={...source,elevation:source.elevation.map(row=>[...row])};hill.elevation[1][1]=2;
  assert.ok(area(waterSurfacePositions(hill,[0,0,0],1))<4);
  assert.equal(area(waterSurfacePositions(hill,[0,0,0],0)),0);
  assert.equal(area(waterSurfacePositions(hill,[0,0,0],3)),4);
  const masked={...source,reservoir_mask:source.reservoir_mask.map(row=>[...row])};masked.reservoir_mask[0][0]=false;
  assert.ok(area(waterSurfacePositions(masked,[0,0,0],1))<4);
});

test('visual shoreline connector remains local, valid-only and separate from source',()=>{
  const dry={grid_size:4,bounds:[-2,-2,2,2],valid:Array.from({length:4},()=>[true,true,true,true]),
    reservoir_mask:Array.from({length:4},()=>[false,false,false,false]),elevation:Array.from({length:4},()=>[0,0,0,0])};
  dry.valid[3][1]=false;
  const connected=studyShorelineSource(dry,[0,0,0],{widthM:2,bearingDeg:0});
  assert.equal(dry.reservoir_mask[2][1],false);
  assert.equal(connected.reservoir_mask[2][1],true);
  assert.equal(connected.reservoir_mask[3][1],false);
  assert.equal(connected.reservoir_mask[0][1],false);
  assert.equal(connected.reservoir_mask[2][0],false);
  assert.ok(area(waterSurfacePositions(connected,[0,0,0],1))>0);
  assert.equal(area(waterSurfacePositions(connected,[0,0,0],0)),0);
});
