// SPDX-License-Identifier: GPL-3.0-only
import { browser } from 'wxt/browser';
import { EMPTY_PROMPTS, validateCustomPrompts, type CustomPrompts } from './custom-prompts';
export async function getCustomPrompts():Promise<CustomPrompts>{
  const {customPrompts}=await browser.storage.local.get('customPrompts');
  return customPrompts===undefined?{...EMPTY_PROMPTS}:validateCustomPrompts(customPrompts);
}
export async function saveCustomPrompts(value:unknown){await browser.storage.local.set({customPrompts:validateCustomPrompts(value)});}
