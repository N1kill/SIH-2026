import assert from 'node:assert/strict';
import {test} from 'node:test';
import {DamScenePlugin,fitReferenceGeometry} from '../outputs/3d/dashboard/dam-scene-plugin.js';
import * as THREE from 'three';
import {buildDamAssembly} from '../outputs/3d/dashboard/dam-scene.js';
test('replay gates use explicit states, metres and simulation time',()=>{
  const plugin=new DamScenePlugin({});
  const gate={node:{position:{y:32},visible:true},base:32,axis:'y',max:9,water:{visible:true,material:{uniforms:{release:{value:.5}}}}};
  plugin.gates.set('one',gate);
  plugin.applyReplayFrame({time_s:120,gates:[{gate_id:'one',opening_m:2}]});
  assert.equal(gate.node.position.y,34);assert.equal(gate.water.visible,false);assert.equal(plugin.time,120);
  plugin.applyReplayFrame({time_s:60,gates:[{gate_id:'one',opening_m:20,discharge_m3s:10}]});
  assert.equal(gate.node.position.y,41);assert.equal(gate.water.visible,true);assert.equal(plugin.time,60);
  plugin.applyReplayFrame({time_s:0,gates:[]});assert.equal(gate.node.visible,true);assert.equal(gate.node.position.y,32);assert.equal(gate.water.visible,false);
  plugin.setPreview(0);assert.equal(gate.node.visible,true);assert.equal(gate.node.position.y,32);assert.equal(gate.water.visible,false);
  assert.throws(()=>plugin.applyReplayFrame({time_s:NaN}));assert.throws(()=>plugin.setPreview(NaN));
});
test('embedded studio mode omits standalone preview enclosure',()=>{
  assert.equal(new DamScenePlugin({}, {embedded:true}).embedded,true);
  assert.equal(new DamScenePlugin({}).embedded,false);
});

test('preview is opt-in, pauses and resets, and does not change saved replay geometry',()=>{
  const plugin=new DamScenePlugin({}, {embedded:true});
  plugin.concrete=()=>new THREE.MeshStandardMaterial();
  plugin.assemble({bays:1,bay_width_m:12,pier_width_m:2.8,height_m:12.06,gate_height_m:9,deck_width_m:8,chute_length_m:60,basin_length_m:35});
  plugin.root.position.y=-8;
  const gate=plugin.gates.get('gate-1'),original=gate.water.geometry.attributes.position.array.slice();
  const condition={state:'breached',type:'partial',gateIndex:1,failedGateCount:1,holeWidthM:2,holeHeightM:1,leakOpeningMm:10,gateOpeningM:0};
  plugin.setCondition(condition,8.16); // Same 4.1 m head under a non-zero world datum.
  plugin.advanceSimulation(1);
  assert.equal(plugin.time,0);assert.equal(plugin.previewRelease,0);assert.equal(gate.water.visible,false);
  assert.equal(gate.damage.geometry.parameters.shapes.holes.length,1);
  plugin.startSimulation();plugin.advanceSimulation(.25);
  assert.equal(gate.water.visible,true);assert.ok(gate.frontDistance>0&&gate.frontDistance<10);
  assert.ok(Math.abs(plugin.previewRelease-6.920920945982828)<1e-8,'Absolute/local elevations must not alter the head');
  plugin.pauseSimulation();const paused=gate.water.geometry.attributes.position.array.slice();plugin.advanceSimulation(1);
  assert.equal(plugin.time,.25);assert.deepEqual(gate.water.geometry.attributes.position.array,paused);
  plugin.resetSimulation();assert.equal(plugin.time,0);assert.equal(gate.water.visible,false);assert.equal(plugin.previewRelease,0);
  plugin.applyReplayFrame({time_s:12,gates:[{gate_id:'gate-1',opening_m:1,discharge_m3s:2}]});
  assert.equal(gate.damage,null);assert.equal(gate.water.visible,true);assert.equal(gate.pool.visible,false);
  assert.deepEqual(gate.water.geometry.attributes.position.array,original);
  plugin.setCondition(condition,8.16);assert.equal(plugin.time,0);assert.equal(gate.water.visible,false);
  plugin.dispose();
});
test('site fit preserves gate height and puts deck at configured crest in metres',()=>{
  const source={bays:9,bay_width_m:12,pier_width_m:2.8,height_m:32,gate_height_m:9};
  const groundElevationM=48.324,waterElevationM=56.41,crestElevationM=63.7;
  const fit=fitReferenceGeometry(source,{groundElevationM,waterElevationM,crestElevationM});
  assert.equal(groundElevationM+fit.height_m,crestElevationM-source.gate_height_m-1.5);
  assert.equal(fit.gate_height_m,source.gate_height_m);
  assert.equal(groundElevationM+fit.height_m+fit.gate_height_m+1.5,crestElevationM);
  assert.equal(fit.bay_width_m,12);
  assert.equal(source.height_m,32);
  assert.throws(()=>fitReferenceGeometry(source,{groundElevationM:57,waterElevationM:56,crestElevationM:63}));
});
test('study gap removes only local embankment and road triangles',()=>{
  const terrain={project:{dam_length_m:200,dam_height_m:20,crest_elevation_m:20,downstream_bearing_deg:0},origin:[0,0,0],crest_local:[[-100,0,0],[0,0,0],[100,0,0]]};
  const manifest={specification:{},reconstruction_label:'test reconstruction'};
  const material=new THREE.MeshStandardMaterial();
  const materials={downstream:material,crest:material,upstream:material,riprap:material};
  const args={terrain,manifest,elevationAt:()=>0,materials};
  const full=buildDamAssembly(args),gap=buildDamAssembly({...args,visualGapM:40});
  assert.equal(gap.dimensionCheck.path_length_m,full.dimensionCheck.path_length_m);
  assert.ok(gap.deformMeshes[0].geometry.index.count<full.deformMeshes[0].geometry.index.count);
  assert.ok(gap.deformMeshes[1].geometry.index.count<full.deformMeshes[1].geometry.index.count);
  for(const assembly of [full,gap])assembly.group.traverse(object=>object.geometry?.dispose());
  material.dispose();
});
