// SPDX-License-Identifier: GPL-3.0-only
import { browser } from 'wxt/browser';
import { getSettings, saveSettings, type Settings } from './settings';
import { getTextScope, saveTextScope } from './text-scope';
import { mountOverlaySettings } from './overlay-settings-ui';
import { mountProfileSettings } from './profile-settings-ui';
import './ui.css';
export async function mountSettings(popup = false) {
  const app = document.querySelector<HTMLElement>('#app')!;
  app.innerHTML = `<header><img class="brand-icon" src="icons/96.png" width="48" height="48" alt=""><div><h1>双语轻译</h1><p>原文在上，理解在旁。</p></div></header>
    <button id="toggle" class="primary" type="button">切换当前网页翻译 · Alt+Shift+T</button>
    <label>网页翻译范围（自动保存）<select id="text-scope" disabled><option value="viewport">滚动翻译 · 只翻译可见段落</option><option value="page">整页翻译 · 分批翻译所有段落</option></select></label>
    <p>整页模式处理当前已加载的正文，无需滚动，可能增加用量。</p>
    <div id="overlay-settings"></div>
    <div id="profile-settings"></div>
    <form><label>API Endpoint<input name="baseUrl" type="url" required></label>
    <label>API Key<input name="apiKey" type="password" autocomplete="off" placeholder="仅保存在本机"></label>
    <label>目标语言<select name="targetLang"><option>简体中文</option><option>繁體中文</option><option>English</option><option>日本語</option><option>한국어</option><option>Français</option><option>Deutsch</option><option>Español</option></select></label>
    <label>文本模型<input name="textModel" list="text-models" required></label><datalist id="text-models"></datalist>
    <label>图片 / 漫画模型<input name="visionModel" list="image-models" required></label><datalist id="image-models"></datalist>
    <div class="actions"><button class="primary" type="submit">保存设置</button><button id="models" type="button">连接并查询模型</button></div></form>
    <p id="status" role="status" aria-live="polite"></p><footer>按所选范围翻译网页；图片需手动点击。内容、作品背景和相关术语会发送至您设置的 API，密钥随请求用于该服务认证。配置保存在本机，不同步。每次调用可能计费。<br><a href="legal/privacy.html" target="_blank" rel="noopener">隐私说明</a> · <a href="legal/LICENSE.txt" target="_blank" rel="noopener">GPL-3.0 · 无担保</a> · <a href="legal/THIRD_PARTY_NOTICES.txt" target="_blank" rel="noopener">第三方许可</a><br>© 2026 Bilingual Lite contributors · 可依 GPL-3.0 修改与再分发。</footer>`;
  if(!popup)app.querySelector('#toggle')!.remove();
  const form = app.querySelector('form')!;
  const status = app.querySelector<HTMLElement>('#status')!;
  const report = (e: unknown) => { status.textContent = e instanceof Error ? e.message : String(e); };
  await mountOverlaySettings(app.querySelector<HTMLElement>('#overlay-settings')!,report);
  await mountProfileSettings(app.querySelector<HTMLElement>('#profile-settings')!,report);
  const scopeSelect=app.querySelector<HTMLSelectElement>('#text-scope')!;
  try {scopeSelect.value=await getTextScope();} catch(e){report(e);} finally {scopeSelect.disabled=false;}
  scopeSelect.addEventListener('change',async()=>{
    try {await saveTextScope(scopeSelect.value);report('翻译范围已保存，已开启的网页立即生效。');}catch(e){report(e);}
  });
  form.inert = true;
  try {
    const settings = await getSettings();
    for (const [key, value] of Object.entries(settings)) (form.elements.namedItem(key) as HTMLInputElement).value = value;
  } catch (e) { report(e); } finally { form.inert = false; }
  const save = async () => saveSettings(Object.fromEntries(new FormData(form)) as unknown as Settings);
  form.addEventListener('submit', async e => { e.preventDefault(); try { await save(); report('已保存到本机。'); } catch (e) { report(e); } });
  app.querySelector('#models')!.addEventListener('click', async () => {
    const button = app.querySelector<HTMLButtonElement>('#models')!; button.disabled = true;
    try {
      await save(); report('正在查询模型…');
      const result = await browser.runtime.sendMessage({ type: 'models' });
      if (!result.ok) throw new Error(result.error);
      for (const [id, visionOnly] of [['text-models', false], ['image-models', true]] as const) {
        const list = app.querySelector(`#${id}`)!; list.replaceChildren();
        for (const model of result.data) {
          if (model.mandatoryReasoning || (visionOnly && !model.vision)) continue;
          const option = document.createElement('option'); option.value = model.id;
          option.label = `${model.context ?? '?'} context · $${Number(model.pricing?.prompt ?? 0) * 1e6}/M input`;
          list.append(option);
        }
      }
      report(`连接成功，获取 ${result.data.length} 个模型。查询本身无推理费用。`);
    } catch (e) { report(e); } finally { button.disabled = false; }
  });
  app.querySelector('#toggle')?.addEventListener('click', async () => {
    try { const [tab] = await browser.tabs.query({ active: true, currentWindow: true }); if (tab?.id) await browser.tabs.sendMessage(tab.id, { type: 'toggle' }); }
    catch { report('此页面无法注入翻译，请打开普通网页并刷新后重试。'); }
  });
}
