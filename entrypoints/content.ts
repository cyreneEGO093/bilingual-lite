import { browser } from 'wxt/browser';
import { TextTranslator } from '../lib/text-dom';
import { installImageUI } from '../lib/image-dom';
import type { BackgroundRequest, ApiReply } from '../lib/messages';
import type { Bubble, Snippet } from '../lib/image-api';
import { validTextScope, type TextScope } from '../lib/text-scope';
import { validateOverlayStyle, type OverlayStyle } from '../lib/overlay-style';
import '../lib/content.css';
export default defineContentScript({
  matches: ['http://*/*','https://*/*'], runAt:'document_idle',
  main(ctx) {
    const host=document.createElement('div'); host.dataset.blOwned='controls';
    Object.assign(host.style,{position:'fixed',right:'20px',bottom:'20px',zIndex:'2147483647'});
    const root=host.attachShadow({mode:'open'});
    root.innerHTML='<style>:host{all:initial}button{font:14px system-ui;border:0;border-radius:22px;padding:12px 18px;background:#245d48;color:white;cursor:pointer;box-shadow:0 3px 16px #0003}p{font:13px/1.5 system-ui;max-width:280px;background:#fff;color:#243c32;border-radius:10px;padding:10px;box-shadow:0 2px 16px #0002}p:empty{display:none}</style><p role="status" aria-live="polite"></p><button title="Alt+Shift+T">译 · 开启翻译</button>';
    document.documentElement.append(host);
    const button=root.querySelector('button')!, status=root.querySelector('p')!,mode=document.createElement('button');
    let statusTimer: ReturnType<typeof setTimeout> | undefined;
    const showStatus=(message:string)=>{
      clearTimeout(statusTimer);
      status.textContent=message;
      statusTimer=setTimeout(()=>{status.textContent='';},3000);
    };
    mode.id='text-mode';mode.textContent='仅看译文';mode.hidden=true;mode.style.marginLeft='5px';root.append(mode);
    const translator=new TextTranslator(async items=>{
      const result=await browser.runtime.sendMessage({type:'translateText',items});
      if (!result.ok) throw new Error(result.error); return result.data;
    },message=>{showStatus(message); button.textContent=translator.enabled?'译 · 关闭翻译':'译 · 开启翻译';mode.hidden=!translator.enabled;mode.textContent=translator.onlyTranslated?'显示双语':'仅看译文';});
    const scopeSelect=document.createElement('select');
    scopeSelect.id='text-scope';scopeSelect.setAttribute('aria-label','网页翻译范围');
    scopeSelect.innerHTML='<option value="viewport">滚动翻译</option><option value="page">整页翻译</option>';
    scopeSelect.style.cssText='font:13px system-ui;padding:11px 8px;margin-right:6px;border:1px solid #cdd7cc;border-radius:18px;background:white;color:#243c32;cursor:pointer';
    root.insertBefore(scopeSelect,button);
    mode.addEventListener('click',()=>translator.toggleMode());
    const send=async<T>(message:BackgroundRequest):Promise<T>=>{const reply:ApiReply<T>=await browser.runtime.sendMessage(message);if(!reply.ok)throw new Error(reply.error);return reply.data;};
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
    },showStatus);
    let styleRevision=0;
    void send<OverlayStyle>({type:'getOverlayStyle'}).then(style=>{if(styleRevision===0)images.setStyle(style);}).catch(e=>showStatus(e.message));
    const listener=(message: {type:string;url?:string;scope?:unknown;style?:unknown})=>{if(message.type==='overlayStyleChanged'){try{styleRevision++;images.setStyle(validateOverlayStyle(message.style));}catch{/* Ignore malformed internal preferences. */}}if(message.type==='toggle') void scopeReady.then(()=>translator.toggle());if(message.type==='textScopeChanged'&&validTextScope(message.scope))applyScope(message.scope);if(message.type==='textMode')translator.toggleMode();if(message.type==='contextImage')images.contextTranslate(message.url); if(message.type==='settingsChanged'||message.type==='profileChanged') {translator.stop();images.reset(); showStatus(message.type==='profileChanged'?'术语与背景已更新，请重新翻译。':'设置已更新，请重新开启翻译。'); button.textContent='译 · 开启翻译';mode.hidden=true;}};
    browser.runtime.onMessage.addListener(listener);
    ctx.onInvalidated(()=>{translator.stop();images.destroy();clearTimeout(statusTimer);host.remove();browser.runtime.onMessage.removeListener(listener);});
  }
});
