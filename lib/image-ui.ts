import type { Bubble, Snippet } from './image-api';
import { captureImage, contentBox, viewportContentBox, type ImageTarget } from './image-capture';
import type { ImageLayout, Region } from './image-geometry';
import { ImageOverlay } from './image-overlay';
import { selectRegion } from './image-snip';

export interface ImageTransport {
  fetchImage(url:string,layout:ImageLayout):Promise<string>;
  full(dataUrl:string):Promise<Bubble[]>;
  snippet(dataUrl:string):Promise<Snippet>;
}
function signature(target:ImageTarget){const b=contentBox(target);return `${target instanceof HTMLImageElement?target.currentSrc:`${target.width}x${target.height}`}|${(b.w/b.h).toFixed(3)}`;}
export function installImageUI(transport:ImageTransport,report:(text:string)=>void) {
  const host=document.createElement('div');host.dataset.blOwned='image-button';
  Object.assign(host.style,{position:'fixed',zIndex:'2147483647',display:'none',maxWidth:'calc(100vw - 8px)'});
  const root=host.attachShadow({mode:'open'});
  root.innerHTML='<style>:host{all:initial}.bar{display:flex;flex-wrap:wrap;gap:3px}button{font:12px system-ui;border:1px solid #d5e4d7;background:#245d48;color:#fff;border-radius:7px;padding:7px 9px;cursor:pointer;box-shadow:0 2px 8px #0003}button:disabled{opacity:.55;cursor:wait}button[hidden]{display:none}</style><div class="bar"><button id="full">全文翻译</button><button id="snip">手动框选</button><button id="clear" disabled>清除遮罩</button><button id="adjust" hidden>校准位置</button></div>';
  document.documentElement.append(host);
  const full=root.querySelector<HTMLButtonElement>('#full')!,snip=root.querySelector<HTMLButtonElement>('#snip')!,clear=root.querySelector<HTMLButtonElement>('#clear')!,adjust=root.querySelector<HTMLButtonElement>('#adjust')!;
  let current:ImageTarget|undefined,lastContext:ImageTarget|undefined,epoch=0,cancelSelection:(()=>void)|undefined;
  const busy=new WeakSet<ImageTarget>(),overlays=new Map<ImageTarget,ImageOverlay>(),fullDone=new WeakSet<ImageTarget>();
  function overlayFor(target:ImageTarget){const o=overlays.get(target);if(o&&(o.host.dataset.stale||!o.host.isConnected)){o.destroy();overlays.delete(target);fullDone.delete(target);return undefined;}return o;}
  function position(){if(!current?.isConnected){host.style.display='none';return;}const b=viewportContentBox(current),width=host.offsetWidth;host.style.left=`${Math.max(4,Math.min(innerWidth-width-4,b.left+b.width-width-4))}px`;host.style.top=`${Math.max(4,b.top+6)}px`;}
  function refresh(){const o=current?overlayFor(current):undefined;full.disabled=snip.disabled=current?busy.has(current):false;full.textContent=full.disabled?'翻译中…':'全文翻译';clear.disabled=!o;clear.textContent=o?.host.hidden?'恢复遮罩':'清除遮罩';adjust.hidden=!o;adjust.textContent=o?.editing?'完成校准':'校准位置';position();}
  async function translate(target:ImageTarget,crop?:Region){
    if(busy.has(target))return;
    const existing=overlayFor(target);
    if(!crop&&existing&&fullDone.has(target)){existing.host.hidden=false;report('已恢复该图译文，未重复调用 API。');refresh();return;}
    const turn=epoch,source=signature(target);busy.add(target);refresh();report(crop?'正在翻译框选区域…':'正在翻译整图对白…');
    try{
      const dataUrl=await captureImage(target,transport.fetchImage,crop);
      if(turn!==epoch||!target.isConnected||signature(target)!==source)return;
      let bubbles:Bubble[];
      if(crop){const result=await transport.snippet(dataUrl);bubbles=result.translated.trim()?[{...result,bbox:[crop.top*1000,crop.left*1000,(crop.top+crop.height)*1000,(crop.left+crop.width)*1000]}]:[];}
      else bubbles=await transport.full(dataUrl);
      if(turn!==epoch||!target.isConnected||signature(target)!==source)return;
      if(!bubbles.length){report('所选图片中没有识别到可读对白。');return;}
      const previous=overlayFor(target);
      if(crop&&previous){previous.add(bubbles,true);previous.host.hidden=false;}
      else{previous?.destroy();overlays.set(target,new ImageOverlay(target,bubbles));}
      if(!crop)fullDone.add(target);
      report(crop?'局部译文已放入所选区域。可继续框选其他气泡。':`已翻译 ${bubbles.length} 个对白区域。漏译或位置不准时可手动框选。`);
    }catch(e){report(e instanceof Error?e.message:'图片翻译失败。');}
    finally{busy.delete(target);refresh();}
  }
  function beginSnip(){if(!current||busy.has(current))return;cancelSelection?.();const target=current;report('在图片上拖动框选，Esc 取消。');cancelSelection=selectRegion(target,crop=>{cancelSelection=undefined;if(crop)void translate(target,crop);else report('框选已取消或区域过小，未调用 API。');});}
  const over=(e:Event)=>{const t=e.target;if(t===host||(t instanceof Element&&t.closest('[data-bl-owned]')))return;if(t instanceof HTMLImageElement||t instanceof HTMLCanvasElement){if(t.clientWidth<=300||t.clientHeight<=300){host.style.display='none';return;}if(current!==t)cancelSelection?.();current=t;host.style.display='block';refresh();}else if(!cancelSelection)host.style.display='none';};
  const context=(e:Event)=>{lastContext=e.target instanceof HTMLImageElement||e.target instanceof HTMLCanvasElement?e.target:undefined;};
  full.addEventListener('click',()=>{cancelSelection?.();if(current)void translate(current);});snip.addEventListener('click',beginSnip);
  clear.addEventListener('click',()=>{if(current){overlayFor(current)?.toggle();refresh();}});
  adjust.addEventListener('click',()=>{if(current){const editing=overlayFor(current)?.edit();report(editing?'拖动移动；Shift + 拖动调整大小。校准不调用 API。':'校准完成。');refresh();}});
  document.addEventListener('pointerover',over,true);document.addEventListener('contextmenu',context,true);window.addEventListener('scroll',position,true);window.addEventListener('resize',position);
  function reset(){epoch++;cancelSelection?.();for(const [target,o] of overlays){o.destroy();fullDone.delete(target);}overlays.clear();refresh();}
  return {contextTranslate:(url?:string)=>{const target=lastContext??Array.from(document.images).find(img=>img.currentSrc===url||img.src===url);if(target)void translate(target);else report('未找到图片，请使用图片工具条。');},reset,destroy:()=>{reset();host.remove();document.removeEventListener('pointerover',over,true);document.removeEventListener('contextmenu',context,true);window.removeEventListener('scroll',position,true);window.removeEventListener('resize',position);}};
}
