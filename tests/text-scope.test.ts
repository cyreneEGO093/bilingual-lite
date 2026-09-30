// SPDX-License-Identifier: GPL-3.0-only
import { it, expect, vi, beforeEach } from 'vitest';
const storage=vi.hoisted(()=>({get:vi.fn(),set:vi.fn().mockResolvedValue(undefined)}));
vi.mock('wxt/browser',()=>({browser:{storage:{local:storage}}}));
import { getTextScope, saveTextScope } from '../lib/text-scope';
beforeEach(()=>{storage.get.mockReset();storage.set.mockClear();});
it('defaults existing installs to scrolling and restores page preference without reading API settings',async()=>{
  storage.get.mockResolvedValue({});expect(await getTextScope()).toBe('viewport');
  storage.get.mockResolvedValue({textScope:'page'});expect(await getTextScope()).toBe('page');
  storage.get.mockResolvedValue({textScope:'invalid'});expect(await getTextScope()).toBe('viewport');
  expect(storage.get).toHaveBeenCalledWith('textScope');
});
it('writes only a valid scope without overwriting saved credentials',async()=>{
  await expect(saveTextScope('invalid')).rejects.toThrow('无效');expect(storage.set).not.toHaveBeenCalled();
  await saveTextScope('page');expect(storage.set).toHaveBeenCalledWith({textScope:'page'});
});
