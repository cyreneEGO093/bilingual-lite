// SPDX-License-Identifier: GPL-3.0-only
// Dedicated Android emulator/device only. Uses a fresh Gecko profile and local mock API.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn, execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import net from 'node:net';
import { serveToolbarFixture } from './image-toolbar-scenario.mjs';
import { serveMobileFixture, mobileBubbles, checkComposer, checkStableEntry } from './mobile-fixtures.mjs';

const adb=process.env.ADB_BIN,serial=process.env.TEST_ANDROID_DEVICE;
if(!adb||!serial)throw new Error('Set ADB_BIN and TEST_ANDROID_DEVICE to an isolated test emulator/device.');
const adbRun=(...args)=>execFileSync(adb,['-s',serial,...args],{encoding:'utf8',timeout:30000,windowsHide:true});
const manifest=JSON.parse(await readFile('dist/firefox-mv3/manifest.json','utf8'));
const uuid='59fae133-0e40-4cd1-b538-6c7a6c402b16';
const calls={text:0,full:0,snip:0};
const server=createServer(async(req,res)=>{
  try{
    if(serveMobileFixture(req,res)||serveToolbarFixture(req,res))return;
    res.setHeader('Content-Type','application/json');
    if(req.url==='/v1/models'){res.end(JSON.stringify({data:[{id:'mock-vision',architecture:{input_modalities:['text','image']}}]}));return;}
    if(req.url==='/v1/chat/completions'){
      let raw='';for await(const chunk of req)raw+=chunk;const body=JSON.parse(raw),content=body.messages[1].content;
      let result;
      if(Array.isArray(content)){
        assert.equal(body.max_tokens,1500);assert.deepEqual(body.reasoning,{enabled:false});
        if(content[0].text.includes('框内')){assert.ok(body.messages[0].content.includes('ANDROID_SNIP'));calls.snip++;result={original:'Touch crop',translated:'触摸框选测试译文'};}else{assert.ok(body.messages[0].content.includes('ANDROID_IMAGE'));calls.full++;result=mobileBubbles;}
      }else{assert.ok(body.messages[0].content.includes('ANDROID_TEXT'));calls.text++;result=JSON.parse(content).map(i=>({id:i.id,translated:'手机测试译文：'+i.text}));}
      res.end(JSON.stringify({choices:[{message:{content:JSON.stringify(result)}}]}));return;
    }
    res.statusCode=404;res.end('{}');
  }catch(e){res.statusCode=500;res.end(JSON.stringify({error:{message:String(e)}}));}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const port=server.address().port,base=`http://127.0.0.1:${port}`;
adbRun('reverse',`tcp:${port}`,`tcp:${port}`);
let driver,session=process.env.ANDROID_SESSION_ID,driverUrl=process.env.ANDROID_WEBDRIVER_URL,capabilities;
const ownSession=!session;
async function command(method,path,body){const r=await fetch(driverUrl+path,{method,...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(120000)});const d=await r.json();if(!r.ok)throw new Error(JSON.stringify(d.value));return d.value;}
const run=(script,args=[])=>command('POST',`/session/${session}/execute/sync`,{script,args});
const go=url=>command('POST',`/session/${session}/url`,{url});
const wait=async(script,timeout=30000)=>{const end=Date.now()+timeout;while(Date.now()<end){if(await run(script))return;await new Promise(r=>setTimeout(r,150));}throw new Error('Android assertion timeout: '+script);};
const point=expression=>run(`const r=(${expression}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}`);
async function nativeViewport(){
  // Native Android input is needed to exercise the real IME and context menu,
  // which Gecko's WebDriver touch synthesis does not activate on its own.
  adbRun('shell','uiautomator','dump','/sdcard/bilingual-lite-test-ui.xml');
  const xml=adbRun('shell','cat','/sdcard/bilingual-lite-test-ui.xml');
  const node=xml.match(/<node\b[^>]*resource-id="[^"]*:id\/engineView"[^>]*>/)?.[0];
  const bounds=node?.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
  assert.ok(bounds,'Firefox browser view must be foreground; finish first-run onboarding before testing.');
  const view=await run('return {x:visualViewport.offsetLeft,y:visualViewport.offsetTop,width:visualViewport.width}');
  return {x:Number(bounds[1]),y:Number(bounds[2]),offsetX:view.x,offsetY:view.y,scale:(Number(bounds[3])-Number(bounds[1]))/view.width};
}
const press=async expression=>{await wait(`const r=(${expression}).getBoundingClientRect();return r.width>0&&r.height>0&&r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight`);const v=await nativeViewport(),p=await point(expression);adbRun('shell','input','tap',String(Math.round(v.x+(p.x-v.offsetX)*v.scale)),String(Math.round(v.y+(p.y-v.offsetY)*v.scale)));};
const swipe=async(p,dx,dy,duration=350)=>{const v=await nativeViewport();adbRun('shell','input','swipe',String(Math.round(v.x+(p.x-v.offsetX)*v.scale)),String(Math.round(v.y+(p.y-v.offsetY)*v.scale)),String(Math.round(v.x+(p.x+dx-v.offsetX)*v.scale)),String(Math.round(v.y+(p.y+dy-v.offsetY)*v.scale)),String(duration));};
const drag=async(expression,dx,dy)=>swipe(await point(expression),dx,dy);
const shot=async name=>writeFile(`evidence/${name}.png`,execFileSync(adb,['-s',serial,'exec-out','screencap','-p'],{timeout:30000,windowsHide:true,maxBuffer:12*1024*1024}));
try{
  if(ownSession){
    if(!process.env.GECKODRIVER_PATH)throw new Error('Set GECKODRIVER_PATH.');
    const socket=net.createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const driverPort=socket.address().port;await new Promise(r=>socket.close(r));
    driverUrl=`http://127.0.0.1:${driverPort}`;
    driver=spawn(process.env.GECKODRIVER_PATH,['--host','127.0.0.1','--port',String(driverPort),'--allow-system-access','--android-storage','internal'],{windowsHide:true,env:{...process.env,PATH:resolve(adb,'..')+';'+process.env.PATH},stdio:['ignore','pipe','pipe']});
    await new Promise((resolve,reject)=>{driver.stdout.on('data',b=>{if(b.toString().includes('Listening on'))resolve();});driver.on('error',reject);setTimeout(()=>reject(new Error('Driver startup timeout')),10000).unref();});
    // Mozilla automation launch extra: https://bugzilla.mozilla.org/show_bug.cgi?id=2064671
    const options={androidPackage:process.env.TEST_FIREFOX_ANDROID_PACKAGE??'org.mozilla.firefox',androidDeviceSerial:serial,androidIntentArguments:['-a','android.intent.action.VIEW','-d','about:blank','--ez','automationtest','true'],prefs:{'extensions.webextensions.uuids':JSON.stringify({[manifest.browser_specific_settings.gecko.id]:uuid})}};
    const created=await command('POST','/session',{capabilities:{alwaysMatch:{browserName:'firefox',acceptInsecureCerts:true,'moz:firefoxOptions':options}}});session=created.sessionId;capabilities=created.capabilities;
  }
  await command('DELETE',`/session/${session}/actions`);
  await command('POST',`/session/${session}/moz/addon/install`,{addon:(await readFile(`dist/bilingual-lite-${manifest.version}-firefox.zip`)).toString('base64'),temporary:true});
  await mkdir('evidence',{recursive:true});
  await go(`moz-extension://${uuid}/options.html`);
  await wait("return innerWidth>0&&document.querySelector('[name=baseUrl]')&&!document.querySelector('form').inert");
  assert.ok(await run('return document.documentElement.scrollWidth<=innerWidth'),'settings must fit the phone viewport');
  await run("document.querySelector('[name=baseUrl]').value=arguments[0];document.querySelector('[name=apiKey]').value='';document.querySelector('#models').click()",[`${base}/v1`]);
  await wait("return document.querySelector('#status').textContent.includes('连接成功')");
  await run("document.querySelector('#prompt-text').value='ANDROID_TEXT: use concise {{targetLang}}.';document.querySelector('#prompt-image').value='ANDROID_IMAGE: translate natural speech.';document.querySelector('#prompt-snippet').value='ANDROID_SNIP: keep names.';document.querySelector('#save-prompts').click()");
  await wait("return document.querySelector('#status').textContent.includes('提示词已保存')");
  await run("const n=document.querySelector('#floating-scale');n.value='150';n.dispatchEvent(new Event('change',{bubbles:true}))");
  await wait("return document.querySelector('#status').textContent.includes('悬浮工具大小已保存')");
  await go(`${base}/mobile-feed`);
  await wait("const h=document.querySelector('[data-bl-owned=controls]');return h&&Math.abs(h.shadowRoot.querySelector('#controls-expand').getBoundingClientRect().width-72)<1");
  await press("document.querySelector('[data-bl-owned=controls]').shadowRoot.querySelector('#controls-expand')");
  await wait("const r=document.querySelector('[data-bl-owned=controls]').getBoundingClientRect();return r.right<=innerWidth&&r.bottom<=innerHeight");
  await shot('android-scaled-controls');
  await go(`moz-extension://${uuid}/options.html`);
  await wait("return document.querySelector('#floating-scale')?.disabled===false");
  assert.equal(await run("return document.querySelector('#floating-scale').value"),'150');
  await run("document.querySelector('#floating-defaults').click()");
  await wait("return document.querySelector('#status').textContent.includes('悬浮工具大小已保存')");
  await shot('android-settings');
  await go(`${base}/mobile`);
  const height=await run('return visualViewport.height');
  await checkComposer({run,wait,press,drag,touch:true,onInputFocus:async()=>{
    await wait(`return visualViewport.height<${height}-100`);
    await wait("const r=document.querySelector('[data-bl-owned=controls]').getBoundingClientRect(),v=visualViewport;return r.bottom<=v.offsetTop+v.height&&r.right<=v.offsetLeft+v.width");
    await shot('android-keyboard');console.log('PASS Android soft keyboard: visual viewport shrinks and the floating launcher remains visible within the visible screen.');
    adbRun('shell','input','keyevent','4');await wait(`return visualViewport.height>=${height}-10`);
  }});
  await shot('android-text');
  await go(`${base}/mobile-feed`);await checkStableEntry(run,wait);
  await swipe({x:100,y:420},0,-280,180);await swipe({x:100,y:400},0,-260,180);
  await shot('android-feed');
  await go(`${base}/mobile-manga`);
  await wait("return document.querySelector('img').naturalWidth>0&&!!document.querySelector('[data-bl-owned=image-button]')");
  await swipe({x:80,y:180},0,0,650);
  const bar="document.querySelector('[data-bl-owned=image-button]').shadowRoot";
  await wait("return getComputedStyle(document.querySelector('[data-bl-owned=image-button]')).display!=='none'");
  assert.equal(await run('return location.hash'),'','long press must not follow the image link');assert.equal(calls.full,0);
  await drag(`${bar}.querySelector('#move-toolbar')`,0,200);
  await press(`${bar}.querySelector('#full')`);
  const overlay="document.querySelector('[data-bl-owned=image-overlay]').shadowRoot";
  await wait(`return document.querySelector('[data-bl-owned=image-overlay]')&&${overlay}.querySelectorAll('.bubble').length===2`);
  const box=()=>run(`const r=${overlay}.querySelector('.bubble').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}`);
  assert.ok(await run(`return [...${overlay}.querySelectorAll('.handle')].every(n=>getComputedStyle(n).display==='none')`),'reading mode must not cover words with handles');
  await press(`${bar}.querySelector('#adjust')`);
  const tools="document.querySelector('[data-bl-owned=bubble-tools]').shadowRoot";
  await wait(`return !!document.querySelector('[data-bl-owned=bubble-tools]')&&${tools}.querySelector('.move-handle').getBoundingClientRect().width>=44`);
  const clearTools=`const a=${overlay}.querySelector('.bubble').getBoundingClientRect(),b=document.querySelector('[data-bl-owned=bubble-tools]').getBoundingClientRect();return b.right<=a.left||b.left>=a.right||b.bottom<=a.top||b.top>=a.bottom`;
  await wait(clearTools);
  const before=await box();await drag(`${tools}.querySelector('.move-handle')`,-20,20);
  // Native input returns before Gecko necessarily paints its last pointer move.
  await wait(`const r=${overlay}.querySelector('.bubble').getBoundingClientRect();return Math.abs(r.x-${before.x}+20)<3&&Math.abs(r.y-${before.y}-20)<3`);
  const moved=await box();await drag(`${tools}.querySelector('.resize-handle')`,8,8);
  await wait(`const r=${overlay}.querySelector('.bubble').getBoundingClientRect();return Math.abs(r.width-${moved.width}-8)<3&&Math.abs(r.height-${moved.height}-8)<3`);
  await wait(clearTools);await shot('android-bubble-tools');
  await press(`${tools}.querySelector('#done')`);
  await wait("return getComputedStyle(document.querySelector('[data-bl-owned=bubble-tools]')).display==='none'");
  await press(`${bar}.querySelector('#snip')`);await wait("return !!document.querySelector('[data-bl-owned=snip]')");
  const crop=await run("const r=document.querySelector('img').getBoundingClientRect();return {x:r.x+r.width*.2,y:r.y+r.height*.35,dx:r.width*.35,dy:r.height*.15}");
  await swipe(crop,crop.dx,crop.dy,500);
  await wait(`return [...${overlay}.querySelectorAll('.words')].some(n=>n.textContent==='触摸框选测试译文')`);
  assert.equal(calls.full,1);assert.equal(calls.snip,1);await shot('android-manga');
  adbRun('shell','settings','put','system','accelerometer_rotation','0');adbRun('shell','settings','put','system','user_rotation','1');
  await wait('return innerWidth>innerHeight');
  await wait("const h=document.querySelector('[data-bl-owned=controls]'),r=h.getBoundingClientRect(),v=visualViewport;return r.left>=v.offsetLeft&&r.top>=v.offsetTop&&r.right<=v.offsetLeft+v.width&&r.bottom<=v.offsetTop+v.height");
  assert.equal(calls.full,1);assert.equal(calls.snip,1);await shot('android-landscape');
  console.log('PASS Android Firefox: settings, background API, text modes, input/send access, touch long press, image/crop translation, real touch move/resize and landscape. '+JSON.stringify({browser:capabilities?.browserVersion??await run('return navigator.userAgent'),calls}));
}catch(e){if(session){console.error(await run("return {url:location.href,status:document.querySelector('#status')?.textContent??document.querySelector('[data-bl-owned=controls]')?.shadowRoot.querySelector('p')?.textContent,view:{width:innerWidth,height:innerHeight,visualHeight:visualViewport?.height}} ").catch(()=>null));await shot('android-failure').catch(()=>{});}throw e;}
finally{adbRun('shell','settings','put','system','user_rotation','0');adbRun('reverse','--remove',`tcp:${port}`);if(ownSession&&session)await command('DELETE',`/session/${session}`).catch(()=>{});driver?.kill();await new Promise(r=>server.close(r));}
