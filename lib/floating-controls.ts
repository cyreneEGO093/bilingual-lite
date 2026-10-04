// SPDX-License-Identifier: GPL-3.0-only
import { clampFloating, placeFloating, visibleViewport, type Point, type Rect } from './floating-layout';
const EDITABLE='textarea,input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]),[contenteditable]:not([contenteditable=false]),[role=textbox]';
const owned=(node:Element)=>!!node.closest('[data-bl-owned]');
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
    p{font:13px/1.5 system-ui;width:max-content;max-width:min(280px,100%);margin:0 0 8px auto;overflow-wrap:anywhere;background:#fff;color:#243c32;border-radius:10px;padding:10px;box-shadow:0 2px 16px #0002}p:empty{display:none}
    @media(pointer:coarse){button,select{min-height:44px;font-size:16px}.small{min-width:44px}}
  </style><p role="status" aria-live="polite"></p><div class="panel" id="controls-panel"><div class="row">
    <select id="text-scope" aria-label="网页翻译范围"><option value="viewport">滚动翻译</option><option value="page">整页翻译</option></select>
    <button id="text-toggle" title="Alt+Shift+T">译 · 开启翻译</button><button id="text-mode" hidden>仅看译文</button><button id="text-retry" hidden>重试未完成</button>
    <button id="controls-move" class="small" title="拖动移动；方向键微调" aria-label="移动翻译工具">⠿</button><button id="controls-collapse" class="small" aria-label="收起翻译工具">收起</button>
  </div></div><button id="controls-expand" hidden aria-label="展开翻译工具" aria-controls="controls-panel" aria-expanded="false" title="点击展开；拖动移动">译</button>`;
  document.documentElement.append(host);
  const button=root.querySelector<HTMLButtonElement>('#text-toggle')!,status=root.querySelector('p')!,panel=root.querySelector<HTMLElement>('.panel')!;
  const mode=root.querySelector<HTMLButtonElement>('#text-mode')!,retry=root.querySelector<HTMLButtonElement>('#text-retry')!,scopeSelect=root.querySelector<HTMLSelectElement>('#text-scope')!;
  const launcher=root.querySelector<HTMLButtonElement>('#controls-expand')!,handle=root.querySelector<HTMLButtonElement>('#controls-move')!;
  let expanded=!(matchMedia('(pointer:coarse)').matches||innerWidth<=600),anchor:{x:number;y:number}|undefined,frame=0,disposed=false,dragging=false,ignoreClickUntil=0;
  let statusTimer:ReturnType<typeof setTimeout>|undefined,cancelDrag:(()=>void)|undefined;
  const setExpanded=(value:boolean)=>{expanded=value;panel.hidden=!value;launcher.hidden=value;launcher.setAttribute('aria-expanded',String(value));position();};
  function collect(view:Rect,point:Point,width:number,height:number){
    const nodes=new Set<Element>();
    const add=(el:Element)=>{if(!owned(el))nodes.add(el);};
    // Read only geometry. Input values and page text are never inspected here.
    for(const input of Array.from(document.querySelectorAll(EDITABLE)).slice(0,100)){
      if(owned(input))continue;
      const r=input.getBoundingClientRect();if(!r.width||!r.height||r.bottom<=view.top||r.top>=view.top+view.height)continue;
      add(input);const form=input.closest('form');if(form&&form.getBoundingClientRect().height<view.height*.45)add(form);
    }
    for(const dx of [.1,.5,.9])for(const dy of [.1,.5,.9]){
      for(const el of document.elementsFromPoint(point.left+width*dx,point.top+height*dy)){
        if(owned(el))continue;
        if(el.matches('button,a[href],select,[role=button]'))add(el);
        let parent:Element|null=el;
        for(let i=0;parent&&i<6;i++,parent=parent.parentElement){const css=getComputedStyle(parent),r=parent.getBoundingClientRect();if((css.position==='fixed'||css.position==='sticky')&&r.height<view.height*.45){add(parent);break;}}
      }
    }
    return Array.from(nodes,n=>n.getBoundingClientRect()).filter(r=>r.width>0&&r.height>0&&r.bottom>view.top&&r.top<view.top+view.height&&r.right>view.left&&r.left<view.left+view.width);
  }
  function position(){
    frame=0;if(disposed||dragging)return;const view=visibleViewport();
    host.style.maxWidth=`${Math.max(48,Math.min(440,view.width-24))}px`;panel.style.maxHeight=`${Math.max(44,view.height-48)}px`;
    const size={width:host.offsetWidth,height:host.offsetHeight};
    const preferred=anchor?{left:view.left+12+anchor.x*Math.max(0,view.width-size.width-24),top:view.top+12+anchor.y*Math.max(0,view.height-size.height-24)}:{left:view.left+view.width-size.width-20,top:expanded?view.top+view.height-size.height-20:view.top+view.height*.6};
    let p=clampFloating(preferred,size,view);const obstacles:Rect[]=[];
    for(let i=0;i<3;i++){obstacles.push(...collect(view,p,size.width,size.height));p=placeFloating(size,view,preferred,obstacles);}
    host.style.left=`${p.left}px`;host.style.top=`${p.top}px`;
  }
  function schedule(){if(!disposed&&!frame)frame=requestAnimationFrame(position);}
  function remember(point:Point){const v=visibleViewport();anchor={x:Math.max(0,Math.min(1,(point.left-v.left-12)/Math.max(1,v.width-host.offsetWidth-24))),y:Math.max(0,Math.min(1,(point.top-v.top-12)/Math.max(1,v.height-host.offsetHeight-24)))};}
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
  const focus=(e:Event)=>{const t=e.target;if(t instanceof Element&&!owned(t)&&t.matches(EDITABLE))setExpanded(false);schedule();};
  const resized=()=>{cancelDrag?.();schedule();};
  document.addEventListener('focusin',focus,true);document.addEventListener('focusout',schedule,true);window.addEventListener('scroll',schedule,true);window.addEventListener('resize',resized);
  window.visualViewport?.addEventListener('resize',resized);window.visualViewport?.addEventListener('scroll',schedule);
  const resizeObserver=new ResizeObserver(schedule);resizeObserver.observe(host);
  const mutations=new MutationObserver(records=>{if(records.some(r=>r.target instanceof Element&&!owned(r.target)))schedule();});mutations.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['style','class','hidden']});
  setExpanded(expanded);
  return {host,root,button,status,mode,retry,scopeSelect,showStatus:(message:string)=>{clearTimeout(statusTimer);status.textContent=message;schedule();statusTimer=setTimeout(()=>{status.textContent='';schedule();},3000);},destroy:()=>{disposed=true;cancelDrag?.();cancelAnimationFrame(frame);clearTimeout(statusTimer);resizeObserver.disconnect();mutations.disconnect();document.removeEventListener('focusin',focus,true);document.removeEventListener('focusout',schedule,true);window.removeEventListener('scroll',schedule,true);window.removeEventListener('resize',resized);window.visualViewport?.removeEventListener('resize',resized);window.visualViewport?.removeEventListener('scroll',schedule);host.remove();}};
}
