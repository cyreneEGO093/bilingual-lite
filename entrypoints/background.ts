import { browser } from 'wxt/browser';
import { getSettings } from '../lib/settings';
import { listModels } from '../lib/api';
export default defineBackground(() => {
  // Chromium can prevent content scripts from reading local storage directly.
  browser.storage.local.setAccessLevel?.({ accessLevel: 'TRUSTED_CONTEXTS' }).catch(() => {});
  browser.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== browser.runtime.id) return;
    (async () => {
      if (message?.type === 'models' && !sender.tab) return listModels(await getSettings());
      throw new Error('未知请求。');
    })().then(data => respond({ ok: true, data }), error => respond({ ok: false, error: error instanceof Error ? error.message : '操作失败。' }));
    return true;
  });
});
