// SPDX-License-Identifier: GPL-3.0-only
// Optional live CDN acceptance. Uses a synthetic Pixiv-origin test page, the
// specified real CDN image, and a LOCAL model mock. No paid API request is made.
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';

const url=new URL(process.env.PIXIV_IMAGE_URL || '');
if(url.protocol!=='https:'||!url.hostname.endsWith('.pximg.net'))throw new Error('Set PIXIV_IMAGE_URL to a real HTTPS pximg image.');
const imageCalls=[];
const server=createServer(async(req,res)=>{
  res.setHeader('Content-Type','application/json');
  if(req.url==='/models'){res.end(JSON.stringify({data:[{id:'mock',architecture:{input_modalities:['image','text']}}]}));return;}
  let raw='';for await(const chunk of req)raw+=chunk;
  const body=JSON.parse(raw);imageCalls.push(body);
  const snippet=body.messages[1].content[0].text.includes('框内');
  res.end(JSON.stringify({choices:[{message:{content:JSON.stringify(snippet?{original:'fixture',translated:'下载裁切验证'}:[{original:'fixture',translated:'下载验证',bbox:[100,100,300,300]}])}}]}));
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const profile=await mkdtemp(resolve(tmpdir(),'bilingual-pixiv-live-'));
let context;
try{
  const extension=resolve('dist/chrome-mv3');
  context=await chromium.launchPersistentContext(profile,{channel:'chromium',...(process.env.TEST_BROWSER_PATH?{executablePath:process.env.TEST_BROWSER_PATH}:{}),headless:true,viewport:{width:1100,height:1000},args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`,...(process.env.TEST_NETWORK_PROXY?[`--proxy-server=${process.env.TEST_NETWORK_PROXY}`]:[])]});
  const worker=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker');
  const before=await worker.evaluate(async u=>(await fetch(u,{cache:'no-store',signal:AbortSignal.timeout(30000)})).status,url.href);
  assert.equal(before,403);
  const options=await context.newPage();await options.goto(`chrome-extension://${new URL(worker.url()).host}/options.html`);
  await options.locator('[name=baseUrl]').fill(`http://127.0.0.1:${server.address().port}`);
  await options.locator('[name=apiKey]').fill('mock-key');await options.getByRole('button',{name:'连接并查询模型'}).click();await options.getByRole('status').filter({hasText:'连接成功'}).waitFor();
  const page=await context.newPage();
  const fixture='https://www.pixiv.net/artworks/extension-download-test';
  await page.route(fixture,route=>route.fulfill({contentType:'text/html; charset=utf-8',body:`<body style="margin:30px"><div style="width:650px"><img style="width:100%;display:block" src="${url.href.replaceAll('&','&amp;').replaceAll('"','&quot;')}"></div></body>`}));
  await page.goto(fixture);await page.locator('img').evaluate(img=>img.decode());
  await page.locator('img').hover();await page.getByRole('button',{name:'全文翻译',exact:true}).click();await page.locator('.bubble').first().waitFor({timeout:35000});
  await page.locator('img').hover({position:{x:5,y:5}});await page.getByRole('button',{name:'手动框选',exact:true}).click();
  const b=await page.locator('img').boundingBox();await page.mouse.move(b.x+b.width*.5,b.y+b.height*.1);await page.mouse.down();await page.mouse.move(b.x+b.width*.8,b.y+b.height*.3,{steps:5});await page.mouse.up();
  await page.locator('.bubble').filter({hasText:'下载裁切验证'}).waitFor({timeout:35000});assert.equal(imageCalls.length,2);
  const sizes=[];
  for(const call of imageCalls){const data=call.messages[1].content[1].image_url.url;const dimensions=await page.evaluate(async value=>{const img=new Image();img.src=value;await img.decode();return[img.width,img.height];},data);assert.ok(Math.max(...dimensions)<=1280);sizes.push(dimensions);}
  const after=await worker.evaluate(async u=>{const r=await fetch(u,{cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(30000)});return {status:r.status,type:r.headers.get('Content-Type'),bytes:(await r.arrayBuffer()).byteLength};},url.href);
  assert.equal(after.status,200);
  console.log(JSON.stringify({before,after,full:sizes[0],snippet:sizes[1],modelCalls:'2 local mock calls',paidCost:0}));
} finally {await context?.close();await new Promise(r=>server.close(r));await rm(profile,{recursive:true,force:true});}
