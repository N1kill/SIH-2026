// Local Chromium integration check, using its built-in DevTools protocol.
// Usage: node scripts/verify_twin_browser.mjs [http://127.0.0.1:8050]
import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';

const profile=await mkdtemp(join(tmpdir(),'pralaya-browser-'));
const chrome=spawn(process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',[
  '--headless=new','--remote-debugging-port=0',`--user-data-dir=${profile}`,
  '--no-first-run','--no-default-browser-check','--use-angle=swiftshader','--enable-unsafe-swiftshader','about:blank',
],{windowsHide:true,stdio:['ignore','ignore','pipe']});
let socket,chromeLog='';
chrome.stderr.on('data',chunk=>{chromeLog+=chunk;});
try{
  const endpoint=await new Promise((resolve,reject)=>{
    let output='';const timer=setTimeout(()=>reject(Error('Chromium did not expose DevTools')),20000);
    chrome.stderr.on('data',chunk=>{output+=chunk;const match=output.match(/DevTools listening on (ws:\/\/\S+)/);if(match){clearTimeout(timer);resolve(match[1]);}});
    chrome.on('error',reject);chrome.on('exit',code=>{if(code)console.error('Chromium exit',code,output.slice(-4000));reject(Error(`Chromium exited: ${code}`));});
  });
  socket=new WebSocket(endpoint);await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve);socket.addEventListener('error',reject);});
  let id=0;const pending=new Map(),errors=[];
  socket.addEventListener('close',()=>{for(const callback of pending.values())callback.reject(Error('DevTools disconnected'));pending.clear();});
  socket.addEventListener('message',event=>{
    const data=JSON.parse(event.data);
    if(data.id){const callback=pending.get(data.id);pending.delete(data.id);data.error?callback?.reject(Error(JSON.stringify(data.error))):callback?.resolve(data.result);}
    if(data.method==='Runtime.exceptionThrown')errors.push(data.params.exceptionDetails.exception?.description||data.params.exceptionDetails.text);
    if(data.method==='Runtime.consoleAPICalled'&&data.params.type==='error')errors.push(data.params.args.map(arg=>arg.value??arg.description).join(' '));
  });
  const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const key=++id;pending.set(key,{resolve,reject});socket.send(JSON.stringify({id:key,method,params,sessionId}));});
  const {targetId}=await send('Target.createTarget',{url:'about:blank'});
  const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
  const page=(method,params)=>send(method,params,sessionId);
  const evaluate=async expression=>{const r=await page('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text+' '+r.exceptionDetails.exception?.description);return r.result.value;};
  await page('Runtime.enable');await page('Page.enable');
  await page('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await page('Page.navigate',{url:(process.argv[2]||'http://127.0.0.1:8050')+'/twin/twin.html'});
  let ready=false;
  for(let attempt=0;attempt<80;attempt++){
    ready=await evaluate("document.querySelector('#conditionMode')?.textContent==='Interactive architectural preview' && document.querySelector('#assetStatus')?.textContent.includes('foundation')");
    if(ready)break;await new Promise(resolve=>setTimeout(resolve,500));
  }
  assert.ok(ready,`Scene initialization failed: ${JSON.stringify(errors)} ${await evaluate("document.querySelector('#status')?.textContent")}`);
  const inspect=()=>evaluate("import('/twin/twin.js').then(m=>m.sceneDiagnostics())");
  const intact=await inspect();console.log('Intact',intact);
  assert.equal(intact.discharge,0);assert.equal(intact.flowingGates,0);assert.equal(intact.reservoirCrossings,0);assert.equal(intact.groundIntersections,0);
  assert.equal(intact.simulationState,'ready');assert.equal(intact.simulationTime,0);assert.equal(intact.reservoirElevation,57.3);
  await mkdir('.tmp/twin-qa',{recursive:true});
  const screenshot=async name=>{const shot=await page('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(`.tmp/twin-qa/${name}.png`,Buffer.from(shot.data,'base64'));};
  await screenshot('desktop-intact');
  const delay=ms=>evaluate(`new Promise(resolve=>setTimeout(resolve,${ms}))`);
  const start=()=>evaluate("document.querySelector('#previewStart').click()");
  const pause=()=>evaluate("document.querySelector('#previewPause').click()");
  await evaluate("document.querySelector('#breachedState').click(); document.querySelector('#damageType').value='crack'; document.querySelector('#damageType').dispatchEvent(new Event('input',{bubbles:true})); document.querySelector('#inspectDamage').click();");
  const crack=await inspect();console.log('Crack ready',crack);
  assert.equal(crack.discharge,0);assert.equal(crack.flowingGates,0);assert.equal(crack.apertures.length,1);assert.equal(crack.apertures[0].physicalHole,true);
  await screenshot('inspect-crack-ready');
  await start();await delay(700);await pause();
  const advancing=await inspect();console.log('Crack playing',advancing);
  assert.ok(advancing.discharge>0);assert.equal(advancing.flowingGates,1);assert.ok(advancing.fronts.some(d=>d>0));
  assert.equal(advancing.releaseIntersections,0);
  await delay(400);assert.equal((await inspect()).simulationTime,advancing.simulationTime,'Pause must freeze playback');
  await screenshot('inspect-crack-playing');
  await evaluate("document.querySelector('#previewReset').click()");
  const resetCrack=await inspect();assert.equal(resetCrack.simulationTime,0);assert.equal(resetCrack.flowingGates,0);assert.equal(resetCrack.apertures[0].physicalHole,true);
  await evaluate("document.querySelector('#damageType').value='partial'; document.querySelector('#damageType').dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#inspectDamage').click();");
  const hole=await inspect();console.log('Gate hole ready',hole);assert.equal(hole.discharge,0);assert.equal(hole.flowingGates,0);assert.equal(hole.apertures[0].physicalHole,true);
  await screenshot('inspect-hole-ready');
  await start();await delay(500);await pause();const early=await inspect();
  await screenshot('inspect-hole-early');
  await start();await delay(2000);await pause();const later=await inspect();console.log('Gate hole playing',later);
  assert.ok(later.fronts[0]>early.fronts[0],'Water front must advance with playback');assert.ok(later.discharge>0);assert.equal(later.releaseIntersections,0);
  await screenshot('inspect-hole-playing');
  await evaluate("document.querySelector('#camera').value='breach';document.querySelector('#camera').dispatchEvent(new Event('change'));");
  await evaluate("document.querySelector('#damageType').value='full'; document.querySelector('#damageType').dispatchEvent(new Event('input',{bubbles:true}));");
  assert.equal((await inspect()).flowingGates,0);await start();await delay(5500);await pause();
  const broken=await inspect();console.log('Gate break',broken);assert.equal(broken.debris,1);assert.equal(broken.flowingGates,1);assert.equal(broken.debrisWaterIntersections,0);assert.equal(broken.debrisGroundIntersections,0);assert.equal(broken.releaseIntersections,0);
  await screenshot('desktop-gate-break');
  await evaluate("document.querySelector('#resetCondition').click();document.querySelector('#gateOpening').value='1';document.querySelector('#gateOpening').dispatchEvent(new Event('input',{bubbles:true}));");
  assert.equal((await inspect()).flowingGates,0);await start();await delay(1000);await pause();
  const open=await inspect();assert.equal(open.flowingGates,open.gateCount);assert.equal(open.releaseIntersections,0);
  await evaluate("document.querySelector('#resetCondition').click()");
  const reset=await inspect();assert.equal(reset.discharge,0);assert.equal(reset.debris,0);assert.equal(reset.flowingGates,0);
  for(const [width,height] of [[1920,1080],[1440,1000],[1024,768],[768,1024],[375,812],[812,375]]){
    await page('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
    const layout=await evaluate(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>{
      const selectors=['header','.scenario-panel','.stage','.results','.scene-hud','#viewport','.timeline'];
      const rects=Object.fromEntries(selectors.map(s=>{const r=document.querySelector(s).getBoundingClientRect();return [s,{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}]}));
      const controls=[...document.querySelectorAll('button,input,select')].filter(e=>e.checkVisibility()).map(e=>({id:e.id,rect:e.getBoundingClientRect()}));
      const overlaps=[];for(let i=0;i<controls.length;i++)for(let j=i+1;j<controls.length;j++){const a=controls[i].rect,b=controls[j].rect;if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1)overlaps.push([controls[i].id,controls[j].id]);}
      resolve({width:innerWidth,scroll:document.documentElement.scrollWidth,rects,overlaps});
    })))`);
    console.log('Layout',width,height,JSON.stringify(layout));
    assert.ok(layout.scroll<=width+1,'Horizontal overflow');assert.deepEqual(layout.overlaps,[],'Controls overlap');
    assert.ok(layout.rects['.scene-hud'].bottom<=layout.rects['#viewport'].top+1,'HUD overlaps scene');
    if(width===375){await screenshot('mobile');await evaluate("document.querySelector('#viewport').scrollIntoView()");await screenshot('mobile-scene');await evaluate('window.scrollTo(0,0)');}
  }
  assert.deepEqual(errors,[],'Browser runtime errors');
  console.log('Browser checks passed. Screenshots: .tmp/twin-qa');
  await send('Browser.close').catch(error=>{if(error.message!=='DevTools disconnected')throw error;});
}catch(error){console.error(chromeLog.slice(-5000));throw error;}finally{socket?.close();chrome.kill();}
