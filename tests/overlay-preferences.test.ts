import { it, expect, vi, beforeEach } from 'vitest';
const storage=vi.hoisted(()=>({get:vi.fn(),set:vi.fn().mockResolvedValue(undefined)}));
vi.mock('wxt/browser',()=>({browser:{storage:{local:storage}}}));
import { getOverlayStyle, saveOverlayStyle } from '../lib/overlay-preferences';
beforeEach(()=>{storage.get.mockReset();storage.set.mockClear();});
it('keeps the old appearance for existing installs and restores saved defaults',async()=>{
  storage.get.mockResolvedValue({});expect(await getOverlayStyle()).toEqual({transparency:0,size:100});
  storage.get.mockResolvedValue({overlayStyle:{transparency:40,size:75}});expect(await getOverlayStyle()).toEqual({transparency:40,size:75});
  storage.get.mockResolvedValue({overlayStyle:{transparency:999,size:75}});expect(await getOverlayStyle()).toEqual({transparency:0,size:100});
});
it('saves only validated appearance without changing API settings',async()=>{
  await expect(saveOverlayStyle({transparency:0,size:0})).rejects.toThrow();expect(storage.set).not.toHaveBeenCalled();
  await saveOverlayStyle({transparency:50,size:80,apiKey:'must-not-be-stored'});expect(storage.set).toHaveBeenCalledWith({overlayStyle:{transparency:50,size:80}});
});
