// Optional real Pixiv DOM acceptance. Inference is entirely local and synthetic;
// page content is neither printed nor saved, and no account cookie is imported.
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { mkdtemp,rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
const url=new URL(process.env.PIXIV_NOVEL_URL||'');
if(url.origin!=='https://www.pixiv.net'||url.pathname!=='/novel/show.php')throw new Error('Set PIXIV_NOVEL_URL to a Pixiv novel page.');
let calls=0,injected=false,recovered=false;const failedText=new Set();
const server=createServer(async(req,res)=>{
  try{
    res.setHeader('Content-Type','application/json');
    if(req.url==='/models'){res.end(JSON.stringify({data:[{id:'mock'}]}));return;}
    let raw='';for await(const chunk of req)raw+=chunk;
    const body=JSON.parse(raw),items=JSON.parse(body.messages[1].content);calls++;
    assert.equal(body.response_format.json_schema.name,'text_translations');assert.equal(body.max_tokens,1500);
    const rows=items.map(i=>({id:i.id,translated:'本地模拟译文，用于验证异常恢复与页面布局。'}));
    if(calls===2){injected=true;items.forEach(i=>failedText.add(i.text));rows[0].translated='';}
    else if(items.some(i=>failedText.has(i.text)))recovered=true;
    res.end(JSON.stringify({choices:[{message:{content:JSON.stringify({translations:rows})}}]}));
  }catch{res.statusCode=500;res.end('{}');}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const profile=await mkdtemp(resolve(tmpdir(),'bilingual-novel-recovery-'));let context;
try{
  const extension=resolve('dist/chrome-mv3');
  context=await chromium.launchPersistentContext(profile,{channel:'chromium',...(process.env.TEST_BROWSER_PATH?{executablePath:process.env.TEST_BROWSER_PATH}:{}),headless:true,viewport:{width:1300,height:1000},args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`,...(process.env.TEST_NETWORK_PROXY?[`--proxy-server=${process.env.TEST_NETWORK_PROXY}`]:[])]});
  const worker=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker');
  const options=await context.newPage();await options.goto(`chrome-extension://${new URL(worker.url()).host}/options.html`);
  await options.locator('[name=baseUrl]').fill(`http://127.0.0.1:${server.address().port}`);await options.locator('[name=apiKey]').fill('mock-key');
  await options.getByRole('button',{name:'连接并查询模型'}).click();await options.getByRole('status').filter({hasText:'连接成功'}).waitFor();await options.locator('#text-scope').selectOption('page');
  const page=await context.newPage();await page.goto(url.href,{waitUntil:'domcontentloaded',timeout:45000});await page.locator('li img').first().waitFor({timeout:25000});
  await page.waitForTimeout(1500);
  const controls=page.locator('[data-bl-owned=controls]');
  await controls.getByRole('button',{name:'译 · 开启翻译',exact:true}).click();await controls.locator('#text-mode').click();
  await controls.locator('#text-retry').waitFor({state:'visible',timeout:30000});assert.equal(injected,true);
  await page.evaluate(()=>{window.__firstTranslation=document.querySelector('.bl-translation');window.scrollTo(0,document.body.scrollHeight);});
  await page.waitForTimeout(2000);assert.equal(await controls.locator('#text-mode').textContent(),'显示双语');
  assert.equal(await controls.getByRole('button',{name:'译 · 关闭翻译',exact:true}).isVisible(),true);
  const before=await page.locator('.bl-translation').count();assert.ok(before>0);
  assert.ok(await page.evaluate(()=>window.__firstTranslation?.isConnected));
  assert.equal(recovered,false,'failed text is not automatically resent during scrolling');
  await controls.locator('#text-retry').click();await controls.locator('#text-retry').waitFor({state:'hidden'});
  await page.waitForFunction(()=>document.querySelectorAll('.bl-translation').length>0);
  // Wait for the explicit retry to finish; the button hides when work is queued.
  for(let i=0;i<100&&!recovered;i++)await page.waitForTimeout(100);
  assert.equal(recovered,true);
  await page.waitForFunction(before=>document.querySelectorAll('.bl-translation').length>before,before,{timeout:10000});
  assert.ok(await page.evaluate(()=>window.__firstTranslation?.isConnected));
  const after=await page.locator('.bl-translation').count();
  await controls.getByRole('button',{name:'译 · 关闭翻译',exact:true}).click();assert.equal(await page.locator('.bl-translation').count(),0);
  console.log(JSON.stringify({url:url.href,localMockCalls:calls,failedFragments:failedText.size,beforeRetry:before,afterRetry:after,paidCost:0,result:'PASS real Pixiv DOM: full-page translated-only scrolling preserves completed translations after injected malformed output, manual retry recovers failed text'}));
}finally{await context?.close();await new Promise(r=>server.close(r));await rm(profile,{recursive:true,force:true});}
