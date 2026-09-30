// SPDX-License-Identifier: GPL-3.0-only
import { browser } from 'wxt/browser';
import { EMPTY_PROFILE, validateTranslationProfile, type TranslationProfile } from './translation-profile';
export async function getTranslationProfile():Promise<TranslationProfile>{
  const {translationProfile}=await browser.storage.local.get('translationProfile');
  return translationProfile===undefined?{...EMPTY_PROFILE}:validateTranslationProfile(translationProfile);
}
export async function saveTranslationProfile(value:unknown):Promise<void>{
  await browser.storage.local.set({translationProfile:validateTranslationProfile(value)});
}
