// SPDX-License-Identifier: GPL-3.0-only
import { browser } from 'wxt/browser';
export interface Settings { baseUrl: string; apiKey: string; targetLang: string; textModel: string; visionModel: string }
export const defaults: Settings = {
  baseUrl: 'https://openrouter.ai/api/v1', apiKey: '', targetLang: '简体中文',
  textModel: 'deepseek/deepseek-v4.1-flash', visionModel: 'deepseek/deepseek-v4.1-flash'
};
export function validateSettings(value: Settings): Settings {
  const s = Object.fromEntries(Object.entries(value).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : ''])) as unknown as Settings;
  const url = new URL(s.baseUrl);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) throw new Error('API 地址必须使用 HTTPS（本机测试可使用 HTTP）。');
  if (url.username || url.password || url.search || url.hash) throw new Error('API 地址不能包含用户名、密码、查询参数或片段。');
  s.baseUrl = url.href.replace(/\/+$/, '');
  if (!s.targetLang || !s.textModel || !s.visionModel) throw new Error('请填写目标语言和两个模型名称。');
  if (s.targetLang.length > 80 || s.textModel.length > 200 || s.visionModel.length > 200 || s.apiKey.length > 500) throw new Error('配置字段过长。');
  return s;
}
export async function getSettings(): Promise<Settings> {
  const stored = (await browser.storage.local.get('settings')).settings;
  const old = stored && typeof stored === 'object' ? stored as Record<string, unknown> : {};
  // Migrate 0.1 settings without resetting a user's key or selected models.
  return validateSettings({
    apiKey: old.apiKey ?? defaults.apiKey,
    baseUrl: old.baseUrl ?? old.endpoint ?? defaults.baseUrl,
    textModel: old.textModel ?? defaults.textModel,
    visionModel: old.visionModel ?? old.imageModel ?? defaults.visionModel,
    targetLang: old.targetLang ?? old.language ?? defaults.targetLang
  } as Settings);
}
export async function saveSettings(settings: Settings) {
  await browser.storage.local.set({ settings: validateSettings(settings) });
}
