// Firefox acceptance via the documented WebDriver API and Mozilla temporary add-on API.
// TEST_FIREFOX_PATH and GECKODRIVER_PATH must point to dedicated test binaries.
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import net from 'node:net';
import { startPixivProxy } from './pixiv-test-proxy.mjs';
async function freePort(){const socket=net.createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));return port;}
if(!process.env.TEST_FIREFOX_PATH||!process.env.GECKODRIVER_PATH)throw new Error('Set TEST_FIREFOX_PATH and GECKODRIVER_PATH.');
let textRequests=0,imageRequests=0,snippetRequests=0,downloads=0;
const completions=[];
const server=createServer(async(req,res)=>{
  try{
    if(req.url==='/cards'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(await readFile('tests/fixtures/cards.html'));return;}
    if(req.url==='/v1/models'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({data:[{id:'mock-vision',architecture:{input_modalities:['image','text']}}]}));return;}
    if(req.url==='/v1/chat/completions'){
      let raw='';for await(const part of req)raw+=part;const body=JSON.parse(raw);completions.push(body);assert.equal(req.headers.authorization,'Bearer mock-key');
      const isImage=Array.isArray(body.messages[1].content),isSnippet=isImage&&body.messages[1].content[0].text.includes('框内');isSnippet?snippetRequests++:isImage?imageRequests++:textRequests++;
      const result=isSnippet?{original:'Test crop',translated:'Firefox 局部译文'}:isImage?[{original:'Hello friend',translated:'你好，朋友！一起阅读吧。',bbox:[100,90,320,430]},{original:'A new world',translated:'新世界正在等待我们。',bbox:[560,560,780,920]}]:JSON.parse(body.messages[1].content).map(i=>({id:i.id,translated:'中文译文：'+i.text}));
      res.setHeader('Content-Type','application/json');res.end(JSON.stringify({choices:[{message:{content:JSON.stringify(result)}}]}));return;
    }
    if(req.url==='/manga.png'){downloads++;res.setHeader('Content-Type','image/png');res.end(await readFile('tests/fixtures/manga.png'));return;}
    res.setHeader('Content-Type','text/html; charset=utf-8');
    if(req.url==='/manga'){res.end(`<body style="margin:30px"><div id="panel" style="width:800px"><img style="width:100%;display:block" src="http://localhost:${server.address().port}/manga.png"></div></body>`);return;}
    res.end(await readFile('tests/fixtures/text.html'));
  }catch(e){res.statusCode=500;res.end(String(e));}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`,port=await freePort();
const pixiv=await startPixivProxy();
const driver=spawn(process.env.GECKODRIVER_PATH,['--port',String(port),'--allow-system-access'],{windowsHide:true,stdio:['ignore','pipe','pipe']});
let session;
const command=async(method,path,body)=>{const response=await fetch(`http://127.0.0.1:${port}${path}`,{method,...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(45000)});const data=await response.json();if(!response.ok)throw new Error(JSON.stringify(data.value));return data.value;};
const run=(script,args=[])=>command('POST',`/session/${session}/execute/sync`,{script,args});
const wait=async(script,timeout=10000)=>{const deadline=Date.now()+timeout;while(Date.now()<deadline){if(await run(script))return;await new Promise(r=>setTimeout(r,100));}throw new Error(`Firefox assertion timeout: ${script}`);};
const go=url=>command('POST',`/session/${session}/url`,{url});
try{
  await new Promise((resolve,reject)=>{driver.stdout.on('data',chunk=>{if(chunk.toString().includes('Listening on'))resolve();});driver.on('error',reject);setTimeout(()=>reject(new Error('geckodriver startup timeout')),10000).unref();});
  const uuid='59fae133-0e40-4cd1-b538-6c7a6c402b16';
  const created=await command('POST','/session',{capabilities:{alwaysMatch:{browserName:'firefox',acceptInsecureCerts:true,'moz:firefoxOptions':{binary:process.env.TEST_FIREFOX_PATH,args:['-headless'],prefs:{'extensions.webextensions.uuids':JSON.stringify({'bilingual-lite@example.org':uuid}),'network.proxy.type':1,'network.proxy.ssl':'127.0.0.1','network.proxy.ssl_port':pixiv.port,'network.proxy.no_proxies_on':'localhost,127.0.0.1'}}}}});session=created.sessionId;
  await command('POST',`/session/${session}/window/rect`,{width:1100,height:1000});
  await command('POST',`/session/${session}/moz/addon/install`,{path:resolve('dist/firefox-mv3'),temporary:true});
  await command('POST',`/session/${session}/moz/context`,{context:'chrome'});
  await run("gBrowser.selectedTab=gBrowser.addTab(arguments[0],{triggeringPrincipal:Services.scriptSecurityManager.getSystemPrincipal()});",[`moz-extension://${uuid}/options.html`]);
  await command('POST',`/session/${session}/moz/context`,{context:'content'});
  const handles=await command('GET',`/session/${session}/window/handles`);await command('POST',`/session/${session}/window`,{handle:handles.at(-1)});
  await wait("return !!document.querySelector('[name=textModel]')?.value");
  await run("document.querySelector('[name=baseUrl]').value=arguments[0];document.querySelector('[name=apiKey]').value='mock-key';document.querySelector('#models').click();",[`${base}/v1`]);
  await wait("return document.querySelector('#status').textContent.includes('连接成功')");
  await go(base);await wait("return !!document.querySelector('[data-bl-owned=controls]')");
  await run("document.querySelector('[data-bl-owned=controls]').shadowRoot.querySelector('button').click()");
  await wait("return document.querySelectorAll('.bl-translation').length===5");assert.equal(textRequests,1);
  await run("document.querySelector('[data-bl-owned=controls]').shadowRoot.querySelector('#text-mode').click()");assert.ok(await run("return getComputedStyle(document.querySelector('p')).display==='none'"));
  await run("document.querySelector('[data-bl-owned=controls]').shadowRoot.querySelector('#text-mode').click()");assert.ok(await run("return getComputedStyle(document.querySelector('p')).display!=='none'"));assert.equal(textRequests,1);
  await run("document.querySelector('.below').scrollIntoView()");await wait("return !!document.querySelector('.below + .bl-translation')");assert.equal(textRequests,2);
  await mkdir('evidence',{recursive:true});
  await run('window.scrollTo(0,0)');await writeFile('evidence/firefox-text.png',Buffer.from(await command('GET',`/session/${session}/screenshot`),'base64'));
  await go(`${base}/manga`);await wait('return document.querySelector("img").naturalWidth>0');
  await run("document.querySelector('img').dispatchEvent(new PointerEvent('pointerover',{bubbles:true}));document.querySelector('[data-bl-owned=image-button]').shadowRoot.querySelector('button').click()");
  await wait("return document.querySelector('[data-bl-owned=image-overlay]')?.shadowRoot.querySelectorAll('.bubble').length===2",15000);
  assert.equal(imageRequests,1);assert.equal(downloads,2);
  const aligned=await run("const i=document.querySelector('img').getBoundingClientRect(),b=document.querySelector('[data-bl-owned=image-overlay]').shadowRoot.querySelector('.bubble').getBoundingClientRect();return Math.abs(b.x-i.x-i.width*.09)<2 && Math.abs(b.y-i.y-i.height*.1)<2");assert.ok(aligned);
  await writeFile('evidence/firefox-manga.png',Buffer.from(await command('GET',`/session/${session}/screenshot`),'base64'));
  await run("document.querySelector('[data-bl-owned=image-button]').shadowRoot.querySelector('#clear').click()");assert.ok(await run("return document.querySelector('[data-bl-owned=image-overlay]').hidden"));
  await run("document.querySelector('[data-bl-owned=image-button]').shadowRoot.querySelector('#snip').click()");
  const bounds=await run("const r=document.querySelector('img').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}");
  await command('POST',`/session/${session}/actions`,{actions:[{type:'pointer',id:'snip-mouse',parameters:{pointerType:'mouse'},actions:[{type:'pointerMove',duration:0,origin:'viewport',x:Math.round(bounds.x+bounds.width*.6),y:Math.round(bounds.y+bounds.height*.15)},{type:'pointerDown',button:0},{type:'pointerMove',duration:250,origin:'viewport',x:Math.round(bounds.x+bounds.width*.85),y:Math.round(bounds.y+bounds.height*.35)},{type:'pointerUp',button:0}]}]});
  await wait("return [...document.querySelector('[data-bl-owned=image-overlay]').shadowRoot.querySelectorAll('.bubble')].some(n=>n.textContent==='Firefox 局部译文')");assert.equal(snippetRequests,1);
  const cropAligned=await run("const i=document.querySelector('img').getBoundingClientRect(),b=[...document.querySelector('[data-bl-owned=image-overlay]').shadowRoot.querySelectorAll('.bubble')].find(n=>n.textContent==='Firefox 局部译文').getBoundingClientRect();return Math.abs(b.x-i.x-i.width*.6)<2 && Math.abs(b.y-i.y-i.height*.15)<2 && Math.abs(b.width-i.width*.25)<2");assert.ok(cropAligned);
  await writeFile('evidence/firefox-snip.png',Buffer.from(await command('GET',`/session/${session}/screenshot`),'base64'));
  // The proxy reproduces pximg's Referer gate without relying on external data.
  await go('https://www.pixiv.net/artworks/test');await wait('return document.querySelector("img").naturalWidth>0');
  await run("document.querySelector('img').dispatchEvent(new PointerEvent('pointerover',{bubbles:true}));document.querySelector('[data-bl-owned=image-button]').shadowRoot.querySelector('#full').click()");
  await wait("return document.querySelector('[data-bl-owned=image-overlay]')?.shadowRoot.querySelectorAll('.bubble').length===2",15000);assert.equal(imageRequests,2);
  await run("document.querySelector('[data-bl-owned=image-button]').shadowRoot.querySelector('#snip').click()");
  const pb=await run("const r=document.querySelector('img').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}");
  await command('POST',`/session/${session}/actions`,{actions:[{type:'pointer',id:'pixiv-snip',parameters:{pointerType:'mouse'},actions:[{type:'pointerMove',duration:0,origin:'viewport',x:Math.round(pb.x+pb.width*.6),y:Math.round(pb.y+pb.height*.15)},{type:'pointerDown',button:0},{type:'pointerMove',duration:250,origin:'viewport',x:Math.round(pb.x+pb.width*.85),y:Math.round(pb.y+pb.height*.35)},{type:'pointerUp',button:0}]}]});
  await wait("return [...document.querySelector('[data-bl-owned=image-overlay]').shadowRoot.querySelectorAll('.bubble')].some(n=>n.textContent==='Firefox 局部译文')");assert.equal(snippetRequests,2);
  assert.deepEqual(pixiv.requests.map(r=>r.status),[200,200,200]);
  for(const req of pixiv.requests.slice(1)){assert.equal(req.referer,'https://www.pixiv.net/');assert.equal(req.cookie,undefined);assert.equal(req.authorization,undefined);}
  assert.ok(await run("return !!document.querySelector('[data-bl-owned=controls]').shadowRoot.querySelector('p').textContent"));
  await wait("return getComputedStyle(document.querySelector('[data-bl-owned=controls]').shadowRoot.querySelector('p')).display==='none'",4000);
  await writeFile('evidence/pixiv-firefox.png',Buffer.from(await command('GET',`/session/${session}/screenshot`),'base64'));
  console.log('PASS Firefox Pixiv HTTPS: full and snip downloads, scoped Referer without cookies or API key, 3-second status dismissal.');
  const bubbleBox=()=>run("const b=document.querySelector('[data-bl-owned=image-overlay]').shadowRoot.querySelector('.bubble').getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height}");
  const drag=async(selector,dx,dy)=>{const h=await run("const r=document.querySelector('[data-bl-owned=image-overlay]').shadowRoot.querySelector(arguments[0]).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}",[selector]);await command('POST',`/session/${session}/actions`,{actions:[{type:'pointer',id:'bubble-drag',parameters:{pointerType:'mouse'},actions:[{type:'pointerMove',duration:0,origin:'viewport',x:Math.round(h.x),y:Math.round(h.y)},{type:'pointerDown',button:0},{type:'pointerMove',duration:250,origin:'viewport',x:Math.round(h.x+dx),y:Math.round(h.y+dy)},{type:'pointerUp',button:0}]}]});};
  const bb=await bubbleBox();await drag('.move-handle',30,20);const bm=await bubbleBox();assert.ok(Math.abs(bm.x-bb.x-30)<2);assert.ok(Math.abs(bm.y-bb.y-20)<2);
  await drag('.resize-handle',20,10);const bs=await bubbleBox();assert.ok(Math.abs(bs.width-bm.width-20)<2);assert.ok(Math.abs(bs.height-bm.height-10)<2);
  const imageWindow=await command('GET',`/session/${session}/window`);
  await command('POST',`/session/${session}/moz/context`,{context:'chrome'});
  await run("gBrowser.selectedTab=gBrowser.addTab(arguments[0],{triggeringPrincipal:Services.scriptSecurityManager.getSystemPrincipal()});",[`moz-extension://${uuid}/options.html`]);
  await command('POST',`/session/${session}/moz/context`,{context:'content'});
  const appearanceWindow=(await command('GET',`/session/${session}/window/handles`)).at(-1);await command('POST',`/session/${session}/window`,{handle:appearanceWindow});
  await wait("return document.querySelector('#overlay-transparency')?.disabled===false");
  await run("const t=document.querySelector('#overlay-transparency'),s=document.querySelector('#overlay-size');t.value='50';s.value='75';t.dispatchEvent(new Event('change'))");
  await wait("return document.querySelector('#status').textContent.includes('外观已保存')");
  await command('POST',`/session/${session}/window`,{handle:imageWindow});
  await wait("return document.querySelector('[data-bl-owned=image-overlay]').style.getPropertyValue('--bl-opacity')==='0.5'");
  const preserved=await bubbleBox();assert.ok(Math.abs(preserved.width-bs.width)<1);assert.ok(Math.abs(preserved.x-bs.x)<1);
  assert.equal(await run("return getComputedStyle(document.querySelector('[data-bl-owned=image-overlay]').shadowRoot.querySelector('.bubble')).backgroundColor"),'rgba(255, 255, 255, 0.5)');
  assert.equal(await run("return getComputedStyle(document.querySelector('[data-bl-owned=image-overlay]').shadowRoot.querySelector('.words')).opacity"),'1');
  await writeFile('evidence/firefox-overlay-controls.png',Buffer.from(await command('GET',`/session/${session}/screenshot`),'base64'));
  await command('POST',`/session/${session}/window`,{handle:appearanceWindow});await command('POST',`/session/${session}/refresh`,{});
  await wait("return document.querySelector('#overlay-size')?.value==='75'");await run("document.querySelector('#overlay-defaults').click()");await wait("return document.querySelector('#status').textContent.includes('外观已保存')");
  await command('DELETE',`/session/${session}/window`);await command('POST',`/session/${session}/window`,{handle:imageWindow});
  await wait("return document.querySelector('[data-bl-owned=image-overlay]').style.getPropertyValue('--bl-opacity')==='1'");
  await run("document.querySelector('[data-bl-owned=image-button]').shadowRoot.querySelector('#reset-layout').click()");const restored=await bubbleBox();assert.ok(Math.abs(restored.x-bb.x)<1);assert.ok(Math.abs(restored.width-bb.width)<1);assert.equal(imageRequests,2);
  console.log('PASS Firefox handles and appearance: pointer move/resize, opacity without fading text, saved defaults, manual geometry retention and reset with no inference.');
  await go(base);await wait("return document.querySelector('[data-bl-owned=controls]')?.shadowRoot.querySelector('#text-scope')?.disabled===false");
  await run("const s=document.querySelector('[data-bl-owned=controls]').shadowRoot.querySelector('#text-scope');s.value='page';s.dispatchEvent(new Event('change'))");
  // Reopen Options to verify the persisted preference independently of page UI.
  await command('POST',`/session/${session}/moz/context`,{context:'chrome'});
  await run("gBrowser.selectedBrowser.loadURI(Services.io.newURI(arguments[0]),{triggeringPrincipal:Services.scriptSecurityManager.getSystemPrincipal()})",[`moz-extension://${uuid}/options.html`]);
  await command('POST',`/session/${session}/moz/context`,{context:'content'});
  await wait("return document.querySelector('#text-scope')?.value==='page'");
  await wait("return document.querySelector('#save-profile')?.disabled===false");
  await run("document.querySelector('#translation-context').value='Test game terminology';document.querySelector('#translation-glossary').value='garden = 庭园';document.querySelector('#save-profile').click()");
  await wait("return document.querySelector('#status').textContent.includes('术语与背景已保存')");
  await go(base);await wait("return document.querySelector('[data-bl-owned=controls]')?.shadowRoot.querySelector('#text-scope')?.value==='page'");
  await run("document.querySelector('[data-bl-owned=controls]').shadowRoot.querySelector('button').click()");
  await wait("return document.querySelectorAll('.bl-translation').length===6");assert.equal(await run('return scrollY'),0);
  assert.ok(completions.at(-1).messages[0].content.includes('庭园'));assert.ok(completions.at(-1).messages[0].content.includes('Test game terminology'));
  await writeFile('evidence/firefox-page-mode.png',Buffer.from(await command('GET',`/session/${session}/screenshot`),'base64'));
  console.log('PASS Firefox page mode: persisted preference, Options display, offscreen paragraph translated without scrolling.');
  await go(`${base}/cards`);await wait("return document.querySelector('[data-bl-owned=controls]')?.shadowRoot.querySelector('#text-scope')?.value==='page'");
  await run("document.querySelector('[data-bl-owned=controls]').shadowRoot.querySelector('button').click()");await wait("return document.querySelectorAll('.bl-translation').length===5");
  await run("document.querySelector('[data-bl-owned=controls]').shadowRoot.querySelector('#text-mode').click()");
  assert.ok(await run("return ['cover-one','cover-two','inline-cover','background-cover','bookmark'].every(id=>{const r=document.getElementById(id).getBoundingClientRect();return r.width>0&&r.height>0})"));
  await run("document.querySelector('#bookmark').click();document.querySelector('#cover-link').click()");assert.equal(await run("return document.querySelector('#bookmark').dataset.clicks"),'1');assert.equal(await run('return location.hash'),'#cover-one');
  await writeFile('evidence/firefox-novel-cards.png',Buffer.from(await command('GET',`/session/${session}/screenshot`),'base64'));
  await run("document.querySelector('[data-bl-owned=controls]').shadowRoot.querySelector('button').click()");assert.equal(await run("return document.querySelectorAll('.bl-translation').length"),0);
  console.log('PASS Firefox novel cards: covers, media and buttons remain visible and functional in whole-page translated-only mode.');
  console.log(`PASS Firefox ${created.capabilities.browserVersion} MV3: configuration, models, lazy text, CORS image, bubbles, toggle, real pointer snip drag and precise crop overlay; ${textRequests} text + ${imageRequests} full + ${snippetRequests} snip mock requests.`);
}catch(e){console.error('Firefox UI state:',await run("return {url:location.href,optionsStatus:document.querySelector('#status')?.textContent,status:document.querySelector('[data-bl-owned=controls]')?.shadowRoot.querySelector('p')?.textContent,imageButton:document.querySelector('[data-bl-owned=image-button]')?.shadowRoot.querySelector('button')?.textContent}").catch(()=>null),{textRequests,imageRequests,downloads,pixiv:pixiv.requests});throw e;}finally{if(session)await command('DELETE',`/session/${session}`).catch(()=>{});driver.kill();await pixiv.close();await new Promise(r=>server.close(r));}
