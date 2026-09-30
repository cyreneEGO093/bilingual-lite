import { it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { candidates, chunks, TextTranslator } from '../lib/text-dom';
import { translateText } from '../lib/text-api';
const settings={endpoint:'https://openrouter.ai/api/v1',apiKey:'mock-key',language:'简体中文',textModel:'test',imageModel:'test'};
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();document.body.innerHTML='';});
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
  intersect!([{target:paragraphs[4]!,isIntersecting:true} as unknown as IntersectionObserverEntry],{} as IntersectionObserver);
  await vi.advanceTimersByTimeAsync(300); expect(document.querySelectorAll('.bl-translation')).toHaveLength(5);
  controller.stop(); expect(document.querySelectorAll('.bl-translation')).toHaveLength(0);
  vi.restoreAllMocks();
});
it('rejects mismatched model IDs and does not inject model HTML',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({choices:[{message:{content:'[{"id":"wrong","translated":"bad"}]'}}]})}));
  await expect(translateText({...settings,textModel:'invalid-response'},[{id:'good',text:'New passage'}])).rejects.toThrow('格式');
});
