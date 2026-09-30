import { browser } from 'wxt/browser';
import { TextTranslator } from '../lib/text-dom';
import { installImageUI } from '../lib/image-dom';
import '../lib/content.css';
export default defineContentScript({
  matches: ['http://*/*','https://*/*'], runAt:'document_idle',
  main(ctx) {
    const host=document.createElement('div'); host.dataset.blOwned='controls';
    Object.assign(host.style,{position:'fixed',right:'20px',bottom:'20px',zIndex:'2147483647'});
    const root=host.attachShadow({mode:'open'});
    root.innerHTML='<style>:host{all:initial}button{font:14px system-ui;border:0;border-radius:22px;padding:12px 18px;background:#245d48;color:white;cursor:pointer;box-shadow:0 3px 16px #0003}p{font:13px/1.5 system-ui;max-width:280px;background:#fff;color:#243c32;border-radius:10px;padding:10px;box-shadow:0 2px 16px #0002}p:empty{display:none}</style><p role="status" aria-live="polite"></p><button title="Alt+Shift+T">译 · 开启双语</button>';
    document.documentElement.append(host);
    const button=root.querySelector('button')!, status=root.querySelector('p')!;
    const translator=new TextTranslator(async items=>{
      const result=await browser.runtime.sendMessage({type:'translateText',items});
      if (!result.ok) throw new Error(result.error); return result.data;
    },message=>{status.textContent=message; button.textContent=translator.enabled?'译 · 关闭双语':'译 · 开启双语';});
    button.addEventListener('click',()=>translator.toggle());
    const images=installImageUI(message=>browser.runtime.sendMessage(message),message=>{status.textContent=message;});
    const listener=(message: {type:string;url?:string})=>{if(message.type==='toggle') translator.toggle();if(message.type==='contextImage')images.contextTranslate(message.url); if(message.type==='settingsChanged') {translator.stop();images.reset(); status.textContent='设置已更新，请重新开启翻译。'; button.textContent='译 · 开启双语';}};
    browser.runtime.onMessage.addListener(listener);
    ctx.onInvalidated(()=>{translator.stop();images.destroy();host.remove();browser.runtime.onMessage.removeListener(listener);});
  }
});
