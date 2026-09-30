import { describe, it, expect, vi, afterEach } from 'vitest';
import { listModels, request, Queue, complete } from '../lib/api';
const settings = { endpoint:'https://openrouter.ai/api/v1', apiKey:'mock-key', language:'简体中文', textModel:'mock', imageModel:'mock' };
afterEach(() => vi.unstubAllGlobals());
describe('Phase 1: API', () => {
  it('queries the documented models route with Bearer auth', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok:true, json:async()=>({ data:[{ id:'vision', architecture:{ input_modalities:['text','image'] } }] }) });
    vi.stubGlobal('fetch',fetch);
    expect(await listModels(settings)).toEqual([{id:'vision',vision:true,context:undefined,pricing:undefined}]);
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
  it('disables DeepSeek reasoning for bounded translation and explains truncation',async()=>{
    const fetch=vi.fn().mockResolvedValue({ok:true,json:async()=>({choices:[{finish_reason:'length',message:{content:null}}]})});vi.stubGlobal('fetch',fetch);
    await expect(complete(settings,'deepseek/deepseek-v4.1-flash',[],100)).rejects.toThrow('思考');
    expect(JSON.parse(fetch.mock.calls[0]![1].body).reasoning).toEqual({enabled:false});
  });
  it('allows a keyless local endpoint but requires a key for cloud inference',async()=>{
    const fetch=vi.fn().mockResolvedValue({ok:true,json:async()=>({})});vi.stubGlobal('fetch',fetch);
    await request({...settings,endpoint:'http://127.0.0.1:11434/v1',apiKey:''},'/chat/completions',{});
    expect(fetch.mock.calls[0]![1].headers.Authorization).toBeUndefined();
    await expect(request({...settings,apiKey:''},'/chat/completions',{})).rejects.toThrow('API Key');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('reports provider refusal without retrying or exposing its content',async()=>{
    const fetch=vi.fn().mockResolvedValue({ok:true,json:async()=>({choices:[{finish_reason:'content_filter',message:{content:null}}]})});vi.stubGlobal('fetch',fetch);
    await expect(complete(settings,'mock',[],100)).rejects.toThrow('拒绝处理');expect(fetch).toHaveBeenCalledTimes(1);
  });
});
