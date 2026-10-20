// SPDX-License-Identifier: GPL-3.0-only
import { afterEach, expect, it, vi } from 'vitest';
import { candidates, textOf, TextTranslator } from '../lib/text-dom';
import { clearTextCache, translateText, type TextItem, type TextResult } from '../lib/text-api';
import { copiedForeignProse } from '../lib/text-quality';
import { OutputFormatError } from '../lib/translation-error';

const korean='오늘은 작은 정원에서 새로운 꽃을 보았습니다.';
const japanese='今日は小さな庭で新しい花を見つけました。';
const card=(body:string)=>`<article data-testid="tweet"><div>Example @example <time>5h</time></div><div data-testid="tweetText">${body}</div><div><img src="cover.png"><button>Like 123</button><span>456 views</span></div></article>`;
const controllers:TextTranslator[]=[];
afterEach(()=>{controllers.splice(0).forEach(c=>c.stop());vi.useRealTimers();vi.unstubAllGlobals();vi.restoreAllMocks();clearTextCache();document.body.innerHTML='';});
function setup(html=card(korean)){
  vi.useFakeTimers();document.body.innerHTML=html;
  let intersect:IntersectionObserverCallback;
  vi.stubGlobal('IntersectionObserver',class{constructor(cb:IntersectionObserverCallback){intersect=cb}observe(){}unobserve(){}disconnect(){}});
  vi.spyOn(HTMLElement.prototype,'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
  const send=vi.fn(async(items:TextItem[])=>items.map(i=>({id:i.id,translated:'本地译文：'+i.text})));
  const controller=new TextTranslator(send,()=>{});controllers.push(controller);
  return {controller,send,visible:(target:Element)=>intersect!([{target,isIntersecting:true}] as IntersectionObserverEntry[],{} as IntersectionObserver)};
}
it('extracts only post bodies, preserving line breaks, links, short replies and quoted posts',()=>{
  document.body.innerHTML=card(`Hello <a href="#">world</a><br><span>${korean}</span>`)+card('はい')+card(japanese);
  document.querySelector('article')!.append(document.querySelectorAll('article')[2]!);
  document.body.insertAdjacentHTML('beforeend','<article data-testid="tweet"><div>Metadata only</div></article><p>Ordinary paragraph</p><div contenteditable><div data-testid="tweetText">Private draft</div></div>');
  expect(candidates().map(textOf)).toEqual([`Hello world\n${korean}`,japanese,'はい','Ordinary paragraph']);
});
it.each(['page','viewport'] as const)('handles %s mode, recycled bodies, late hydration and removed translations',async scope=>{
  const {controller,send,visible}=setup();controller.setScope(scope);controller.start();
  const body=document.querySelector<HTMLElement>('[data-testid=tweetText]')!;
  visible(body);await vi.advanceTimersByTimeAsync(600);
  expect(send.mock.calls[0]![0]).toEqual([{id:'0',text:korean}]);
  controller.toggleMode();
  expect(body.style.display).toBe('none');
  expect(document.querySelector('article')!.style.display).not.toBe('none');
  expect(document.querySelector('img')!.style.display).not.toBe('none');
  body.nextElementSibling!.remove();await vi.advanceTimersByTimeAsync(700);
  expect(body.nextElementSibling?.textContent).toBe('本地译文：'+korean);expect(send).toHaveBeenCalledTimes(1);
  body.textContent=japanese;await vi.advanceTimersByTimeAsync(350);visible(body);await vi.advanceTimersByTimeAsync(600);
  expect(body.nextElementSibling?.textContent).toBe('本地译文：'+japanese);
  expect(send).toHaveBeenCalledTimes(2);
  const article=document.createElement('article');article.dataset.testid='tweet';article.innerHTML='<div>Metadata only</div>';document.body.append(article);
  await vi.advanceTimersByTimeAsync(600);expect(send).toHaveBeenCalledTimes(2);
  const hydrated=document.createElement('div');hydrated.textContent='New late-loaded body.';article.append(hydrated);
  await vi.advanceTimersByTimeAsync(600);expect(send).toHaveBeenCalledTimes(2);
  hydrated.dataset.testid='tweetText';await vi.advanceTimersByTimeAsync(350);visible(hydrated);await vi.advanceTimersByTimeAsync(600);
  expect(hydrated.nextElementSibling?.textContent).toBe('本地译文：New late-loaded body.');
  expect(send).toHaveBeenCalledTimes(3);
});
it('does not starve new posts during continuous unrelated mutations',async()=>{
  const {controller,send}=setup('<div id="clock">0</div>');controller.setScope('page');controller.start();
  document.body.insertAdjacentHTML('beforeend',card(japanese));
  for(let i=0;i<20;i++){document.querySelector('#clock')!.textContent=String(i);await vi.advanceTimersByTimeAsync(100);}
  expect(send).toHaveBeenCalledTimes(1);expect(document.querySelectorAll('.bl-translation')).toHaveLength(1);
});
it('ignores an in-flight reply for a body recycled before the mutation scan',async()=>{
  const {controller,send}=setup();let resolve!:(value:TextResult[])=>void;
  send.mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));controller.setScope('page');controller.start();await vi.advanceTimersByTimeAsync(260);
  document.querySelector('[data-testid=tweetText]')!.textContent=japanese;
  resolve([{id:'0',translated:'Stale response'}]);await vi.advanceTimersByTimeAsync(1);
  expect(document.querySelector('.bl-translation')).toBeNull();
  await vi.advanceTimersByTimeAsync(1000);
  expect(document.querySelector('.bl-translation')?.textContent).toBe('本地译文：'+japanese);
  expect(send).toHaveBeenCalledTimes(2);
});
it.each([korean,japanese])('rejects copied foreign prose without caching it or retrying automatically',async source=>{
  const settings={baseUrl:'https://openrouter.ai/api/v1',apiKey:'mock-key',targetLang:'简体中文',textModel:'deepseek/deepseek-v4.1-flash',visionModel:'test'};
  let text=source;
  const fetch=vi.fn(async()=>({ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({translations:[{id:'0',translated:text}]})}}]})}));
  vi.stubGlobal('fetch',fetch);
  await expect(translateText(settings,[{id:'a',text:source}])).rejects.toBeInstanceOf(OutputFormatError);
  expect(fetch).toHaveBeenCalledTimes(1);
  text='今天在小花园看到了新的花朵。';
  expect(await translateText(settings,[{id:'a',text:source}])).toEqual([{id:'a',translated:text}]);
  expect(fetch).toHaveBeenCalledTimes(2);
});
it('leaves names, already-Chinese text, other target languages and actual translations alone',()=>{
  for(const text of ['アイドルマスター','小花园今天很漂亮。','@example #テスト https://example.test/','はい','12345'])expect(copiedForeignProse(text,text,'简体中文')).toBe(false);
  expect(copiedForeignProse(korean,korean,'한국어')).toBe(false);
  expect(copiedForeignProse(japanese,japanese,'日本語')).toBe(false);
  expect(copiedForeignProse(japanese,'今天在小花园里发现了新的花。','简体中文')).toBe(false);
  expect(copiedForeignProse(korean,` ${korean} `,'繁體中文')).toBe(true);
});
