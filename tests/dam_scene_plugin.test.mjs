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
  plugin.applyReplayFrame({time_s:0,gates:[]});assert.equal(gate.node.visible,false);assert.equal(gate.water.visible,false);
  plugin.setPreview(0);assert.equal(gate.node.visible,true);assert.equal(gate.node.position.y,32);assert.equal(gate.water.visible,false);
  assert.throws(()=>plugin.applyReplayFrame({time_s:NaN}));assert.throws(()=>plugin.setPreview(NaN));
});
test('embedded studio mode omits standalone preview enclosure',()=>{
  assert.equal(new DamScenePlugin({}, {embedded:true}).embedded,true);
  assert.equal(new DamScenePlugin({}).embedded,false);
});
test('site fit aligns procedural sill with water and deck with crest in metres',()=>{
  const source={bays:9,bay_width_m:12,pier_width_m:2.8,height_m:32,gate_height_m:9};
  const groundElevationM=48.324,waterElevationM=56.41,crestElevationM=63.7;
  const fit=fitReferenceGeometry(source,{groundElevationM,waterElevationM,crestElevationM});
  assert.equal(groundElevationM+fit.height_m,waterElevationM);
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
