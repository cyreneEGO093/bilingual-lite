import { afterEach, expect, it, vi } from 'vitest';
import { translateText, clearTextCache, type TextItem } from '../lib/text-api';
import { TextTranslator } from '../lib/text-dom';
import { OutputFormatError } from '../lib/translation-error';

const settings={baseUrl:'https://openrouter.ai/api/v1',apiKey:'mock-key',targetLang:'简体中文',textModel:'deepseek/deepseek-v4.1-flash',visionModel:'test'};
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();vi.restoreAllMocks();clearTextCache();document.body.innerHTML='';});
function mockResponse(value:unknown){return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify(value)}}]})};}
function mockPage(count:number){
  vi.useFakeTimers();document.body.innerHTML=Array.from({length:count},(_,i)=>`<p>Paragraph ${i}</p>`).join('');
  vi.stubGlobal('IntersectionObserver',class{observe(){}unobserve(){}disconnect(){}});
  vi.spyOn(HTMLElement.prototype,'getClientRects').mockImplementation(function(this:HTMLElement){return(this.style.display==='none'?[]:[{}]) as unknown as DOMRectList;});
}
const valid=(items:TextItem[])=>items.map(i=>({id:i.id,translated:'译文：'+i.text}));

it('uses strict text schema and accepts reordered numeric IDs without swapping translations',async()=>{
  const fetch=vi.fn().mockResolvedValue(mockResponse({translations:[{id:1,translated:'第二段'},{id:0,translated:'第一段'}]}));vi.stubGlobal('fetch',fetch);
  expect(await translateText(settings,[{id:'source-a',text:'First'},{id:'source-z',text:'Second'}])).toEqual([{id:'source-a',translated:'第一段'},{id:'source-z',translated:'第二段'}]);
  const body=JSON.parse(fetch.mock.calls[0]![1].body);
  expect(body).toMatchObject({response_format:{type:'json_schema',json_schema:{name:'text_translations',strict:true}},provider:{require_parameters:true},reasoning:{enabled:false},max_tokens:1500,temperature:0.1});
  expect(body.response_format.json_schema.schema.properties.translations.items.properties.id.enum).toEqual(['0','1']);
});
it('uses dense IDs after cache hits and deduplication, preserving caller IDs',async()=>{
  const fetch=vi.fn().mockImplementation(async(_url,init)=>mockResponse({translations:JSON.parse(JSON.parse(init.body).messages[1].content).map((i:TextItem)=>({id:i.id,translated:'译文 '+i.text}))}));vi.stubGlobal('fetch',fetch);
  await translateText(settings,[{id:'5',text:'Already cached'}]);
  const items=[{id:'0',text:'Already cached'},{id:'2',text:'New one'},{id:'3',text:'New one'},{id:'5',text:'New two'}];
  expect(await translateText(settings,items)).toEqual(items.map(i=>({id:i.id,translated:'译文 '+i.text})));
  expect(JSON.parse(JSON.parse(fetch.mock.calls[1]![1].body).messages[1].content)).toEqual([{id:'0',text:'New one'},{id:'1',text:'New two'}]);
});
it.each([
  [{id:'0',translated:'valid'},{id:0,translated:'duplicate'}],
  [{id:'0',translated:'valid'},{id:'2',translated:'unknown'}],
  [{id:'0',translated:'valid'},{id:'1',translated:' '}],
  [{id:'0',translated:'valid'},{id:'1',translated:null}],
  [{id:'0',translated:'valid'}],
].map(rows=>({rows})))('rejects invalid rows atomically without caching or automatically retrying',async({rows})=>{
  const fetch=vi.fn().mockResolvedValue(mockResponse({translations:rows}));vi.stubGlobal('fetch',fetch);
  const items=[{id:'0',text:'One'},{id:'1',text:'Two'}];
  await expect(translateText(settings,items)).rejects.toBeInstanceOf(OutputFormatError);expect(fetch).toHaveBeenCalledTimes(1);
  fetch.mockResolvedValue(mockResponse(valid(items)));await translateText(settings,items);
  expect(JSON.parse(JSON.parse(fetch.mock.calls[1]![1].body).messages[1].content)).toHaveLength(2);
});
it('does not force schema on custom models, retaining fenced array compatibility',async()=>{
  const fetch=vi.fn().mockResolvedValue({ok:true,json:async()=>({choices:[{message:{content:'```json\n[{"id":"0","translated":"译文"}]\n```'}}]})});vi.stubGlobal('fetch',fetch);
  expect(await translateText({...settings,textModel:'custom'},[{id:'arbitrary',text:'Test'}])).toEqual([{id:'arbitrary',translated:'译文'}]);
  expect(JSON.parse(fetch.mock.calls[0]![1].body).response_format).toBeUndefined();
});
it('isolates one invalid batch while translated-only and scrolling DOM updates remain active',async()=>{
  mockPage(19);
  const send=vi.fn(async(items:TextItem[])=>valid(items));send.mockImplementationOnce(async items=>valid(items)).mockRejectedValueOnce(new OutputFormatError('译文格式无效，请重试。'));
  const controller=new TextTranslator(send,()=>{});controller.setScope('page');controller.start();controller.toggleMode();
  await vi.advanceTimersByTimeAsync(1600);
  expect(controller.enabled).toBe(true);expect(controller.onlyTranslated).toBe(true);expect(controller.paused).toBe(false);expect(controller.failedCount).toBe(6);
  expect(send).toHaveBeenCalledTimes(4);expect(document.querySelectorAll('.bl-translation')).toHaveLength(13);
  const originals=[...document.querySelectorAll('p')];expect(originals[0]!.style.display).toBe('none');expect(originals[6]!.style.display).toBe('');
  const firstTranslation=document.querySelector('.bl-translation');
  const p=document.createElement('p');p.textContent='Newly loaded after scrolling';document.body.append(p);await vi.advanceTimersByTimeAsync(1000);
  expect(send).toHaveBeenCalledTimes(5);expect(p.nextElementSibling?.className).toBe('bl-translation');
  await vi.advanceTimersByTimeAsync(2000);expect(send).toHaveBeenCalledTimes(5);
  controller.retryFailed();await vi.advanceTimersByTimeAsync(1000);
  expect(send).toHaveBeenCalledTimes(6);expect(send.mock.calls[5]![0].map(i=>i.text)).toEqual(originals.slice(6,12).map(p=>p.textContent));
  expect(controller.failedCount).toBe(0);expect(document.querySelectorAll('.bl-translation')).toHaveLength(20);expect(document.querySelector('.bl-translation')).toBe(firstTranslation);
  controller.stop();expect(document.querySelectorAll('.bl-translation')).toHaveLength(0);expect(originals[0]!.style.display).toBe('');
});
it('pauses after three consecutive format failures instead of exhausting the page',async()=>{
  mockPage(60);const send=vi.fn().mockRejectedValue(new OutputFormatError('bad output'));
  const controller=new TextTranslator(send,()=>{});controller.setScope('page');controller.start();await vi.advanceTimersByTimeAsync(5000);
  expect(send).toHaveBeenCalledTimes(3);expect(controller.enabled).toBe(true);expect(controller.paused).toBe(true);expect(controller.failedCount).toBe(18);
  document.body.append(document.createElement('p'));controller.setScope('viewport');controller.setScope('page');await vi.advanceTimersByTimeAsync(5000);expect(send).toHaveBeenCalledTimes(3);controller.stop();
});
it.each(['HTTP 401','HTTP 402','HTTP 429','timeout','refusal','1500 Token limit'])('pauses %s while preserving completed paragraphs and supports manual resume',async message=>{
  mockPage(13);const send=vi.fn(async(items:TextItem[])=>valid(items)).mockImplementationOnce(async items=>valid(items)).mockRejectedValueOnce(new Error(message));
  const controller=new TextTranslator(send,()=>{});controller.setScope('page');controller.start();controller.toggleMode();await vi.advanceTimersByTimeAsync(5000);
  expect(send).toHaveBeenCalledTimes(2);expect(controller.paused).toBe(true);expect(controller.onlyTranslated).toBe(true);expect(document.querySelectorAll('.bl-translation')).toHaveLength(6);
  controller.retryFailed();await vi.advanceTimersByTimeAsync(1500);expect(send).toHaveBeenCalledTimes(4);expect(document.querySelectorAll('.bl-translation')).toHaveLength(13);expect(controller.paused).toBe(false);controller.stop();
});
it('does not partially render a malformed batch, nor apply an old failed response after restart',async()=>{
  mockPage(6);let reject!:(e:Error)=>void;
  const send=vi.fn().mockResolvedValueOnce([{id:'0',translated:'one'}]).mockImplementationOnce(()=>new Promise((_resolve,rejectFn)=>{reject=rejectFn;})).mockImplementation(async(items:TextItem[])=>valid(items));
  const controller=new TextTranslator(send,()=>{});controller.setScope('page');controller.start();await vi.advanceTimersByTimeAsync(800);
  expect(document.querySelectorAll('.bl-translation')).toHaveLength(0);expect(controller.failedCount).toBe(6);
  controller.retryFailed();await vi.advanceTimersByTimeAsync(300);controller.stop();controller.start();reject(new OutputFormatError('stale'));await vi.advanceTimersByTimeAsync(800);
  expect(controller.failedCount).toBe(0);expect(controller.paused).toBe(false);expect(document.querySelectorAll('.bl-translation')).toHaveLength(6);controller.stop();
});
