// SPDX-License-Identifier: GPL-3.0-only
import { clampFloating, visibleViewport, type Point } from './floating-layout';
import { scaleControlCss, setControlScale } from './ui-scale';
export function createFloatingControls(){
  const host=document.createElement('div');host.dataset.blOwned='controls';
  Object.assign(host.style,{position:'fixed',zIndex:'2147483647',width:'max-content',boxSizing:'border-box',padding:'env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px) env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px)'});
  const root=host.attachShadow({mode:'open'});
  root.innerHTML=`<style>
    :host{all:initial}*{box-sizing:border-box}[hidden]{display:none!important}
    .panel{max-width:100%;padding:6px;border:1px solid #d5e4d7;border-radius:16px;background:#f8fbf8;box-shadow:0 3px 16px #0003;overflow:auto}
    .row{display:flex;align-items:center;justify-content:flex-end;flex-wrap:wrap;gap:5px}
    button,select{font:14px system-ui;cursor:pointer;min-height:42px;max-width:100%;border:1px solid #cdd7cc;border-radius:20px;padding:10px 12px;background:#fff;color:#243c32}
    button:focus-visible,select:focus-visible{outline:2px solid #d89017;outline-offset:-2px}button:disabled,select:disabled{opacity:.55}
    #text-toggle,#controls-expand{background:#245d48;color:white;border-color:#245d48}
    .small{min-width:36px;padding:6px;font-size:12px}#controls-move,#controls-expand{touch-action:none;user-select:none}#controls-move{cursor:move}
    #controls-expand{display:block;margin-left:auto;width:48px;height:48px;padding:0;border-radius:50%;box-shadow:0 3px 16px #0003;font-size:20px}
    p{position:absolute;bottom:100%;right:0;pointer-events:none;font:13px/1.5 system-ui;width:max-content;max-width:min(280px,calc(100vw - 24px));margin:0 0 8px;overflow-wrap:anywhere;background:#fff;color:#243c32;border-radius:10px;padding:10px;box-shadow:0 2px 16px #0002}p:empty{display:none}
    @media(pointer:coarse),(max-width:600px){button,select{min-height:44px;font-size:16px}.small{min-width:44px}#images-page{display:none}}
  </style><p role="status" aria-live="polite"></p><div class="panel" id="controls-panel"><div class="row">
    <select id="text-scope" aria-label="网页翻译范围"><option value="viewport">滚动翻译</option><option value="page">整页翻译</option></select>
    <button id="text-toggle" title="Alt+Shift+T">译 · 开启翻译</button><button id="text-mode" hidden>仅看译文</button><button id="text-retry" hidden>重试未完成</button>
    <button id="images-page" title="逐张翻译当前已加载的图片，可能增加 API 用量；再次点击停止">翻译整页图片</button>
    <button id="controls-move" class="small" title="拖动移动；方向键微调" aria-label="移动翻译工具">⠿</button><button id="controls-collapse" class="small" aria-label="收起翻译工具">收起</button>
  </div></div><button id="controls-expand" hidden aria-label="展开翻译工具" aria-controls="controls-panel" aria-expanded="false" title="点击展开；拖动移动">译</button>`;
  scaleControlCss(root);
  document.documentElement.append(host);
  const button=root.querySelector<HTMLButtonElement>('#text-toggle')!,status=root.querySelector('p')!,panel=root.querySelector<HTMLElement>('.panel')!;
  const mode=root.querySelector<HTMLButtonElement>('#text-mode')!,retry=root.querySelector<HTMLButtonElement>('#text-retry')!,scopeSelect=root.querySelector<HTMLSelectElement>('#text-scope')!;
  const launcher=root.querySelector<HTMLButtonElement>('#controls-expand')!,handle=root.querySelector<HTMLButtonElement>('#controls-move')!;
  const imagesButton=root.querySelector<HTMLButtonElement>('#images-page')!;
  let scale=1;
  let screenPoint:Point|undefined,screenWidth=0;
  let expanded=!(matchMedia('(pointer:coarse)').matches||innerWidth<=600),anchor:{x:number;y:number}|undefined,frame=0,disposed=false,dragging=false,ignoreClickUntil=0;
  let statusTimer:ReturnType<typeof setTimeout>|undefined,cancelDrag:(()=>void)|undefined;
  const setExpanded=(value:boolean)=>{expanded=value;screenPoint=undefined;panel.hidden=!value;launcher.hidden=value;launcher.setAttribute('aria-expanded',String(value));position();};
  function position(){
    frame=0;if(disposed||dragging)return;const view=visibleViewport();
    host.style.maxWidth=`${Math.max(48*scale,Math.min(440*scale,view.width-24))}px`;panel.style.maxHeight=`${Math.max(44*scale,view.height-24)}px`;
    const size={width:host.offsetWidth,height:host.offsetHeight};
    let preferred=anchor?{left:view.left+12+anchor.x*Math.max(0,view.width-size.width-24),top:view.top+12+anchor.y*Math.max(0,view.height-size.height-24)}:{left:view.left+view.width-size.width-20,top:expanded?view.top+view.height-size.height-20:view.top+view.height*.6};
    // Keep both states anchored; only clamp to the visible screen boundary.
    if(Math.abs(screenWidth-view.width)>1){screenPoint=undefined;screenWidth=view.width;}
    screenPoint??={left:preferred.left-view.left,top:preferred.top-view.top};preferred={left:view.left+screenPoint.left,top:view.top+screenPoint.top};
    const p=clampFloating(preferred,size,view);
    host.style.left=`${p.left}px`;host.style.top=`${p.top}px`;
  }
  function schedule(){if(!disposed&&!frame)frame=requestAnimationFrame(position);}
  function remember(point:Point){const v=visibleViewport();screenPoint={left:point.left-v.left,top:point.top-v.top};anchor={x:Math.max(0,Math.min(1,(point.left-v.left-12)/Math.max(1,v.width-host.offsetWidth-24))),y:Math.max(0,Math.min(1,(point.top-v.top-12)/Math.max(1,v.height-host.offsetHeight-24)))};}
  function startDrag(event:PointerEvent){
    if(event.button!==0)return;cancelDrag?.();ignoreClickUntil=0;const target=event.currentTarget as HTMLElement,start=host.getBoundingClientRect(),x=event.clientX,y=event.clientY;let moved=false;
    target.setPointerCapture(event.pointerId);
    const move=(e:PointerEvent)=>{if(e.pointerId!==event.pointerId)return;if(!moved&&Math.hypot(e.clientX-x,e.clientY-y)<6)return;moved=dragging=true;const p=clampFloating({left:start.left+e.clientX-x,top:start.top+e.clientY-y},{width:host.offsetWidth,height:host.offsetHeight},visibleViewport());host.style.left=`${p.left}px`;host.style.top=`${p.top}px`;remember(p);};
    const end=()=>{if(moved)ignoreClickUntil=Date.now()+400;dragging=false;target.removeEventListener('pointermove',move);target.removeEventListener('pointerup',end);target.removeEventListener('pointercancel',end);target.removeEventListener('lostpointercapture',end);if(target.hasPointerCapture(event.pointerId))target.releasePointerCapture(event.pointerId);cancelDrag=undefined;schedule();};
    cancelDrag=end;target.addEventListener('pointermove',move);target.addEventListener('pointerup',end);target.addEventListener('pointercancel',end);target.addEventListener('lostpointercapture',end);
  }
  launcher.addEventListener('pointerdown',startDrag);handle.addEventListener('pointerdown',startDrag);
  launcher.addEventListener('click',()=>{if(Date.now()>=ignoreClickUntil){setExpanded(true);button.focus({preventScroll:true});}});
  root.querySelector('#controls-collapse')!.addEventListener('click',()=>{setExpanded(false);launcher.focus({preventScroll:true});});
  handle.addEventListener('keydown',e=>{const d:Record<string,[number,number]>={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]},direction=d[e.key];if(!direction)return;e.preventDefault();const r=host.getBoundingClientRect(),step=e.shiftKey?10:1;remember(clampFloating({left:r.left+direction[0]*step,top:r.top+direction[1]*step},r,visibleViewport()));schedule();});
  root.addEventListener('keydown',e=>{if((e as KeyboardEvent).key==='Escape'){setExpanded(false);launcher.focus({preventScroll:true});}});
  const resized=()=>{cancelDrag?.();schedule();};
  window.addEventListener('scroll',schedule,true);window.addEventListener('resize',resized);
  window.visualViewport?.addEventListener('resize',resized);window.visualViewport?.addEventListener('scroll',schedule);
  const resizeObserver=new ResizeObserver(schedule);resizeObserver.observe(host);
  setExpanded(expanded);
  return {host,root,button,status,mode,retry,scopeSelect,imagesButton,setScale:(percent:number)=>{cancelDrag?.();scale=percent/100;setControlScale(host,percent);position();},showStatus:(message:string)=>{clearTimeout(statusTimer);status.textContent=message;schedule();statusTimer=setTimeout(()=>{status.textContent='';schedule();},3000);},destroy:()=>{disposed=true;cancelDrag?.();cancelAnimationFrame(frame);clearTimeout(statusTimer);resizeObserver.disconnect();window.removeEventListener('scroll',schedule,true);window.removeEventListener('resize',resized);window.visualViewport?.removeEventListener('resize',resized);window.visualViewport?.removeEventListener('scroll',schedule);host.remove();}};
}
