import { it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { candidates, chunks, TextTranslator } from '../lib/text-dom';
import { translateText } from '../lib/text-api';
import { hideOriginal } from '../lib/text-view';
const settings={baseUrl:'https://openrouter.ai/api/v1',apiKey:'mock-key',targetLang:'简体中文',textModel:'test',visionModel:'test'};
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();vi.restoreAllMocks();document.body.innerHTML='';});
it('batches paragraphs into the chat completions route, deduplicates and caches',async()=>{
  const fetch=vi.fn().mockImplementation(async (_url,init)=>{
    const body=JSON.parse(init.body); const input=JSON.parse(body.messages[1].content);
    return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify(input.map((x:any)=>({id:x.id,translated:'译文 '+x.text})))}}]})};
  }); vi.stubGlobal('fetch',fetch);
  const items=[{id:'a',text:'Hello world'},{id:'b',text:'Hello world'}];
  expect(await translateText(settings,items)).toHaveLength(2); await translateText(settings,items);
  expect(fetch).toHaveBeenCalledTimes(1); expect(fetch.mock.calls[0]![0]).toContain('/chat/completions');
  expect(JSON.parse(JSON.parse(fetch.mock.calls[0]![1].body).messages[1].content)).toHaveLength(1);
});
it('skips nested, editable and excluded content; safely splits long text',()=>{
  document.body.innerHTML='<li><p>One paragraph</p></li><p translate="no">Do not send</p><div contenteditable><p>Private draft</p></div><pre><p>code</p></pre>';
  expect(candidates()).toHaveLength(1); expect(chunks('a'.repeat(2500)).map(x=>x.length)).toEqual([1200,1200,100]);
});
it('renders four visible paragraphs, defers offscreen text and removes translations on stop',async()=>{
  vi.useFakeTimers(); document.documentElement.innerHTML=readFileSync('tests/fixtures/text.html','utf8');
  let intersect: IntersectionObserverCallback;
  vi.stubGlobal('IntersectionObserver',class{ constructor(cb:IntersectionObserverCallback){intersect=cb} observe(){} unobserve(){} disconnect(){} });
  vi.spyOn(HTMLElement.prototype,'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
  const send=vi.fn(async(items)=>items.map((i:any)=>({id:i.id,translated:'中文：'+i.text})));
  const controller=new TextTranslator(send,()=>{}); controller.start();
  const paragraphs=Array.from(document.querySelectorAll('p'));
  intersect!(paragraphs.slice(0,4).map(target=>({target,isIntersecting:true})) as unknown as IntersectionObserverEntry[],{} as IntersectionObserver);
  await vi.advanceTimersByTimeAsync(300);
  expect(document.querySelectorAll('.bl-translation')).toHaveLength(4);
  expect(document.querySelector('.below')!.nextElementSibling).toBeNull();
  expect(paragraphs[0]!.textContent).toBe('The morning sun lights up the small garden.');
  controller.toggleMode();expect(paragraphs[0]!.style.display).toBe('none');expect((document.querySelector('.below') as HTMLElement).style.display).toBe('');
  controller.toggleMode();expect(paragraphs[0]!.style.display).toBe('');
  intersect!([{target:paragraphs[4]!,isIntersecting:true} as unknown as IntersectionObserverEntry],{} as IntersectionObserver);
  await vi.advanceTimersByTimeAsync(300); expect(document.querySelectorAll('.bl-translation')).toHaveLength(5);
  controller.toggleMode();controller.stop(); expect(document.querySelectorAll('.bl-translation')).toHaveLength(0);expect(paragraphs[0]!.style.display).toBe('');
  vi.restoreAllMocks();
});
it('restores list/table text nodes and event handlers after translated-only mode',()=>{
  document.body.innerHTML='<ul><li>Original <a href="#">link</a></li></ul>';
  const li=document.querySelector('li')!,link=document.querySelector('a')!,clicked=vi.fn();link.addEventListener('click',clicked);
  const t=document.createElement('div');t.textContent='译文';li.append(t);const reset=hideOriginal(li,t);
  expect(link.style.display).toBe('none');expect(t.style.display).toBe('');expect(li.querySelector('[data-bl-owned=source-wrapper]')).not.toBeNull();
  reset();expect(li.firstChild!.textContent).toBe('Original ');expect(link.style.display).toBe('');link.click();expect(clicked).toHaveBeenCalledTimes(1);
});
it('translates all loaded paragraphs without intersection events, in bounded sequential batches',async()=>{
  vi.useFakeTimers();
  document.body.innerHTML=Array.from({length:13},(_,i)=>`<p>Paragraph number ${i}.</p>`).join('')+'<p hidden>Do not send hidden text</p><p style="display:none">CSS hidden</p><pre><p>Do not send code</p></pre>';
  vi.stubGlobal('IntersectionObserver',class{observe(){}unobserve(){}disconnect(){}});
  vi.spyOn(HTMLElement.prototype,'getClientRects').mockImplementation(function(this:HTMLElement){return(this.style.display==='none'?[]:[{}]) as unknown as DOMRectList;});
  const send=vi.fn(async(items)=>items.map((i:any)=>({id:i.id,translated:'译文：'+i.text}))),report=vi.fn();
  const controller=new TextTranslator(send,report);controller.setScope('page');controller.start();
  await vi.advanceTimersByTimeAsync(1200);
  expect(send.mock.calls.map(c=>c[0].length)).toEqual([6,6,1]);expect(document.querySelectorAll('.bl-translation')).toHaveLength(13);
  expect(report).toHaveBeenCalledWith('当前已加载页面翻译完成。');controller.stop();
});
it('changes scope without retranslating completed paragraphs and handles newly loaded content',async()=>{
  vi.useFakeTimers();document.body.innerHTML='<p>First paragraph</p><p>Below the viewport</p>';
  let intersect:IntersectionObserverCallback;
  vi.stubGlobal('IntersectionObserver',class{constructor(cb:IntersectionObserverCallback){intersect=cb}observe(){}unobserve(){}disconnect(){}});
  vi.spyOn(HTMLElement.prototype,'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
  const send=vi.fn(async(items)=>items.map((i:any)=>({id:i.id,translated:'译文：'+i.text})));
  const controller=new TextTranslator(send,()=>{});controller.start();
  intersect!([{target:document.querySelector('p'),isIntersecting:true}] as unknown as IntersectionObserverEntry[],{} as IntersectionObserver);
  await vi.advanceTimersByTimeAsync(300);expect(document.querySelectorAll('.bl-translation')).toHaveLength(1);
  controller.setScope('page');await vi.advanceTimersByTimeAsync(300);expect(document.querySelectorAll('.bl-translation')).toHaveLength(2);expect(send.mock.calls[1]![0]).toEqual([{id:'0',text:'Below the viewport'}]);
  controller.setScope('viewport');const p=document.createElement('p');p.textContent='New offscreen paragraph';document.body.append(p);
  await vi.advanceTimersByTimeAsync(900);expect(send).toHaveBeenCalledTimes(2);
  controller.setScope('page');await vi.advanceTimersByTimeAsync(300);expect(send).toHaveBeenCalledTimes(3);expect(document.querySelectorAll('.bl-translation')).toHaveLength(3);controller.stop();
});
it('rejects mismatched model IDs and does not inject model HTML',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({choices:[{message:{content:'[{"id":"wrong","translated":"bad"}]'}}]})}));
  await expect(translateText({...settings,textModel:'invalid-response'},[{id:'good',text:'New passage'}])).rejects.toThrow('格式');
});
