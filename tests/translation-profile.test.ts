// SPDX-License-Identifier: GPL-3.0-only
import { it, expect, vi, afterEach } from 'vitest';
import { parseGlossary, validateTranslationProfile, terminologyPrompt } from '../lib/translation-profile';
import { translateText, clearTextCache } from '../lib/text-api';
import { translateImage, translateSnippet } from '../lib/image-api';
const settings={baseUrl:'https://openrouter.ai/api/v1',apiKey:'mock-key',targetLang:'简体中文',textModel:'test',visionModel:'test'};
afterEach(()=>{vi.unstubAllGlobals();clearTextCache();});
it('accepts explicit aliases and separators, deduplicates identical entries and rejects conflicts',()=>{
  expect(parseGlossary('Nora = 诺拉\nノラ → 诺拉\nNora = 诺拉\nMage\t法师')).toEqual([{source:'Nora',target:'诺拉'},{source:'ノラ',target:'诺拉'},{source:'Mage',target:'法师'}]);
  expect(()=>parseGlossary('Nora=诺拉\nNora=另一人')).toThrow('不同译名');expect(()=>parseGlossary('missing mapping')).toThrow('第 1 行');
});
it('bounds reference input and omits unrelated text terms without an extra model call',()=>{
  expect(()=>validateTranslationProfile({context:'x'.repeat(501),glossary:''})).toThrow('500');
  expect(()=>parseGlossary('x'.repeat(3001))).toThrow('3000');
  expect(()=>parseGlossary(Array.from({length:101},(_,i)=>`x${i}=y`).join('\n'))).toThrow('100');
  const p={context:'A fantasy game',glossary:'Nora=诺拉\nMage=法师'};
  expect(terminologyPrompt(p,'Nora walks.')).toContain('诺拉');expect(terminologyPrompt(p,'Nora walks.')).not.toContain('法师');
  expect(terminologyPrompt(p)).toContain('法师');expect(terminologyPrompt({context:'',glossary:''})).toBe('');
});
it('includes profile in text cache identity and adds context and matched terms to the request',async()=>{
  const fetch=vi.fn().mockResolvedValue({ok:true,json:async()=>({choices:[{message:{content:'[{"id":"0","translated":"测试译文"}]'}}]})});vi.stubGlobal('fetch',fetch);
  const items=[{id:'0',text:'Nora is a Mage.'}];
  const profile={context:'A fantasy game',glossary:'Nora=诺拉\nMage=法师'};
  await translateText(settings,items,profile);await translateText(settings,items,profile);expect(fetch).toHaveBeenCalledTimes(1);
  const body=JSON.parse(fetch.mock.calls[0]![1].body);expect(body.messages[0].content).toContain('A fantasy game');expect(body.messages[0].content).toContain('法师');expect(body.max_tokens).toBe(1500);expect(body.reasoning).toEqual({enabled:false});
  await translateText(settings,items,{...profile,glossary:'Nora=诺菈\nMage=法师'});expect(fetch).toHaveBeenCalledTimes(2);
});
it('applies the same terminology to full image and snippet without altering original recognition',async()=>{
  const original='Nora';let content=JSON.stringify([{original,translated:'诺拉',bbox:[100,100,300,300]}]);
  const fetch=vi.fn().mockImplementation(async()=>({ok:true,json:async()=>({choices:[{message:{content}}]})}));vi.stubGlobal('fetch',fetch);
  const profile={context:'Test game',glossary:'Nora = 诺拉'};
  expect((await translateImage(settings,'data:image/jpeg;base64,YQ==',profile))[0]!.original).toBe(original);
  content=JSON.stringify({original,translated:'诺拉'});expect((await translateSnippet(settings,'data:image/jpeg;base64,YQ==',profile)).original).toBe(original);
  for(const call of fetch.mock.calls){const body=JSON.parse(call[1].body);expect(body.messages[1].content[0].text).toContain('诺拉');expect(body.messages[1].content[0].text).toContain('transcribe original literally');expect(body.max_tokens).toBe(1500);}
});
