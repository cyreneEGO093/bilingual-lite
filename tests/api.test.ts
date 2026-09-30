import { describe, it, expect, vi, afterEach } from 'vitest';
import { listModels, request, Queue } from '../lib/api';
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
});
