// SPDX-License-Identifier: GPL-3.0-only
import { describe, it, expect, vi, afterEach } from 'vitest';
import { listModels, request, Queue, complete } from '../lib/api';
const settings = { baseUrl:'https://openrouter.ai/api/v1', apiKey:'mock-key', targetLang:'简体中文', textModel:'mock', visionModel:'mock' };
afterEach(() => vi.unstubAllGlobals());
describe('Phase 1: API', () => {
  it('queries the documented models route with Bearer auth', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok:true, json:async()=>({ data:[{ id:'vision', architecture:{ input_modalities:['text','image'] } }] }) });
    vi.stubGlobal('fetch',fetch);
    expect(await listModels(settings)).toEqual([{id:'vision',vision:true,context:undefined,pricing:undefined,mandatoryReasoning:false}]);
    expect(fetch.mock.calls[0]![0]).toBe('https://openrouter.ai/api/v1/models');
    expect(fetch.mock.calls[0]![1].headers.Authorization).toBe('Bearer mock-key');
  });
  it.each([401,402,429])('explains HTTP %i without leaking response data', async status => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok:false,status }));
    await expect(request(settings,'/models')).rejects.toMatchObject({status});
  });
  it('caps concurrency across requests at three', async () => {
    const queue = new Queue(3); let active=0, peak=0;
    await Promise.all(Array.from({length:12},()=>queue.run(async()=>{ active++; peak=Math.max(peak,active); await new Promise(r=>setTimeout(r,5)); active--; })));
    expect(peak).toBe(3);
  });
  it.each(['deepseek/deepseek-v4.1-flash','inclusionai/ling-3.0-flash-vl'])('disables reasoning for %s and explains truncation',async(model)=>{
    const fetch=vi.fn().mockResolvedValue({ok:true,json:async()=>({choices:[{finish_reason:'length',message:{content:null}}]})});vi.stubGlobal('fetch',fetch);
    await expect(complete(settings,model,[])).rejects.toThrow('1500');
    expect(JSON.parse(fetch.mock.calls[0]![1].body)).toMatchObject({reasoning:{enabled:false},temperature:0.1,max_tokens:1500});
  });
  it('allows a keyless local baseUrl but requires a key for cloud inference',async()=>{
    const fetch=vi.fn().mockResolvedValue({ok:true,json:async()=>({})});vi.stubGlobal('fetch',fetch);
    await request({...settings,baseUrl:'http://127.0.0.1:11434/v1',apiKey:''},'/chat/completions',{});
    expect(fetch.mock.calls[0]![1].headers.Authorization).toBeUndefined();
    await expect(request({...settings,apiKey:''},'/chat/completions',{})).rejects.toThrow('API Key');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('reports provider refusal without retrying or exposing its content',async()=>{
    const fetch=vi.fn().mockResolvedValue({ok:true,json:async()=>({choices:[{finish_reason:'content_filter',message:{content:null}}]})});vi.stubGlobal('fetch',fetch);
    await expect(complete(settings,'mock',[])).rejects.toThrow('拒绝处理');expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('retries a 429 once and obeys Retry-After without unbounded retries',async()=>{
    const fetch=vi.fn().mockResolvedValue(new Response('{}',{status:429,headers:{'Retry-After':'0'}}));vi.stubGlobal('fetch',fetch);
    await expect(request(settings,'/models')).rejects.toMatchObject({status:429});expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('does not retry timeout, auth failure or a long Retry-After',async()=>{
    const fetch=vi.fn().mockRejectedValue(new Error('timeout'));vi.stubGlobal('fetch',fetch);
    await expect(request(settings,'/models')).rejects.toThrow('不自动');expect(fetch).toHaveBeenCalledTimes(1);
    fetch.mockReset().mockResolvedValue(new Response('{}',{status:401}));await expect(request(settings,'/models')).rejects.toMatchObject({status:401});expect(fetch).toHaveBeenCalledTimes(1);
    fetch.mockReset().mockResolvedValue(new Response('{}',{status:429,headers:{'Retry-After':'60'}}));await expect(request(settings,'/models')).rejects.toMatchObject({status:429});expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('rejects a provider that ignores the reasoning switch or output limit',async()=>{
    const fetch=vi.fn().mockResolvedValue({ok:true,json:async()=>({usage:{completion_tokens_details:{reasoning_tokens:1}},choices:[{message:{content:'[]'}}]})});vi.stubGlobal('fetch',fetch);
    await expect(complete(settings,'mock',[])).rejects.toThrow('仍消耗');
    fetch.mockResolvedValue({ok:true,json:async()=>({usage:{completion_tokens:1501},choices:[{message:{content:'[]'}}]})});await expect(complete(settings,'mock',[])).rejects.toThrow('超过上限');
  });
});

it('uses the configured budget, accepts output above 1500 and reports the actual limit',async()=>{
  const fetch=vi.fn().mockResolvedValue({ok:true,json:async()=>({usage:{completion_tokens:2000},choices:[{message:{content:'[]'}}]})});vi.stubGlobal('fetch',fetch);
  expect(await complete({...settings,maxOutputTokens:4096},'mock',[])).toEqual([]);
  expect(JSON.parse(fetch.mock.calls[0]![1].body)).toMatchObject({max_tokens:4096,reasoning:{enabled:false},temperature:.1});
  fetch.mockResolvedValue({ok:true,json:async()=>({choices:[{finish_reason:'length',message:{content:null}}]})});
  await expect(complete({...settings,maxOutputTokens:8192},'mock',[])).rejects.toThrow('8192');
  expect(fetch).toHaveBeenCalledTimes(2);
  fetch.mockResolvedValue({ok:true,json:async()=>({usage:{completion_tokens:4097},choices:[{message:{content:'[]'}}]})});
  await expect(complete({...settings,maxOutputTokens:4096},'mock',[])).rejects.toThrow('超过上限');
  await expect(complete({...settings,maxOutputTokens:0},'mock',[])).rejects.toThrow('Token');expect(fetch).toHaveBeenCalledTimes(3);
});
