import { it, expect, vi } from 'vitest';
const storage=vi.hoisted(()=>({get:vi.fn().mockResolvedValue({}),set:vi.fn().mockResolvedValue(undefined)}));
vi.mock('wxt/browser',()=>({browser:{storage:{local:storage}}}));
import { getTranslationProfile, saveTranslationProfile } from '../lib/profile-preferences';
it('defaults to no reference and never overwrites account settings when saving a profile',async()=>{
  expect(await getTranslationProfile()).toEqual({context:'',glossary:''});
  await saveTranslationProfile({context:' Game ',glossary:'Nora=诺拉',apiKey:'do-not-copy'});
  expect(storage.set).toHaveBeenCalledWith({translationProfile:{context:'Game',glossary:'Nora=诺拉'}});
  await expect(saveTranslationProfile({context:'',glossary:'Nora=诺拉\nNora=冲突'})).rejects.toThrow();
  expect(storage.set).toHaveBeenCalledTimes(1);
});
