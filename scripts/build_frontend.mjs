import {mkdir,copyFile,access} from 'node:fs/promises';
const target=new URL('../outputs/3d/dashboard/vendor/',import.meta.url);
await mkdir(target,{recursive:true});
for(const [source,name] of [['build/three.module.js','three.module.js'],['build/three.core.js','three.core.js'],['examples/jsm/controls/OrbitControls.js','OrbitControls.js'],['LICENSE','THREE-LICENSE.txt']]) {
  await copyFile(new URL('../node_modules/three/'+source,import.meta.url),new URL(name,target));
}
for(const name of ['twin.html','twin.css','twin.js'])await access(new URL('../outputs/3d/dashboard/'+name,import.meta.url));
console.log('Static dashboard built with local Three.js and OrbitControls. Serve with uvicorn server:app.');
