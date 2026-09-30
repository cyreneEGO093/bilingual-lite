import { browser } from 'wxt/browser';
import { getSettings } from '../lib/settings';
import { listModels } from '../lib/api';
import { translateText } from '../lib/text-api';
import { prepareRemoteImage, translateImage } from '../lib/image-api';
export default defineBackground(() => {
  // Chromium can prevent content scripts from reading local storage directly.
  browser.storage.local.setAccessLevel?.({ accessLevel: 'TRUSTED_CONTEXTS' }).catch(() => {});
  browser.runtime.onInstalled.addListener(()=>{browser.contextMenus.removeAll().then(()=>browser.contextMenus.create({id:'translate-image',title:'翻译图片 / 漫画',contexts:['image']})).catch(()=>{});});
  browser.contextMenus.onClicked.addListener((info,tab)=>{if(info.menuItemId==='translate-image'&&tab?.id)void browser.tabs.sendMessage(tab.id,{type:'contextImage',url:info.srcUrl},{frameId:info.frameId??0}).catch(()=>{});});
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
      if (message?.type === 'fetchImage' && sender.tab) return prepareRemoteImage(message.url,message.layout);
      if (message?.type === 'translateImage' && sender.tab) return translateImage(await getSettings(),message.dataUrl);
      throw new Error('未知请求。');
    })().then(data => respond({ ok: true, data }), error => respond({ ok: false, error: error instanceof Error ? error.message : '操作失败。' }));
    return true;
  });
});
