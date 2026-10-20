// SPDX-License-Identifier: GPL-3.0-only
// Optional paid test. Synthetic text only; credentials remain in process memory.
// Requires curl on PATH. Set OPENROUTER_API_KEY; optionally LIVE_SOCKS_PROXY.
import { build } from 'esbuild';
import { execFile } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { socialTranslations } from './social-scenario.mjs';
const key=process.env.OPENROUTER_API_KEY,model='deepseek/deepseek-v4.1-flash';
if(!key)throw new Error('Set OPENROUTER_API_KEY for this explicitly paid test.');
const records=[],quote=s=>`"${s.replaceAll('\\','\\\\').replaceAll('"','\\"').replaceAll('\r','\\r').replaceAll('\n','\\n')}"`;
// Pass headers and payload through stdin, never curl command-line arguments.
function curl(url,init={}){
  const config=[`request = ${quote(init.method??'GET')}`,...Object.entries(init.headers??{}).map(([k,v])=>`header = ${quote(`${k}: ${v}`)}`),...(init.body?[`data-binary = ${quote(init.body)}`]:[])].join('\n');
  return new Promise((resolve,reject)=>{
    const child=execFile('curl',['--silent','--show-error','--connect-timeout','15','--max-time','60',...(process.env.LIVE_SOCKS_PROXY?['--proxy',process.env.LIVE_SOCKS_PROXY]:[]),'--config','-','--write-out','\n%{http_code}',url],{windowsHide:true,timeout:65000,maxBuffer:4*1024*1024,signal:init.signal},(error,stdout)=>{
      if(error){reject(new Error('Live request failed or timed out; no automatic paid retry.'));return;}
      const at=stdout.lastIndexOf('\n');resolve(new Response(stdout.slice(0,at),{status:Number(stdout.slice(at+1))}));
    });
    child.stdin.on('error',()=>{});child.stdin.end(config);
  });
}
const catalogResponse=await curl('https://openrouter.ai/api/v1/models');
assert.ok(catalogResponse.ok);
const catalog=(await catalogResponse.json()).data.find(m=>m.id===model);
assert.ok(catalog&&!catalog.reasoning?.mandatory&&catalog.supported_parameters?.includes('structured_outputs'));
const inputPrice=Number(catalog.pricing.prompt),outputPrice=Number(catalog.pricing.completion);
assert.ok(Number.isFinite(inputPrice)&&Number.isFinite(outputPrice)&&inputPrice>=0&&outputPrice>=0);
// Very conservative input allowance for these small synthetic batches. Refuse
// an unexpectedly expensive catalog entry before making a completion request.
assert.ok(2*(10000*inputPrice+1500*outputPrice)<.01,'Two-call estimated upper bound must be below $0.01.');
globalThis.fetch=async(url,init)=>{
  assert.equal(url,'https://openrouter.ai/api/v1/chat/completions');
  assert.ok(records.length<2,'Maximum two paid HTTP attempts, including retries.');
  const body=JSON.parse(init.body);
  assert.equal(body.model,model);assert.equal(body.max_tokens,1500);assert.equal(body.temperature,.1);
  assert.deepEqual(body.reasoning,{enabled:false});assert.ok(body.response_format.json_schema.strict);
  const record={attempt:records.length+1};records.push(record);
  const start=Date.now(),response=await curl(url,init),data=await response.clone().json();
  Object.assign(record,{status:response.status,seconds:(Date.now()-start)/1000,finishReason:data.choices?.[0]?.finish_reason,usage:{promptTokens:data.usage?.prompt_tokens,completionTokens:data.usage?.completion_tokens,reasoningTokens:data.usage?.completion_tokens_details?.reasoning_tokens,costUSD:data.usage?.cost}});
  return response;
};
const bundle=await build({entryPoints:['lib/text-api.ts'],bundle:true,write:false,platform:'node',format:'esm'});
const {translateText}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString('base64')}`);
const settings={baseUrl:'https://openrouter.ai/api/v1',apiKey:key,textModel:model,visionModel:model,targetLang:'简体中文'};
const samples=Object.keys(socialTranslations).map((text,i)=>({id:String(i),text}));
let failure;
try{
  for(const custom of [false,true]){
    const result=await translateText(settings,samples,undefined,custom?{text:'Translate all Korean and Japanese sentences into natural {{targetLang}}. Keep short replies concise.',image:'',snippet:''}:undefined);
    assert.equal(result.length,samples.length);
    assert.ok(result.every(r=>/[\p{Script=Han}]/u.test(r.translated)&&r.translated!==samples.find(s=>s.id===r.id).text));
    records.at(-1).customPrompt=custom;records.at(-1).translations=result;
    assert.equal(records.at(-1).usage.reasoningTokens,0);
    assert.ok(records.at(-1).usage.completionTokens<=1500);
    assert.ok(Number.isFinite(records.at(-1).usage.costUSD)&&records.at(-1).usage.costUSD<.001);
  }
}catch(error){failure=error instanceof Error?error.message:'Test failed';}
const report={model,checkedAt:new Date().toISOString(),syntheticOnly:true,pricing:catalog.pricing,records,success:!failure,...(failure?{failure}:{})};
await writeFile('evidence/live-text-0.6.2.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(failure)process.exitCode=1;
