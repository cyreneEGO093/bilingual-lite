import { it, expect, vi } from 'vitest';
const local = vi.hoisted(() => ({ get:vi.fn(), set:vi.fn() }));
vi.mock('wxt/browser',()=>({browser:{storage:{local}}}));
import { defaults, getSettings, saveSettings, validateSettings } from '../lib/settings';
it('loads defaults and stores BYOK in local storage only', async()=>{
  local.get.mockResolvedValue({}); expect(await getSettings()).toEqual(defaults);
  await saveSettings({...defaults,apiKey:'mock-key'});
  expect(local.set).toHaveBeenCalledWith({settings:{...defaults,apiKey:'mock-key'}});
});
it('rejects insecure remote endpoints and URL credentials',()=>{
  expect(()=>validateSettings({...defaults,endpoint:'http://example.com/v1'})).toThrow();
  expect(()=>validateSettings({...defaults,endpoint:'https://user:pass@example.com/v1'})).toThrow();
  expect(validateSettings({...defaults,endpoint:'http://127.0.0.1:8787/v1/'}).endpoint).toBe('http://127.0.0.1:8787/v1');
});
