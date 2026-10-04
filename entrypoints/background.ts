// SPDX-License-Identifier: GPL-3.0-only
import { browser } from 'wxt/browser';
import { getSettings } from '../lib/settings';
import { OutputFormatError } from '../lib/translation-error';
import { listModels } from '../lib/api';
import { translateText, clearTextCache } from '../lib/text-api';
import { translateImage, translateSnippet } from '../lib/image-api';
import { prepareRemoteImage } from '../lib/image-download';
import { ensureImageAccess } from '../lib/image-access';
import { getTextScope, saveTextScope } from '../lib/text-scope';
import { getOverlayStyle } from '../lib/overlay-preferences';
import { getTranslationProfile } from '../lib/profile-preferences';
export default defineBackground(() => {
  // Chromium can prevent content scripts from reading local storage directly.
  browser.storage.local.setAccessLevel?.({ accessLevel: 'TRUSTED_CONTEXTS' }).catch(() => {});
  browser.runtime.onInstalled.addListener(()=>{browser.contextMenus?.removeAll().then(()=>browser.contextMenus.create({id:'translate-image',title:'翻译图片 / 漫画',contexts:['image']})).catch(()=>{});});
  browser.contextMenus?.onClicked.addListener((info,tab)=>{if(info.menuItemId==='translate-image'&&tab?.id)void browser.tabs.sendMessage(tab.id,{type:'contextImage',url:info.srcUrl},{frameId:info.frameId??0}).catch(()=>{});});
  // Firefox for Android has no keyboard commands API. Do not stop background initialization.
  browser.commands?.onCommand.addListener(async command => {
    if(command!=='toggle-translation') return;
    const [tab]=await browser.tabs.query({active:true,currentWindow:true});
    if(tab?.id) await browser.tabs.sendMessage(tab.id,{type:'toggle'}).catch(()=>{});
  });
  browser.storage.onChanged.addListener(async (changes,area)=>{
    if(area!=='local' || (!changes.settings&&!changes.textScope&&!changes.overlayStyle&&!changes.translationProfile)) return;
    if(changes.translationProfile)clearTextCache();
    const scope=changes.textScope?await getTextScope():undefined;
    const overlayStyle=changes.overlayStyle?await getOverlayStyle():undefined;
    for(const tab of await browser.tabs.query({})) if(tab.id) {
      if(changes.settings) void browser.tabs.sendMessage(tab.id,{type:'settingsChanged'}).catch(()=>{});
      if(scope) void browser.tabs.sendMessage(tab.id,{type:'textScopeChanged',scope}).catch(()=>{});
      if(overlayStyle) void browser.tabs.sendMessage(tab.id,{type:'overlayStyleChanged',style:overlayStyle}).catch(()=>{});
      if(changes.translationProfile) void browser.tabs.sendMessage(tab.id,{type:'profileChanged'}).catch(()=>{});
    }
  });
  browser.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== browser.runtime.id) return;
    (async () => {
      if (message?.type === 'models' && sender.url?.startsWith(browser.runtime.getURL(''))) return listModels(await getSettings());
      if (message?.type === 'getTextScope' && sender.tab) return getTextScope();
      if (message?.type === 'getOverlayStyle' && sender.tab) return getOverlayStyle();
      if (message?.type === 'setTextScope' && sender.tab) return saveTextScope(message.scope);
      if (message?.type === 'translateText' && sender.tab) return translateText(await getSettings(),message.items,await getTranslationProfile());
      if (message?.type === 'fetchImage' && sender.tab) {
        await ensureImageAccess(message.url);
        return prepareRemoteImage(message.url,message.layout);
      }
      if (message?.type === 'translateImage' && sender.tab) return translateImage(await getSettings(),message.dataUrl,await getTranslationProfile());
      if (message?.type === 'translateSnippet' && sender.tab) return translateSnippet(await getSettings(),message.dataUrl,await getTranslationProfile());
      throw new Error('未知请求。');
    })().then(data => respond({ ok: true, data }), error => respond({ ok: false, error: error instanceof Error ? error.message : '操作失败。', ...(error instanceof OutputFormatError?{code:error.code}:{}) }));
    return true;
  });
});
