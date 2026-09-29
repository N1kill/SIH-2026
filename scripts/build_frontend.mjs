import {mkdir,copyFile,access,cp} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
const execFileAsync=promisify(execFile);
const buildCommand=process.platform==='win32'
  ? {command:process.env.ComSpec||'cmd.exe',args:['/d','/s','/c','npm run build']}
  : {command:'npm',args:['run','build']};

const runBuild=async(cwd)=>{
  const result=await execFileAsync(buildCommand.command,buildCommand.args,{cwd});
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
};
await runBuild(fileURLToPath(new URL('../frontend-dam/',import.meta.url)));
await runBuild(fileURLToPath(new URL('../frontend/',import.meta.url)));

const target=new URL('../outputs/3d/dashboard/vendor/',import.meta.url);
await mkdir(target,{recursive:true});
for(const [source,name] of [['build/three.module.js','three.module.js'],['build/three.core.js','three.core.js'],['examples/jsm/controls/OrbitControls.js','OrbitControls.js'],['LICENSE','THREE-LICENSE.txt']]) {
  await copyFile(new URL('../node_modules/three/'+source,import.meta.url),new URL(name,target));
}
await cp(new URL('../node_modules/three/examples/jsm/',import.meta.url),new URL('addons/',target),{recursive:true});
for(const name of ['twin.html','twin.css','twin.js','replay-modules.js','dam-scene.js','water-surface.js','scene-physics.js','gate-aperture.js','studio.html','studio.js','dam-scene-plugin.js'])await access(new URL('../outputs/3d/dashboard/'+name,import.meta.url));
console.log('PRALAYA frontend, /simulation/ 2D operations, and /twin/twin.html 3D twin ready. Serve with uvicorn server:app.');
