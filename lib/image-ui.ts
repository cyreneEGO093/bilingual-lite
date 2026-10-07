// SPDX-License-Identifier: GPL-3.0-only
import type { Bubble, Snippet } from './image-api';
import { captureImage, contentBox, viewportContentBox, type ImageTarget } from './image-capture';
import type { ImageLayout, Region } from './image-geometry';
import { ImageOverlay } from './image-overlay';
import { selectRegion } from './image-snip';
import { DEFAULT_OVERLAY_STYLE, validateOverlayStyle, type OverlayStyle } from './overlay-style';
import { clampFloating, type Point } from './floating-layout';
import { scaleControlCss, setControlScale } from './ui-scale';
import { installToolDrag } from './tool-drag';
import { visibleViewport } from './floating-layout';
import { eligibleImage, installImageTouch } from './image-touch';
import { ImageBatch, type ImageBatchState } from './image-batch';
import { contextImage, pageImages } from './image-targets';

export interface ImageTransport {
  fetchImage(url:string,layout:ImageLayout):Promise<string>;
  full(dataUrl:string):Promise<Bubble[]>;
  snippet(dataUrl:string):Promise<Snippet>;
}
function signature(target:ImageTarget){const b=contentBox(target);return `${target instanceof HTMLImageElement?target.currentSrc:`${target.width}x${target.height}`}|${(b.w/b.h).toFixed(3)}`;}
export function installImageUI(transport:ImageTransport,report:(text:string)=>void,onBatch:(state:ImageBatchState)=>void=()=>{}) {
  const host=document.createElement('div');host.dataset.blOwned='image-button';
  Object.assign(host.style,{position:'fixed',zIndex:'2147483647',display:'none',width:'max-content',maxWidth:'calc(100vw - 24px)'});
  const root=host.attachShadow({mode:'open'});
  root.innerHTML='<style>:host{all:initial}.bar{display:flex;flex-wrap:wrap;gap:3px;max-width:100%}button{font:12px system-ui;border:1px solid #d5e4d7;background:#245d48;color:#fff;border-radius:7px;padding:7px 9px;cursor:pointer;box-shadow:0 2px 8px #0003}button:disabled{opacity:.55;cursor:wait}button[hidden],.bar[hidden]{display:none}</style><button id="expand" hidden aria-expanded="false" aria-controls="bar">图片工具</button><div class="bar" id="bar"><button id="move-toolbar" aria-label="拖动图片工具栏" title="拖动移动图片工具栏">⠿</button><button id="full">全文翻译</button><button id="snip">手动框选</button><button id="clear" disabled>清除遮罩</button><button id="adjust" hidden>校准位置</button><button id="reset-layout" hidden>重置框位</button><button id="collapse" title="收起工具栏（Esc）" aria-label="收起图片工具栏">收起</button></div>';
  document.documentElement.append(host);
  const touchStyle=document.createElement('style');touchStyle.textContent='@media(pointer:coarse){button{min-height:44px;min-width:44px;font-size:14px}.bar{gap:4px}}';root.append(touchStyle);scaleControlCss(root);
  const full=root.querySelector<HTMLButtonElement>('#full')!,snip=root.querySelector<HTMLButtonElement>('#snip')!,clear=root.querySelector<HTMLButtonElement>('#clear')!,adjust=root.querySelector<HTMLButtonElement>('#adjust')!;
  const resetLayout=root.querySelector<HTMLButtonElement>('#reset-layout')!;
  const bar=root.querySelector<HTMLElement>('#bar')!,expand=root.querySelector<HTMLButtonElement>('#expand')!,collapse=root.querySelector<HTMLButtonElement>('#collapse')!;
  let collapsed=false,manualPoint:Point|undefined,uiScale=100,hideTimer:ReturnType<typeof setTimeout>|undefined;
  const stopDrag=installToolDrag(host,[root.querySelector<HTMLButtonElement>('#move-toolbar')!,expand],p=>{manualPoint=p;});
  let style:OverlayStyle={...DEFAULT_OVERLAY_STYLE};
  let touchMode=matchMedia('(pointer:coarse)').matches;
  let current:ImageTarget|undefined,lastContext:ImageTarget|undefined,epoch=0,cancelSelection:(()=>void)|undefined;
  const busy=new WeakSet<ImageTarget>(),overlays=new Map<ImageTarget,ImageOverlay>(),fullDone=new WeakSet<ImageTarget>();
  const fullCache=new Map<string,Bubble[]>();
  const batch=new ImageBatch<{target:ImageTarget;source:string}>(async({target,source},active)=>{
    if(!target.isConnected||signature(target)!==source)return 'skipped';
    return translate(target,undefined,active,true);
  },state=>{onBatch(state);if(!state.running&&state.total)report(`${state.stopping?'已停止':'整页图片完成'}：成功 ${state.done}，失败 ${state.failed}，跳过 ${state.skipped}，共 ${state.total} 张。${state.error}`);});
  function overlayFor(target:ImageTarget){const o=overlays.get(target);if(o&&(o.host.dataset.stale||!o.host.isConnected)){o.destroy();overlays.delete(target);fullDone.delete(target);return undefined;}return o;}
  function position(){
    if(!current?.isConnected){host.style.display='none';return;}if(host.style.display==='none')return;
    const view=visibleViewport(),imageBox=viewportContentBox(current),b={...imageBox,left:imageBox.left-view.left,top:imageBox.top-view.top};
    if(b.top>=view.height||b.top+b.height<=0||b.left>=view.width||b.left+b.width<=0){host.style.visibility='hidden';return;}host.style.visibility='visible';host.style.maxWidth=`${Math.max(44,view.width-24)}px`;
    bar.hidden=collapsed;expand.hidden=!collapsed;
    const overlay=overlays.get(current);adjust.textContent=overlay?.editing?'完成校准':'校准位置';
    // Follow the image until manually placed. Never search for an empty area or auto-collapse.
    const preferred=manualPoint?{left:view.left+manualPoint.left,top:view.top+manualPoint.top}:{left:imageBox.left+imageBox.width-host.offsetWidth-6,top:imageBox.top+6};
    const point=clampFloating(preferred,{width:host.offsetWidth,height:host.offsetHeight},view);
    host.style.left=`${point.left}px`;host.style.top=`${point.top}px`;
  }
  function refresh(){const o=current?overlayFor(current):undefined;full.disabled=snip.disabled=current?busy.has(current):false;full.textContent=full.disabled?'翻译中…':'全文翻译';clear.disabled=!o;clear.textContent=o?.host.hidden?'恢复遮罩':'清除遮罩';adjust.hidden=resetLayout.hidden=!o;adjust.textContent=o?.editing?'完成校准':'校准位置';position();}
  async function translate(target:ImageTarget,crop?:Region,active:()=>boolean=()=>true,inBatch=false):Promise<'done'|'skipped'>{
    if(busy.has(target))return 'skipped';
    const existing=overlayFor(target);
    if(!crop&&existing&&fullDone.has(target)){existing.host.hidden=false;if(!inBatch)report('已恢复该图译文，未重复调用 API。');refresh();return 'done';}
    const turn=epoch,source=signature(target);busy.add(target);refresh();report(crop?'正在翻译框选区域…':'正在翻译整图对白…');
    try{
      const cacheKey=!crop&&target instanceof HTMLImageElement?source:undefined,cached=cacheKey?fullCache.get(cacheKey):undefined;
      const dataUrl=cached?undefined:await captureImage(target,transport.fetchImage,crop);
      if(turn!==epoch||!target.isConnected||signature(target)!==source||!active())return 'skipped';
      let bubbles:Bubble[];
      if(crop){const result=await transport.snippet(dataUrl!);bubbles=result.translated.trim()?[{...result,bbox:[crop.top*1000,crop.left*1000,(crop.top+crop.height)*1000,(crop.left+crop.width)*1000]}]:[];}
      else bubbles=cached??await transport.full(dataUrl!);
      if(turn!==epoch||!target.isConnected||signature(target)!==source)return 'skipped';
      if(cacheKey){if(fullCache.size>=50)fullCache.delete(fullCache.keys().next().value!);fullCache.set(cacheKey,bubbles);}
      if(!bubbles.length){if(!inBatch)report('所选图片中没有识别到可读对白。');return 'done';}
      const previous=overlayFor(target);
      if(crop&&previous){previous.add(bubbles,true);previous.host.hidden=false;}
      else{previous?.destroy();const overlay=new ImageOverlay(target,bubbles,style,position,touchMode);overlay.setUiScale(uiScale);overlays.set(target,overlay);}
      if(!crop)fullDone.add(target);
      if(!inBatch)report(crop?'局部译文已放入选区。手机点击“校准位置”调整。':`已翻译 ${bubbles.length} 个对白区域。手机点击“校准位置”后选择译文框调整。`);
      return 'done';
    }catch(e){if(inBatch)throw e;report(e instanceof Error?e.message:'图片翻译失败。');return 'skipped';}
    finally{busy.delete(target);refresh();}
  }
  function beginSnip(){if(!current||busy.has(current))return;cancelSelection?.();const target=current;report('在图片上拖动框选，Esc 取消。');cancelSelection=selectRegion(target,crop=>{cancelSelection=undefined;if(crop)void translate(target,crop);else report('框选已取消或区域过小，未调用 API。');});}
  const stopHide=()=>{clearTimeout(hideTimer);hideTimer=undefined;};
  function showTarget(t:ImageTarget){stopHide();if(current!==t){cancelSelection?.();collapsed=false;manualPoint=undefined;}current=t;host.style.display='block';refresh();}
  const over=(e:Event)=>{if((e as PointerEvent).pointerType==='touch')return;const t=e.target;stopHide();if(t===host||(t instanceof Element&&t.closest('[data-bl-owned]')))return;if(t instanceof HTMLImageElement||t instanceof HTMLCanvasElement){if(!eligibleImage(t)){host.style.display='none';return;}showTarget(t);}else if(!cancelSelection)hideTimer=setTimeout(()=>{if(!root.activeElement)host.style.display='none';},200);};
  const stopTouch=installImageTouch(target=>{touchMode=true;showTarget(target);});
  const context=(e:Event)=>{lastContext=e.target instanceof HTMLImageElement||e.target instanceof HTMLCanvasElement?e.target:undefined;};
  full.addEventListener('click',()=>{cancelSelection?.();if(current)void translate(current);});snip.addEventListener('click',beginSnip);
  clear.addEventListener('click',()=>{if(current){overlayFor(current)?.toggle();refresh();}});
  adjust.addEventListener('click',()=>{if(current){const editing=overlayFor(current)?.edit();report(editing?'手机：点选译文框，拖动框外的移动／缩放按钮；桌面可直接拖动框。':'校准完成。手机已隐藏调整工具。');refresh();}});
  resetLayout.addEventListener('click',()=>{if(current){overlayFor(current)?.resetLayout();report('已按默认大小恢复框位，未重复翻译。');}});
  collapse.addEventListener('click',()=>{collapsed=true;position();expand.focus();});
  expand.addEventListener('click',()=>{collapsed=false;position();collapse.focus();});
  const key=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!cancelSelection&&host.style.display!=='none'&&current){collapsed=true;position();if(event.composedPath().includes(host))expand.focus();}};
  document.addEventListener('pointerover',over,true);document.addEventListener('contextmenu',context,true);window.addEventListener('scroll',position,true);window.addEventListener('resize',position);
  document.addEventListener('keydown',key);
  window.visualViewport?.addEventListener('resize',position);window.visualViewport?.addEventListener('scroll',position);
  function reset(){epoch++;batch.reset();fullCache.clear();cancelSelection?.();for(const [target,o] of overlays){o.destroy();fullDone.delete(target);}overlays.clear();refresh();}
  return {setScale:(value:number)=>{uiScale=value;setControlScale(host,value);for(const overlay of overlays.values())overlay.setUiScale(value);position();},translatePage:()=>{if(batch.state.running){batch.stop();return;}const targets=pageImages().map(target=>({target,source:signature(target)}));if(!targets.length){report('当前页面没有已加载的合适图片，请先滚动加载图片。');return;}void batch.start(targets);},setStyle:(value:OverlayStyle)=>{style=validateOverlayStyle(value);for(const o of overlays.values())o.setStyle(style);},contextTranslate:(url?:string)=>{const target=contextImage(lastContext,url);if(target){cancelSelection?.();showTarget(target);void translate(target);}else report('未找到图片，请刷新页面后重试。');},reset,destroy:()=>{stopHide();stopDrag();stopTouch();reset();host.remove();document.removeEventListener('pointerover',over,true);document.removeEventListener('contextmenu',context,true);document.removeEventListener('keydown',key);window.removeEventListener('scroll',position,true);window.removeEventListener('resize',position);window.visualViewport?.removeEventListener('resize',position);window.visualViewport?.removeEventListener('scroll',position);}};
}
