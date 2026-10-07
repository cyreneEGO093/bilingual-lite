// SPDX-License-Identifier: GPL-3.0-only
import { expect,it,vi,afterEach } from 'vitest';
import { DEFAULT_PROMPTS, EMPTY_PROMPTS, translationPrompt, validateCustomPrompts } from '../lib/custom-prompts';
import { getFloatingScale, saveFloatingScale } from '../lib/floating-preferences';
import { getCustomPrompts, saveCustomPrompts } from '../lib/prompt-preferences';
import { translateText,clearTextCache } from '../lib/text-api';
import { translateImage,translateSnippet } from '../lib/image-api';
const local=vi.hoisted(()=>({get:vi.fn(),set:vi.fn()}));
vi.mock('wxt/browser',()=>({browser:{storage:{local}}}));
const settings={baseUrl:'https://example.com/v1',apiKey:'mock-key',targetLang:'简体中文',textModel:'mock',visionModel:'mock'};
afterEach(()=>{clearTextCache();vi.unstubAllGlobals();vi.clearAllMocks();});
it('migrates missing preferences, validates size, and stores locally',async()=>{
  local.get.mockResolvedValue({});expect(await getFloatingScale()).toBe(100);expect(await getCustomPrompts()).toEqual(EMPTY_PROMPTS);
  for(const value of [74,151,NaN,'100'])await expect(saveFloatingScale(value)).rejects.toThrow();
  await saveFloatingScale(125);expect(local.set).toHaveBeenCalledWith({floatingScale:125});
  local.get.mockResolvedValue({floatingScale:-1});expect(await getFloatingScale()).toBe(100);
});
it('restores empty/default prompts without duplicating built-in text and rejects malformed input',async()=>{
  expect(validateCustomPrompts(DEFAULT_PROMPTS)).toEqual(EMPTY_PROMPTS);
  expect(validateCustomPrompts({text:'  Be concise  '})).toEqual({...EMPTY_PROMPTS,text:'Be concise'});
  for(const value of [null,[],{text:1},{image:'a'.repeat(3001)}])expect(()=>validateCustomPrompts(value)).toThrow();
  await saveCustomPrompts({text:'My instruction'});expect(local.set).toHaveBeenCalledWith({customPrompts:{...EMPTY_PROMPTS,text:'My instruction'}});
});
it('expands the documented variable and retains target language and output contract',()=>{
  const p=translationPrompt('text','日本語',{...EMPTY_PROMPTS,text:'Use {{targetLang}}. No JSON.'});
  expect(p).toContain('Use 日本語');expect(p).not.toContain('{{targetLang}}');expect(p).toContain('output format is mandatory');
});
it('sends text instructions and isolates cache entries when they change',async()=>{
  const fetch=vi.fn().mockResolvedValue({ok:true,json:async()=>({choices:[{message:{content:'[{"id":"0","translated":"你好"}]'}}]})});vi.stubGlobal('fetch',fetch);
  const p={...EMPTY_PROMPTS,text:'Use short sentences.'},items=[{id:'x',text:'Hello.'}];
  await translateText(settings,items,undefined,p);await translateText(settings,items,undefined,p);expect(fetch).toHaveBeenCalledTimes(1);
  const body=JSON.parse(fetch.mock.calls[0]![1].body);expect(body.messages[0].content).toContain(p.text);expect(body.messages[0].content).toContain('Include every input ID');expect(body.max_tokens).toBe(1500);
  await translateText(settings,items,undefined,{...p,text:'Use a formal tone.'});expect(fetch).toHaveBeenCalledTimes(2);
});
it('keeps full-image and snippet instructions separate while retaining schemas',async()=>{
  let content='{"bubbles":[{"original":"Hi","translated":"你好","bbox":[0,0,100,100]}]}';
  const fetch=vi.fn().mockImplementation(async()=>({ok:true,json:async()=>({choices:[{message:{content}}]})}));vi.stubGlobal('fetch',fetch);
  const p={text:'Text only',image:'Read panels left-to-right.',snippet:'Translate speech naturally.'};
  await translateImage(settings,'data:image/jpeg;base64,YQ==',undefined,p);content='{"original":"Hi","translated":"你好"}';await translateSnippet(settings,'data:image/jpeg;base64,YQ==',undefined,p);
  const [full,snip]=fetch.mock.calls.map(c=>JSON.parse(c[1].body));
  expect(full.messages[0].content).toContain(p.image);expect(full.messages[0].content).not.toContain(p.snippet);expect(full.messages[0].content).toContain('0-1000');
  expect(snip.messages[0].content).toContain(p.snippet);expect(snip.messages[0].content).not.toContain(p.image);expect(snip.messages[0].content).toContain('No coordinates');
  for(const b of [full,snip])expect(b).toMatchObject({max_tokens:1500,temperature:0.1,reasoning:{enabled:false}});
});
