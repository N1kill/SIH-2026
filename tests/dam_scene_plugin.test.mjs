import assert from 'node:assert/strict';
import {test} from 'node:test';
import {DamScenePlugin} from '../outputs/3d/dashboard/dam-scene-plugin.js';
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
