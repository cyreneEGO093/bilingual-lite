import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';

const requests=[];
const translations={
  'A quieter way to read':'更安静的阅读方式',
  'The morning sun lights up the small garden.':'清晨的阳光照亮了小花园。',
  'We learn something new every time we open a book.':'每次翻开书，我们都会学到新知识。',
  'A good translation connects people across cultures.':'好的翻译连接不同文化中的人们。',
  'Keep the original words and discover another perspective.':'保留原文，发现另一种视角。',
  'This paragraph should only translate after scrolling.':'这一段应该只在滚动后翻译。'
};
const server=createServer(async(req,res)=>{
  try {
    if(req.url==='/v1/models') {res.setHeader('Content-Type','application/json');res.end(JSON.stringify({data:[{id:'mock-vision',architecture:{input_modalities:['text','image']},context_length:1000000,pricing:{prompt:'0'}}]}));return;}
    if(req.url==='/v1/chat/completions') {
      let raw=''; for await(const part of req) raw+=part; const body=JSON.parse(raw);requests.push(body);
      assert.equal(req.headers.authorization,'Bearer mock-key');
      const items=JSON.parse(body.messages[1].content);
      res.setHeader('Content-Type','application/json');res.end(JSON.stringify({choices:[{message:{content:JSON.stringify(items.map(i=>({id:i.id,translated:translations[i.text]??'动态译文：'+i.text})))}}]}));return;
    }
    res.setHeader('Content-Type','text/html; charset=utf-8');res.end(await readFile('tests/fixtures/text.html'));
  } catch(e) {res.statusCode=500;res.end(String(e));}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`;
const profile=await mkdtemp(resolve(tmpdir(),'bilingual-test-'));
let context;
try {
  const extension=resolve('.output/chrome-mv3');
  context=await chromium.launchPersistentContext(profile,{channel:'chromium',...(process.env.TEST_BROWSER_PATH?{executablePath:process.env.TEST_BROWSER_PATH}:{}),headless:true,viewport:{width:1100,height:850},args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
  const worker=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker');
  const id=new URL(worker.url()).host;
  const options=await context.newPage(); await options.goto(`chrome-extension://${id}/options.html`);
  await options.locator('[name=endpoint]').fill(`${base}/v1`);
  await options.locator('[name=apiKey]').fill('mock-key');
  await options.getByRole('button',{name:'连接并查询模型'}).click();
  try { await options.getByRole('status').filter({hasText:'连接成功'}).waitFor({timeout:10000}); }
  catch(e) { console.error('Options status:',await options.getByRole('status').textContent());throw e; }
  const page=await context.newPage(); await page.goto(base);
  await page.getByRole('button',{name:'译 · 开启双语',exact:true}).click();
  await page.waitForFunction(()=>document.querySelectorAll('.bl-translation').length===5);
  assert.equal(requests.length,1); assert.equal(JSON.parse(requests[0].messages[1].content).length,5);
  assert.equal(await page.locator('p').first().textContent(),'The morning sun lights up the small garden.');
  assert.equal(await page.locator('.below + .bl-translation').count(),0);
  await mkdir('evidence',{recursive:true}); await page.screenshot({path:'evidence/text-visible.png'});
  await page.locator('.below').scrollIntoViewIfNeeded(); await page.locator('.below + .bl-translation').waitFor();
  assert.equal(requests.length,2);
  await page.evaluate(()=>{const p=document.createElement('p');p.id='dynamic';p.textContent='New dynamic paragraph';document.body.append(p);});
  await page.locator('#dynamic').scrollIntoViewIfNeeded();await page.locator('#dynamic + .bl-translation').waitFor();
  await page.getByRole('button',{name:'译 · 关闭双语',exact:true}).click();
  assert.equal(await page.locator('.bl-translation').count(),0);
  await page.getByRole('button',{name:'译 · 开启双语',exact:true}).click();
  await page.locator('#dynamic + .bl-translation').waitFor();
  assert.equal(requests.length,3,'restart reuses background cache');
  console.log('PASS Chromium MV3: settings, models, 4 visible paragraphs + heading, lazy scroll, dynamic DOM, cleanup, cache; 3 mock calls; paid cost $0.');
} finally { await context?.close();await new Promise(r=>server.close(r));await rm(profile,{recursive:true,force:true}); }
