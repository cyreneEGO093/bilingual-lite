// SPDX-License-Identifier: GPL-3.0-only
// Optional live-site layout acceptance; all translations come from a local mock.
// No account cookie is imported, and neither source text nor images are saved.
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { mkdtemp,rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
const url=new URL(process.env.PIXIV_NOVEL_URL||'');
if(url.origin!=='https://www.pixiv.net'||url.pathname!=='/novel/show.php')throw new Error('Set PIXIV_NOVEL_URL to a Pixiv novel page.');
let calls=0;
const server=createServer(async(req,res)=>{
  res.setHeader('Content-Type','application/json');
  if(req.url==='/models'){res.end(JSON.stringify({data:[{id:'mock'}]}));return;}
  let raw='';for await(const chunk of req)raw+=chunk;
  const body=JSON.parse(raw),items=JSON.parse(body.messages[1].content);calls++;
  res.end(JSON.stringify({choices:[{message:{content:JSON.stringify(items.map(i=>({id:i.id,translated:'本地译文布局验证。'})))}}]}));
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const profile=await mkdtemp(resolve(tmpdir(),'bilingual-novel-live-'));let context;
try{
  const extension=resolve('dist/chrome-mv3');
  context=await chromium.launchPersistentContext(profile,{channel:'chromium',...(process.env.TEST_BROWSER_PATH?{executablePath:process.env.TEST_BROWSER_PATH}:{}),headless:true,viewport:{width:1300,height:1000},args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`,...(process.env.TEST_NETWORK_PROXY?[`--proxy-server=${process.env.TEST_NETWORK_PROXY}`]:[])]});
  const worker=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker');
  const options=await context.newPage();await options.goto(`chrome-extension://${new URL(worker.url()).host}/options.html`);
  await options.locator('[name=baseUrl]').fill(`http://127.0.0.1:${server.address().port}`);await options.locator('[name=apiKey]').fill('mock-key');
  await options.getByRole('button',{name:'连接并查询模型'}).click();await options.getByRole('status').filter({hasText:'连接成功'}).waitFor();await options.locator('#text-scope').selectOption('page');
  const page=await context.newPage();await page.goto(url.href,{waitUntil:'domcontentloaded',timeout:45000});await page.locator('li img').first().waitFor({timeout:25000});await page.waitForTimeout(3000);
  const before=await page.evaluate(()=>{
    window.__coverChecks=[...document.querySelectorAll('li')].filter(el=>el.querySelector('img')&&!el.querySelector('p,h1,h2,h3,h4,h5,h6,li,article,blockquote,figcaption,td,th')&&el.textContent.trim().length>=3)
      .map(card=>({card,img:card.querySelector('img')})).filter(({img})=>img.getBoundingClientRect().width>0&&img.getBoundingClientRect().height>0);
    return window.__coverChecks.map(({img})=>{const r=img.getBoundingClientRect();return {width:r.width,height:r.height,loaded:img.naturalWidth>0};});
  });assert.ok(before.length>0,'a visible image-bearing card must exist');
  await page.getByRole('button',{name:'译 · 开启翻译',exact:true}).click();
  await page.waitForFunction(()=>window.__coverChecks.every(({card})=>card.querySelector(':scope > .bl-translation')),{},{timeout:45000});
  await page.getByRole('button',{name:'仅看译文',exact:true}).click();
  const after=await page.evaluate(()=>window.__coverChecks.map(({card,img})=>{const r=img.getBoundingClientRect();return {connected:img.isConnected,translation:!!card.querySelector(':scope > .bl-translation'),width:r.width,height:r.height};}));
  for(let i=0;i<after.length;i++){assert.equal(after[i].connected,true);assert.equal(after[i].translation,true);assert.ok(Math.abs(after[i].width-before[i].width)<1);assert.ok(Math.abs(after[i].height-before[i].height)<1);}
  await page.getByRole('button',{name:'显示双语',exact:true}).click();await page.getByRole('button',{name:'译 · 关闭翻译',exact:true}).click();
  assert.equal(await page.locator('.bl-translation').count(),0);
  console.log(JSON.stringify({cards:before.length,before,after,localMockCalls:calls,paidCost:0,result:'PASS actual Pixiv novel: covers retain original dimensions in translated-only mode'}));
}finally{await context?.close();await new Promise(r=>server.close(r));await rm(profile,{recursive:true,force:true});}
