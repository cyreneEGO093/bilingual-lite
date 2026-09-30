import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';

const requests=[];
const imageRequests=[],snippetRequests=[];let imageDownloads=0;
const bubbles=[{original:"HELLO, FRIEND! LET'S READ TOGETHER.",translated:'你好，朋友！一起阅读吧。',bbox:[100,90,320,430]},{original:'A NEW WORLD IS WAITING FOR US.',translated:'一个新世界正在等待我们。',bbox:[560,560,780,920]}];
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
    if(req.url==='/manga.png'||req.url==='/protected.png'){
      // No ACAO. Simulate an anti-hotlink policy that rejects foreign referrers;
      // the protected route also requires a page referrer, so background fetch fails.
      if((req.headers.referer&&new URL(req.headers.referer).hostname!=='127.0.0.1')||(req.url==='/protected.png'&&!req.headers.referer)){res.statusCode=403;res.end('Forbidden');return;}
      imageDownloads++;res.setHeader('Content-Type','image/png');res.end(await readFile('tests/fixtures/manga.png'));return;
    }
    if(req.url==='/protected'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(`<div style="width:800px"><img style="width:100%" src="http://localhost:${server.address().port}/protected.png"></div>`);return;}
    if(req.url==='/manga'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(`<html><head><title>Manga test</title></head><body style="margin:50px;background:#f4f6f0"><h1>漫画翻译 · 本地 Mock 验证</h1><div id="panel" style="width:800px"><img alt="Test manga" style="display:block;width:100%;height:auto" src="http://localhost:${server.address().port}/manga.png"></div></body></html>`);return;}
    if(req.url==='/v1/models') {res.setHeader('Content-Type','application/json');res.end(JSON.stringify({data:[{id:'mock-vision',architecture:{input_modalities:['text','image']},context_length:1000000,pricing:{prompt:'0'}}]}));return;}
    if(req.url==='/v1/chat/completions') {
      let raw=''; for await(const part of req) raw+=part; const body=JSON.parse(raw);
      if(Array.isArray(body.messages[1].content)){const snippet=body.messages[1].content[0].text.includes('框内');(snippet?snippetRequests:imageRequests).push(body);assert.equal(body.max_tokens,1500);assert.deepEqual(body.reasoning,{enabled:false});res.setHeader('Content-Type','application/json');res.end(JSON.stringify({choices:[{message:{content:JSON.stringify(snippet?{original:'Test crop',translated:'局部测试译文'}:bubbles)}}]}));return;}
      requests.push(body);
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
  const optionsUrl=`chrome-extension://${new URL(worker.url()).host}/options.html`;
  const options=await context.newPage(); await options.goto(optionsUrl,{waitUntil:'domcontentloaded',timeout:15000});
  await options.locator('[name=baseUrl]').fill(`${base}/v1`);
  await options.locator('[name=apiKey]').fill('mock-key');
  await options.getByRole('button',{name:'连接并查询模型'}).click();
  try { await options.getByRole('status').filter({hasText:'连接成功'}).waitFor({timeout:10000}); }
  catch(e) { console.error('Options status:',await options.getByRole('status').textContent());throw e; }
  const page=await context.newPage(); await page.goto(base);
  assert.equal((await fetch(`${base}/manga.png`,{headers:{Referer:'https://foreign.example/'}})).status,403);
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
  await page.goto(`${base}/manga`);await page.locator('img').evaluate(img=>img.decode());
  await page.locator('img').hover();await page.getByRole('button',{name:'全文翻译',exact:true}).click();
  await page.locator('.bubble').first().waitFor();assert.equal(await page.locator('.bubble').count(),2);
  assert.equal(imageRequests.length,1);assert.equal(imageDownloads,2,'one page image load and one background cross-origin download');
  const imageData=imageRequests[0].messages[1].content[1].image_url.url;
  const dimensions=await page.evaluate(async data=>{const img=new Image();img.src=data;await img.decode();return[img.naturalWidth,img.naturalHeight];},imageData);
  assert.deepEqual(dimensions,[1280,800]);
  const checkAlignment=async()=>{const img=await page.locator('img').boundingBox();const box=await page.locator('.bubble').first().boundingBox();assert.ok(Math.abs(box.x-img.x-img.width*.09)<2);assert.ok(Math.abs(box.y-img.y-img.height*.1)<2);};
  await checkAlignment();await page.screenshot({path:'evidence/manga-overlay.png'});
  await page.locator('#panel').evaluate(el=>el.style.width='600px');await page.waitForTimeout(100);await checkAlignment();
  await page.locator('img').hover();await page.getByRole('button',{name:'清除遮罩'}).click();assert.equal(await page.locator('.bubble').first().isVisible(),false);
  await page.getByRole('button',{name:'恢复遮罩'}).click();assert.equal(imageRequests.length,1);
  await page.getByRole('button',{name:'校准位置',exact:true}).click();
  const before=await page.locator('.bubble').first().boundingBox();
  await page.mouse.move(before.x+before.width/2,before.y+before.height/2);await page.mouse.down();await page.mouse.move(before.x+before.width/2+30,before.y+before.height/2+20,{steps:5});await page.mouse.up();
  const moved=await page.locator('.bubble').first().boundingBox();assert.ok(Math.abs(moved.x-before.x-30)<2);assert.ok(Math.abs(moved.y-before.y-20)<2);
  await page.keyboard.down('Shift');await page.mouse.move(moved.x+moved.width/2,moved.y+moved.height/2);await page.mouse.down();await page.mouse.move(moved.x+moved.width/2+25,moved.y+moved.height/2+15,{steps:5});await page.mouse.up();await page.keyboard.up('Shift');
  const resized=await page.locator('.bubble').first().boundingBox();assert.ok(Math.abs(resized.width-moved.width-25)<2);assert.ok(Math.abs(resized.height-moved.height-15)<2);
  await page.locator('img').hover({position:{x:10,y:10}});await page.getByRole('button',{name:'完成校准',exact:true}).click();assert.equal(imageRequests.length,1,'manual calibration does not call API');
  await page.getByRole('button',{name:'手动框选',exact:true}).click();await page.locator('[data-bl-owned=snip]').waitFor();await page.keyboard.press('Escape');assert.equal(await page.locator('[data-bl-owned=snip]').count(),0);assert.equal(snippetRequests.length,0);
  await page.locator('img').hover({position:{x:10,y:10}});await page.getByRole('button',{name:'手动框选',exact:true}).click();
  const ib=await page.locator('img').boundingBox();
  await page.mouse.move(ib.x+ib.width*.9,ib.y+ib.height*.4);await page.mouse.down();await page.mouse.move(ib.x+ib.width*.65,ib.y+ib.height*.2,{steps:6});await page.mouse.up();
  await page.locator('.bubble').filter({hasText:'局部测试译文'}).waitFor();assert.equal(snippetRequests.length,1);
  const cropDimensions=await page.evaluate(async data=>{const img=new Image();img.src=data;await img.decode();return[img.width,img.height];},snippetRequests[0].messages[1].content[1].image_url.url);assert.deepEqual(cropDimensions,[400,200]);
  const checkCrop=async()=>{const i=await page.locator('img').boundingBox(),b=await page.locator('.bubble').filter({hasText:'局部测试译文'}).boundingBox();assert.ok(Math.abs(b.x-i.x-i.width*.65)<2);assert.ok(Math.abs(b.y-i.y-i.height*.2)<2);assert.ok(Math.abs(b.width-i.width*.25)<2);assert.ok(Math.abs(b.height-i.height*.2)<2);};
  await checkCrop();await page.locator('#panel').evaluate(el=>el.style.width='720px');await page.waitForTimeout(100);await checkCrop();await page.screenshot({path:'evidence/snip-overlay.png'});
  await page.locator('img').hover({position:{x:10,y:10}});await page.getByRole('button',{name:'全文翻译',exact:true}).click();assert.equal(imageRequests.length,1,'full result is cached');
  await page.goto(`${base}/protected`);await page.locator('img').evaluate(img=>img.decode());await page.locator('img').hover();await page.getByRole('button',{name:'全文翻译',exact:true}).click();
  await page.getByRole('status').filter({hasText:'403'}).waitFor();assert.equal(imageRequests.length,1,'protected download failure must not spend inference tokens');
  console.log('PASS image: CORS/hotlink fallback and 403, 1280x800 full image, 400x200 crop, reverse drag, Escape cancellation, exact snip placement, resize, hide/show, cached full; 1 full + 1 snippet mock call.');
  console.log('PASS Chromium MV3: settings, models, 4 visible paragraphs + heading, lazy scroll, dynamic DOM, cleanup, cache, manual bubble move/resize; 3 mock calls; paid cost $0.');
} finally { await context?.close();await new Promise(r=>server.close(r));await rm(profile,{recursive:true,force:true}); }
