// SPDX-License-Identifier: GPL-3.0-only
import { it, expect, vi } from 'vitest';
const local = vi.hoisted(() => ({ get:vi.fn(), set:vi.fn() }));
vi.mock('wxt/browser',()=>({browser:{storage:{local}}}));
import { defaults, getSettings, saveSettings, validateSettings } from '../lib/settings';
it('loads defaults and stores BYOK in local storage only', async()=>{
  local.get.mockResolvedValue({}); expect(await getSettings()).toEqual(defaults);
  expect(defaults.visionModel).toBe('deepseek/deepseek-v4.1-flash');
  await saveSettings({...defaults,apiKey:'mock-key'});
  expect(local.set).toHaveBeenCalledWith({settings:{...defaults,apiKey:'mock-key'}});
});
it('rejects insecure remote endpoints and URL credentials',()=>{
  expect(()=>validateSettings({...defaults,baseUrl:'http://example.com/v1'})).toThrow();
  expect(()=>validateSettings({...defaults,baseUrl:'https://user:pass@example.com/v1'})).toThrow();
  expect(validateSettings({...defaults,baseUrl:'http://127.0.0.1:8787/v1/'}).baseUrl).toBe('http://127.0.0.1:8787/v1');
});
it('migrates old field names and preserves the existing key',async()=>{
  local.get.mockResolvedValue({settings:{endpoint:'https://example.com/v1',imageModel:'old-vision',language:'日本語',apiKey:'existing-key',textModel:'old-text'}});
  expect(await getSettings()).toEqual({baseUrl:'https://example.com/v1',visionModel:'old-vision',targetLang:'日本語',apiKey:'existing-key',textModel:'old-text'});
});
