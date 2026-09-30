// SPDX-License-Identifier: GPL-3.0-only
// Explicitly paid acceptance of the actual unified client. Two calls, no secret files.
import { build } from 'esbuild';
import { chromium } from '@playwright/test';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const key=process.env.OPENROUTER_API_KEY,model=process.env.LIVE_MODEL??'deepseek/deepseek-v4.1-flash';
if(!key||!process.argv[2])throw new Error('Set OPENROUTER_API_KEY and pass one sample image path.');
if(!['deepseek/deepseek-v4.1-flash','inclusionai/ling-3.0-flash-vl'].includes(model))throw new Error('Model outside cost allowlist.');
const bundled=await build({entryPoints:['lib/api.ts'],bundle:true,write:false,platform:'node',format:'esm'});
const client=await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].contents).toString('base64')}`);
const settings={baseUrl:'https://openrouter.ai/api/v1',apiKey:key,textModel:model,visionModel:model,targetLang:'简体中文'};
const models=await client.listModels(settings),selected=models.find(m=>m.id===model);
assert.ok(selected?.vision&&!selected.mandatoryReasoning);
const browser=await chromium.launch({executablePath:process.env.TEST_BROWSER_PATH,headless:true});
let image;
try{
  const page=await browser.newPage();
  image=await page.evaluate(async data=>{const img=new Image();img.src=data;await img.decode();const c=document.createElement('canvas'),k=Math.min(1,1280/Math.max(img.width,img.height));c.width=Math.round(img.width*k);c.height=Math.round(img.height*k);c.getContext('2d').drawImage(img,0,0,c.width,c.height);return c.toDataURL('image/jpeg',.85);},`data:image/png;base64,${(await readFile(process.argv[2])).toString('base64')}`);
}finally{await browser.close();}
const records=[],nativeFetch=globalThis.fetch;
globalThis.fetch=async(url,init)=>{
  if(records.length>=2)throw new Error('Paid request cap reached.');
  const body=JSON.parse(init.body);assert.equal(body.max_tokens,1500);assert.equal(body.temperature,.1);assert.deepEqual(body.reasoning,{enabled:false});assert.ok(!body.extra_body);
  const start=Date.now(),response=await nativeFetch(url,init),data=await response.clone().json();
  records.push({kind:records.length?'image':'text',status:response.status,seconds:(Date.now()-start)/1000,parameters:{model,reasoning:body.reasoning,max_tokens:body.max_tokens,temperature:body.temperature},usage:data.usage,finish_reason:data.choices?.[0]?.finish_reason});
  return response;
};
try{
  await client.complete(settings,model,[{role:'system',content:'Translate into Simplified Chinese. Return ONLY JSON {"translated":"..."}.'},{role:'user',content:'A good translation connects people across cultures.'}]);
  await client.complete(settings,model,[{role:'system',content:'Read the Japanese speech in this comic. Return ONLY a JSON array of short Chinese translations. Do not invent text.'},{role:'user',content:[{type:'text',text:'Translate the visible speech.'},{type:'image_url',image_url:{url:image}}]}]);
  for(const r of records){assert.equal(r.usage.completion_tokens_details.reasoning_tokens,0);assert.ok(r.usage.completion_tokens<=1500);assert.ok(r.usage.cost<.001);}
  console.log('PASS live client:',JSON.stringify(records));
}finally{
  await mkdir('evidence',{recursive:true});await writeFile(`evidence/live-v2-phase1-${model.startsWith('deepseek')?'deepseek':'ling'}.json`,JSON.stringify({model,records},null,2));
}
