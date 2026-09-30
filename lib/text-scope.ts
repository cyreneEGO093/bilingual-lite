// SPDX-License-Identifier: GPL-3.0-only
import { browser } from 'wxt/browser';
export type TextScope = 'viewport' | 'page';
export function validTextScope(value: unknown): value is TextScope { return value === 'viewport' || value === 'page'; }
export async function getTextScope(): Promise<TextScope> {
  const { textScope } = await browser.storage.local.get('textScope');
  return validTextScope(textScope) ? textScope : 'viewport';
}
export async function saveTextScope(textScope: unknown): Promise<void> {
  if (!validTextScope(textScope)) throw new Error('翻译范围无效。');
  await browser.storage.local.set({ textScope });
}
