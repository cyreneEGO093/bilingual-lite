import { browser } from 'wxt/browser';
import { getSettings } from '../lib/settings';
import { listModels } from '../lib/api';
import { translateText } from '../lib/text-api';
export default defineBackground(() => {
  // Chromium can prevent content scripts from reading local storage directly.
  browser.storage.local.setAccessLevel?.({ accessLevel: 'TRUSTED_CONTEXTS' }).catch(() => {});
  browser.commands.onCommand.addListener(async command => {
    if(command!=='toggle-translation') return;
    const [tab]=await browser.tabs.query({active:true,currentWindow:true});
    if(tab?.id) await browser.tabs.sendMessage(tab.id,{type:'toggle'}).catch(()=>{});
  });
  browser.storage.onChanged.addListener(async (changes,area)=>{
    if(area!=='local' || !changes.settings) return;
    for(const tab of await browser.tabs.query({})) if(tab.id) void browser.tabs.sendMessage(tab.id,{type:'settingsChanged'}).catch(()=>{});
  });
  browser.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== browser.runtime.id) return;
    (async () => {
      if (message?.type === 'models' && sender.url?.startsWith(browser.runtime.getURL(''))) return listModels(await getSettings());
      if (message?.type === 'translateText' && sender.tab) return translateText(await getSettings(),message.items);
      throw new Error('未知请求。');
    })().then(data => respond({ ok: true, data }), error => respond({ ok: false, error: error instanceof Error ? error.message : '操作失败。' }));
    return true;
  });
});
