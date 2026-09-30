import { browser } from 'wxt/browser';
export interface Settings { endpoint: string; apiKey: string; language: string; textModel: string; imageModel: string }
export const defaults: Settings = {
  endpoint: 'https://openrouter.ai/api/v1', apiKey: '', language: '简体中文',
  textModel: 'google/gemini-2.5-flash-lite', imageModel: 'google/gemini-2.5-flash-lite'
};
export function validateSettings(value: Settings): Settings {
  const s = Object.fromEntries(Object.entries(value).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : ''])) as unknown as Settings;
  const url = new URL(s.endpoint);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) throw new Error('API 地址必须使用 HTTPS（本机测试可使用 HTTP）。');
  if (url.username || url.password || url.search || url.hash) throw new Error('API 地址不能包含用户名、密码、查询参数或片段。');
  s.endpoint = url.href.replace(/\/+$/, '');
  if (!s.language || !s.textModel || !s.imageModel) throw new Error('请填写目标语言和两个模型名称。');
  if (s.language.length > 80 || s.textModel.length > 200 || s.imageModel.length > 200 || s.apiKey.length > 500) throw new Error('配置字段过长。');
  return s;
}
export async function getSettings(): Promise<Settings> {
  const stored = (await browser.storage.local.get('settings')).settings;
  return validateSettings({ ...defaults, ...(stored && typeof stored === 'object' ? stored : {}) });
}
export async function saveSettings(settings: Settings) {
  await browser.storage.local.set({ settings: validateSettings(settings) });
}
