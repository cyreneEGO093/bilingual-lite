// Firefox acceptance via the documented WebDriver API and Mozilla temporary add-on API.
// TEST_FIREFOX_PATH and GECKODRIVER_PATH must point to dedicated test binaries.
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import net from 'node:net';
async function freePort(){const socket=net.createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));return port;}
if(!process.env.TEST_FIREFOX_PATH||!process.env.GECKODRIVER_PATH)throw new Error('Set TEST_FIREFOX_PATH and GECKODRIVER_PATH.');
let textRequests=0,imageRequests=0,downloads=0;
const server=createServer(async(req,res)=>{
  try{
    if(req.url==='/v1/models'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({data:[{id:'mock-vision',architecture:{input_modalities:['image','text']}}]}));return;}
    if(req.url==='/v1/chat/completions'){
      let raw='';for await(const part of req)raw+=part;const body=JSON.parse(raw);assert.equal(req.headers.authorization,'Bearer mock-key');
      const isImage=Array.isArray(body.messages[1].content);isImage?imageRequests++:textRequests++;
      const result=isImage?[{original:'Hello friend',translated:'你好，朋友！一起阅读吧。',bbox:[100,90,320,430]},{original:'A new world',translated:'新世界正在等待我们。',bbox:[560,560,780,920]}]:JSON.parse(body.messages[1].content).map(i=>({id:i.id,translated:'中文译文：'+i.text}));
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
const driver=spawn(process.env.GECKODRIVER_PATH,['--port',String(port),'--allow-system-access'],{windowsHide:true,stdio:['ignore','pipe','pipe']});
let session;
const command=async(method,path,body)=>{const response=await fetch(`http://127.0.0.1:${port}${path}`,{method,...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(45000)});const data=await response.json();if(!response.ok)throw new Error(JSON.stringify(data.value));return data.value;};
const run=(script,args=[])=>command('POST',`/session/${session}/execute/sync`,{script,args});
const wait=async(script,timeout=10000)=>{const deadline=Date.now()+timeout;while(Date.now()<deadline){if(await run(script))return;await new Promise(r=>setTimeout(r,100));}throw new Error(`Firefox assertion timeout: ${script}`);};
const go=url=>command('POST',`/session/${session}/url`,{url});
try{
  await new Promise((resolve,reject)=>{driver.stdout.on('data',chunk=>{if(chunk.toString().includes('Listening on'))resolve();});driver.on('error',reject);setTimeout(()=>reject(new Error('geckodriver startup timeout')),10000).unref();});
  const uuid='59fae133-0e40-4cd1-b538-6c7a6c402b16';
  const created=await command('POST','/session',{capabilities:{alwaysMatch:{browserName:'firefox','moz:firefoxOptions':{binary:process.env.TEST_FIREFOX_PATH,args:['-headless'],prefs:{'extensions.webextensions.uuids':JSON.stringify({'bilingual-lite@example.org':uuid})}}}}});session=created.sessionId;
  await command('POST',`/session/${session}/window/rect`,{width:1100,height:1000});
  await command('POST',`/session/${session}/moz/addon/install`,{path:resolve('.output/firefox-mv3'),temporary:true});
  await command('POST',`/session/${session}/moz/context`,{context:'chrome'});
  await run("gBrowser.selectedTab=gBrowser.addTab(arguments[0],{triggeringPrincipal:Services.scriptSecurityManager.getSystemPrincipal()});",[`moz-extension://${uuid}/options.html`]);
  await command('POST',`/session/${session}/moz/context`,{context:'content'});
  const handles=await command('GET',`/session/${session}/window/handles`);await command('POST',`/session/${session}/window`,{handle:handles.at(-1)});
  await wait("return !!document.querySelector('[name=textModel]')?.value");
  await run("document.querySelector('[name=endpoint]').value=arguments[0];document.querySelector('[name=apiKey]').value='mock-key';document.querySelector('#models').click();",[`${base}/v1`]);
  await wait("return document.querySelector('#status').textContent.includes('连接成功')");
  await go(base);await wait("return !!document.querySelector('[data-bl-owned=controls]')");
  await run("document.querySelector('[data-bl-owned=controls]').shadowRoot.querySelector('button').click()");
  await wait("return document.querySelectorAll('.bl-translation').length===5");assert.equal(textRequests,1);
  await run("document.querySelector('.below').scrollIntoView()");await wait("return !!document.querySelector('.below + .bl-translation')");assert.equal(textRequests,2);
  await mkdir('evidence',{recursive:true});
  await run('window.scrollTo(0,0)');await writeFile('evidence/firefox-text.png',Buffer.from(await command('GET',`/session/${session}/screenshot`),'base64'));
  await go(`${base}/manga`);await wait('return document.querySelector("img").naturalWidth>0');
  await run("document.querySelector('img').dispatchEvent(new PointerEvent('pointerover',{bubbles:true}));document.querySelector('[data-bl-owned=image-button]').shadowRoot.querySelector('button').click()");
  await wait("return document.querySelector('[data-bl-owned=image-overlay]')?.shadowRoot.querySelectorAll('.bubble').length===2",15000);
  assert.equal(imageRequests,1);assert.equal(downloads,2);
  const aligned=await run("const i=document.querySelector('img').getBoundingClientRect(),b=document.querySelector('[data-bl-owned=image-overlay]').shadowRoot.querySelector('.bubble').getBoundingClientRect();return Math.abs(b.x-i.x-i.width*.09)<2 && Math.abs(b.y-i.y-i.height*.1)<2");assert.ok(aligned);
  await writeFile('evidence/firefox-manga.png',Buffer.from(await command('GET',`/session/${session}/screenshot`),'base64'));
  await run("document.querySelector('[data-bl-owned=image-button]').shadowRoot.querySelector('button').click()");assert.ok(await run("return document.querySelector('[data-bl-owned=image-overlay]').hidden"));
  console.log(`PASS Firefox ${created.capabilities.browserVersion} MV3: configuration, models, lazy text, cross-origin image, positioned bubbles, toggle; ${textRequests} text + ${imageRequests} image mock requests.`);
}catch(e){console.error('Firefox UI state:',await run("return {url:location.href,optionsStatus:document.querySelector('#status')?.textContent,status:document.querySelector('[data-bl-owned=controls]')?.shadowRoot.querySelector('p')?.textContent,imageButton:document.querySelector('[data-bl-owned=image-button]')?.shadowRoot.querySelector('button')?.textContent}").catch(()=>null),{textRequests,imageRequests,downloads});throw e;}finally{if(session)await command('DELETE',`/session/${session}`).catch(()=>{});driver.kill();await new Promise(r=>server.close(r));}
