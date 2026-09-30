// Opt-in real API acceptance. One or two user-supplied images, no retries.
// Key comes only from this process environment and temporary extension storage.
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
const paths=process.argv.slice(2),key=process.env.OPENROUTER_API_KEY;
const model=process.env.LIVE_MODEL??'inclusionai/ling-3.0-flash-vl';
if(!['inclusionai/ling-3.0-flash-vl','deepseek/deepseek-v4.1-flash'].includes(model))throw new Error('Model is outside the live test cost allowlist.');
const label=process.env.LIVE_LABEL??'';
if(!/^[a-z0-9-]*$/.test(label))throw new Error('Invalid LIVE_LABEL.');
const suffix=(model.startsWith('deepseek/')?'deepseek':'ling')+(label?`-${label}`:'');
if(!paths.length||paths.length>2||!key)throw new Error('Requires OPENROUTER_API_KEY and one or two image paths.');
const records=[];let attempts=0;let blocked=false;
const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');
    if(url.pathname==='/image.png'){res.setHeader('Content-Type','image/png');res.end(await readFile(paths[Number(url.searchParams.get('n'))]));return;}
    if(url.pathname==='/v1/chat/completions'){
      if(blocked||++attempts>2){res.statusCode=429;res.end('{}');return;}
      let raw='';for await(const part of req)raw+=part;const body=JSON.parse(raw);
      assert.equal(body.model,model);assert.ok(body.max_tokens<=3500);assert.equal(body.messages[1].content[1].type,'image_url');
      const start=Date.now();
      const response=await fetch('https://openrouter.ai/api/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(60000)});
      const data=await response.json();
      const record={sample:attempts,httpStatus:response.status,model:data.model??body.model,seconds:Math.round((Date.now()-start)/100)/10,usage:data.usage??null,content:data.choices?.[0]?.message?.content??null,...(!response.ok?{error:String(data.error?.message??'API error').replaceAll(key,'[redacted]')}:{})};
      records.push(record);await writeFile(`evidence/live-${suffix}-results.json`,JSON.stringify({checkedAt:new Date().toISOString(),maxRequests:2,records},null,2));
      if(!response.ok){blocked=true;console.log(`Live API HTTP ${response.status}; stopping paid requests.`);}
      res.statusCode=response.status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(response.ok?data:{error:{code:response.status}}));return;
    }
    const n=Number(url.searchParams.get('n')??0);
    res.setHeader('Content-Type','text/html; charset=utf-8');res.end(`<html><head><title>样图 ${n+1} · 实际视觉翻译</title></head><body style="margin:24px;background:#f4f6f0;font-family:system-ui"><h2>样图 ${n+1} · ${model}</h2><div style="width:${n?900:700}px"><img alt="User test image" src="/image.png?n=${n}" style="display:block;width:100%;height:auto"></div></body></html>`);
  }catch(e){blocked=true;res.statusCode=502;res.end('{}');console.error('Live test request failed:',e.name);}
});
await mkdir('evidence',{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`,profile=await mkdtemp(resolve(tmpdir(),'bilingual-live-'));let context;
try{
  const extension=resolve('.output/chrome-mv3');context=await chromium.launchPersistentContext(profile,{channel:'chromium',...(process.env.TEST_BROWSER_PATH?{executablePath:process.env.TEST_BROWSER_PATH}:{}),headless:true,viewport:{width:1100,height:1450},args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
  const worker=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker');
  // Use the actual options page to save BYOK settings in the temporary profile.
  const options=await context.newPage();await options.goto(`chrome-extension://${new URL(worker.url()).host}/options.html`);
  await options.locator('[name=baseUrl]').fill(`${base}/v1`);await options.locator('[name=apiKey]').fill(key);await options.locator('[name=visionModel]').fill(model);await options.getByRole('button',{name:'保存设置',exact:true}).click();await options.getByRole('status').filter({hasText:'已保存'}).waitFor();
  const page=await context.newPage();
  for(let n=0;n<paths.length&&!blocked;n++){
    await page.goto(`${base}/?n=${n}`);await page.locator('img').evaluate(img=>img.decode());await page.locator('img').hover({position:{x:30,y:30}});await page.getByRole('button',{name:'翻译图片',exact:true}).click();
    await page.waitForFunction(()=>{const host=document.querySelector('[data-bl-owned="controls"]');const text=host?.shadowRoot?.querySelector('p')?.textContent??'';return !text.includes('正在')&&text.length>0;},{},{timeout:75000});
    const status=await page.locator('[data-bl-owned="controls"]').locator('p').textContent();
    console.log(`Sample ${n+1}: ${status}`);await page.screenshot({path:`evidence/live-${suffix}-sample-${n+1}.png`,fullPage:true});
    if(records[n])records[n].renderedBubbles=await page.locator('.bubble').count();
  }
  const knownCost=records.reduce((sum,r)=>sum+(typeof r.usage?.cost==='number'?r.usage.cost:0),0);
  const summary={checkedAt:new Date().toISOString(),maxRequests:2,attempts,reportedCostUSD:records.every(r=>typeof r.usage?.cost==='number')?knownCost:null,records};
  await writeFile(`evidence/live-${suffix}-results.json`,JSON.stringify(summary,null,2));console.log(JSON.stringify({attempts,reportedCostUSD:summary.reportedCostUSD,statuses:records.map(r=>r.httpStatus)}));
}finally{await context?.close();await new Promise(r=>server.close(r));await rm(profile,{recursive:true,force:true});}
