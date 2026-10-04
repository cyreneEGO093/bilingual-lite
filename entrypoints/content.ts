// SPDX-License-Identifier: GPL-3.0-only
import { browser } from 'wxt/browser';
import { TextTranslator } from '../lib/text-dom';
import { OutputFormatError } from '../lib/translation-error';
import type { TextResult } from '../lib/text-api';
import { installImageUI } from '../lib/image-dom';
import type { BackgroundRequest, ApiReply } from '../lib/messages';
import type { Bubble, Snippet } from '../lib/image-api';
import { validTextScope, type TextScope } from '../lib/text-scope';
import { validateOverlayStyle, type OverlayStyle } from '../lib/overlay-style';
import { createFloatingControls } from '../lib/floating-controls';
import '../lib/content.css';
export default defineContentScript({
  matches: ['http://*/*','https://*/*'], runAt:'document_idle',
  main(ctx) {
    const controls=createFloatingControls();
    const {button,mode,retry,scopeSelect,showStatus}=controls;
    const translator=new TextTranslator(async items=>{
      const result:ApiReply<TextResult[]>=await browser.runtime.sendMessage({type:'translateText',items});
      if (!result.ok) throw result.code==='output-format'?new OutputFormatError(result.error):new Error(result.error); return result.data;
    },message=>{showStatus(message); button.textContent=translator.enabled?'译 · 关闭翻译':'译 · 开启翻译';mode.hidden=!translator.enabled;mode.textContent=translator.onlyTranslated?'显示双语':'仅看译文';retry.hidden=!translator.enabled||(!translator.paused&&!translator.failedCount);retry.textContent=translator.paused?'重试并继续':'重试未完成';retry.title=translator.paused?'已暂停后续请求；保留现有译文，点击重试未完成段落。':`${translator.failedCount} 个片段待重试；已完成译文不会重复请求。`;});
    retry.addEventListener('click',()=>translator.retryFailed());
    mode.addEventListener('click',()=>translator.toggleMode());
    const send=async<T>(message:BackgroundRequest):Promise<T>=>{const reply:ApiReply<T>=await browser.runtime.sendMessage(message);if(!reply.ok)throw Object.assign(new Error(reply.error),{status:reply.status});return reply.data;};
    const applyScope=(scope:TextScope)=>{translator.setScope(scope);scopeSelect.value=scope;};
    scopeSelect.disabled=true;
    const scopeReady=send<TextScope>({type:'getTextScope'}).then(applyScope).catch(e=>showStatus(e.message)).finally(()=>{scopeSelect.disabled=false;});
    button.addEventListener('click',()=>{void scopeReady.then(()=>translator.toggle());});
    scopeSelect.addEventListener('change',async()=>{
      try {const scope=scopeSelect.value as TextScope;await send({type:'setTextScope',scope});applyScope(scope);}catch(e){scopeSelect.value=translator.scope;showStatus(e instanceof Error?e.message:'翻译范围保存失败。');}
    });
    const images=installImageUI({
      fetchImage:(url,layout)=>send<string>({type:'fetchImage',url,layout}),
      full:dataUrl=>send<Bubble[]>({type:'translateImage',dataUrl}),
      snippet:dataUrl=>send<Snippet>({type:'translateSnippet',dataUrl})
    },showStatus,state=>{controls.imagesButton.textContent=state.running?`${state.stopping?'停止中':'停止图片'} ${state.done+state.failed+state.skipped}/${state.total}`:'翻译整页图片';controls.imagesButton.disabled=state.running&&state.stopping;});
    controls.imagesButton.addEventListener('click',()=>images.translatePage());
    let styleRevision=0;
    void send<OverlayStyle>({type:'getOverlayStyle'}).then(style=>{if(styleRevision===0)images.setStyle(style);}).catch(e=>showStatus(e.message));
    const listener=(message: {type:string;url?:string;scope?:unknown;style?:unknown})=>{if(message.type==='overlayStyleChanged'){try{styleRevision++;images.setStyle(validateOverlayStyle(message.style));}catch{/* Ignore malformed internal preferences. */}}if(message.type==='toggle') void scopeReady.then(()=>translator.toggle());if(message.type==='textScopeChanged'&&validTextScope(message.scope))applyScope(message.scope);if(message.type==='textMode')translator.toggleMode();if(message.type==='contextImage')images.contextTranslate(message.url); if(message.type==='settingsChanged'||message.type==='profileChanged') {translator.stop();images.reset(); showStatus(message.type==='profileChanged'?'术语与背景已更新，请重新翻译。':'设置已更新，请重新开启翻译。'); button.textContent='译 · 开启翻译';mode.hidden=true;retry.hidden=true;}};
    browser.runtime.onMessage.addListener(listener);
    ctx.onInvalidated(()=>{translator.stop();images.destroy();controls.destroy();browser.runtime.onMessage.removeListener(listener);});
  }
});
