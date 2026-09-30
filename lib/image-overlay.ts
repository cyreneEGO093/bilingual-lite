// SPDX-License-Identifier: GPL-3.0-only
import type { Bubble } from './image-api';
import { contentBox, type ImageTarget } from './image-capture';
import { DEFAULT_OVERLAY_STYLE, validateOverlayStyle, scaledBox, moveBox, resizeBox, type OverlayStyle, type BubbleBox } from './overlay-style';
const parents=new Map<HTMLElement,{count:number;original:string}>();
export class ImageOverlay {
  readonly host:HTMLDivElement;
  private parent:HTMLElement;
  private observer:ResizeObserver;
  private frame=0;
  private signature:string;
  private aspect:number;
  private root:ShadowRoot;
  private disposed=false;
  editing=false;
  private geometry='';
  private style:OverlayStyle;
  private originals=new Map<HTMLElement,{bbox:Bubble['bbox'];manual:boolean}>();
  private cancelDrag?:()=>void;
  constructor(private target:ImageTarget,bubbles:Bubble[],style:OverlayStyle=DEFAULT_OVERLAY_STYLE) {
    this.style=validateOverlayStyle(style);
    this.parent=(target.parentElement?.tagName==='PICTURE'?target.parentElement.parentElement:target.parentElement)??document.body;
    const record=parents.get(this.parent);
    if(record)record.count++;else{parents.set(this.parent,{count:1,original:this.parent.style.position});if(getComputedStyle(this.parent).position==='static')this.parent.style.position='relative';}
    const box=contentBox(target);this.aspect=box.w/box.h;this.signature=this.source();
    this.host=document.createElement('div');this.host.dataset.blOwned='image-overlay';
    Object.assign(this.host.style,{position:'absolute',pointerEvents:'none',zIndex:'2147483645',overflow:'hidden',margin:'0',padding:'0',border:'0'});
    this.root=this.host.attachShadow({mode:'open'});
    this.root.innerHTML=`<style>:host{all:initial}:host([hidden]){display:none!important}
      .bubble{position:absolute;box-sizing:border-box;display:flex;align-items:center;justify-content:center;background:rgb(255 255 255 / var(--bl-opacity,1));box-shadow:0 1px 5px #0002;border-radius:5px;color:#16271f;padding:3px;overflow:hidden;white-space:pre-wrap;overflow-wrap:anywhere;text-align:center;line-height:1.2;font-family:system-ui,sans-serif;font-size:clamp(10px,var(--bl-font,16px),24px);pointer-events:auto}
      .words{display:block;min-width:0;max-width:100%;max-height:100%;overflow:auto}
      .handle{position:absolute;width:20px;height:20px;padding:0;border:1px solid #d5e4d7;border-radius:4px;background:#245d48;color:white;font:16px/18px system-ui;opacity:0;touch-action:none;user-select:none;z-index:1}
      .move-handle{top:1px;left:1px;cursor:move}.move-handle::after{content:'✥'}
      .resize-handle{bottom:1px;right:1px;cursor:nwse-resize}.resize-handle::after{content:'↘'}
      .bubble:hover .handle,.bubble:focus-within .handle,:host([data-editing]) .handle{opacity:1}
      .bubble:hover{outline:1px solid #245d4880}:host([data-editing]) .bubble{outline:2px dashed #245d48;cursor:move;touch-action:none;user-select:none}
      .handle:focus-visible{outline:2px solid #f7b846;outline-offset:-2px}@media(pointer:coarse){.handle{opacity:1}}
      </style>`;
    this.host.style.setProperty('--bl-opacity',String(1-this.style.transparency/100));
    this.parent.append(this.host);this.observer=new ResizeObserver(()=>this.update());this.observer.observe(target);this.observer.observe(this.parent);
    this.add(bubbles);this.tick();
  }
  add(bubbles:Bubble[],replace=false){
    if(replace)for(const b of bubbles)for(const node of this.root.querySelectorAll<HTMLElement>('.bubble')){
      const x=(parseFloat(node.style.left)+parseFloat(node.style.width)/2)*10,y=(parseFloat(node.style.top)+parseFloat(node.style.height)/2)*10;
      if(x>=b.bbox[1]&&x<=b.bbox[3]&&y>=b.bbox[0]&&y<=b.bbox[2]){node.remove();this.originals.delete(node);}
    }
    for(const b of bubbles){const node=document.createElement('span'),words=document.createElement('span');node.className='bubble';words.className='words';words.textContent=b.translated;node.append(words);node.title=b.original;node.dir='auto';
      this.originals.set(node,{bbox:[...b.bbox],manual:false});this.writeBox(node,scaledBox(b.bbox,this.style.size));this.root.append(node);
      for(const action of ['move','resize'] as const){const handle=document.createElement('button');handle.type='button';handle.className=`handle ${action}-handle`;handle.dataset.action=action;handle.title=action==='move'?'拖动移动；方向键微调':'拖动调整大小；方向键微调';handle.setAttribute('aria-label',action==='move'?'移动译文框':'调整译文框大小');node.append(handle);
        handle.addEventListener('keydown',event=>{const directions:Record<string,[number,number]>={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};const d=directions[event.key];if(!d)return;const bounds=this.host.getBoundingClientRect();if(!bounds.width||!bounds.height)return;event.preventDefault();event.stopPropagation();const step=event.shiftKey?10:1;this.changeBox(node,(action==='resize'?resizeBox:moveBox)(this.readBox(node),d[0]*step/bounds.width*100,d[1]*step/bounds.height*100));});
      }
      node.addEventListener('pointerdown',event=>this.beginDrag(node,event));
      node.addEventListener('click',event=>{event.stopPropagation();event.preventDefault();});
    }
    this.geometry='';this.update();
  }
  private readBox(node:HTMLElement):BubbleBox{return {left:parseFloat(node.style.left),top:parseFloat(node.style.top),width:parseFloat(node.style.width),height:parseFloat(node.style.height)};}
  private writeBox(node:HTMLElement,box:BubbleBox){Object.assign(node.style,{left:`${box.left}%`,top:`${box.top}%`,width:`${box.width}%`,height:`${box.height}%`});node.dataset.height=String(box.height/100);}
  private changeBox(node:HTMLElement,box:BubbleBox){this.writeBox(node,box);const original=this.originals.get(node);if(original)original.manual=true;this.geometry='';this.update();}
  private beginDrag(node:HTMLElement,event:PointerEvent){
    const action=(event.target as Element).closest<HTMLElement>('[data-action]')?.dataset.action;
    if(event.button!==0||(!action&&!this.editing))return;
    const bounds=this.host.getBoundingClientRect();if(!bounds.width||!bounds.height)return;
    this.cancelDrag?.();event.preventDefault();event.stopPropagation();node.setPointerCapture(event.pointerId);
    const start=this.readBox(node),x=event.clientX,y=event.clientY,resize=action==='resize'||(!action&&event.shiftKey);
    const move=(e:PointerEvent)=>{if(e.pointerId!==event.pointerId)return;this.changeBox(node,(resize?resizeBox:moveBox)(start,(e.clientX-x)/bounds.width*100,(e.clientY-y)/bounds.height*100));};
    const end=()=>{node.removeEventListener('pointermove',move);node.removeEventListener('pointerup',end);node.removeEventListener('pointercancel',end);node.removeEventListener('lostpointercapture',end);window.removeEventListener('resize',end);window.removeEventListener('scroll',end,true);if(node.hasPointerCapture(event.pointerId))node.releasePointerCapture(event.pointerId);this.cancelDrag=undefined;};
    this.cancelDrag=end;node.addEventListener('pointermove',move);node.addEventListener('pointerup',end);node.addEventListener('pointercancel',end);node.addEventListener('lostpointercapture',end);window.addEventListener('resize',end);window.addEventListener('scroll',end,true);
  }
  setStyle(style:OverlayStyle){this.cancelDrag?.();this.style=validateOverlayStyle(style);this.host.style.setProperty('--bl-opacity',String(1-this.style.transparency/100));for(const [node,original] of this.originals)if(!original.manual)this.writeBox(node,scaledBox(original.bbox,this.style.size));this.geometry='';this.update();}
  resetLayout(){this.cancelDrag?.();for(const [node,original] of this.originals){original.manual=false;this.writeBox(node,scaledBox(original.bbox,this.style.size));}this.geometry='';this.update();}
  private source(){return this.target instanceof HTMLImageElement?this.target.currentSrc||this.target.src:`${this.target.width}x${this.target.height}`;}
  private tick=()=>{if(this.disposed)return;if(!this.target.isConnected){this.destroy();return;}this.update();this.frame=requestAnimationFrame(this.tick);};
  private update() {
    const {w,h,pl,pt}=contentBox(this.target);
    if(this.source()!==this.signature||Math.abs(w/h-this.aspect)>.02){this.host.hidden=true;this.host.dataset.stale='true';return;}
    const rect=this.target.getBoundingClientRect(),parent=this.parent.getBoundingClientRect();
    const sx=this.parent.offsetWidth?parent.width/this.parent.offsetWidth:1,sy=this.parent.offsetHeight?parent.height/this.parent.offsetHeight:1;
    const geometry=[rect.x,rect.y,parent.x,parent.y,w,h,sx,sy,this.parent.scrollLeft,this.parent.scrollTop].join(',');if(geometry===this.geometry)return;this.geometry=geometry;
    Object.assign(this.host.style,{left:`${(rect.left-parent.left)/(sx||1)-this.parent.clientLeft+this.parent.scrollLeft+this.target.clientLeft+pl}px`,top:`${(rect.top-parent.top)/(sy||1)-this.parent.clientTop+this.parent.scrollTop+this.target.clientTop+pt}px`,width:`${w}px`,height:`${h}px`});
    for(const node of this.root.querySelectorAll<HTMLElement>('.bubble')){
      const bh=h*Number(node.dataset.height),bw=w*parseFloat(node.style.width)/100;
      const estimate=Math.sqrt(Math.max(1,(bw-6)*(bh-6))/Math.max(1,(node.textContent?.length??1)*.85));
      let size=Math.max(10,Math.min(24,bh*.8,estimate*.9));node.style.setProperty('--bl-font',`${size}px`);
      const words=node.querySelector<HTMLElement>('.words')!;
      while(size>10&&(words.scrollHeight>words.clientHeight+1||words.scrollWidth>words.clientWidth+1)){size=Math.max(10,size-1);node.style.setProperty('--bl-font',`${size}px`);}
    }
  }
  toggle(){this.host.hidden=!this.host.hidden;}
  edit(){this.cancelDrag?.();this.editing=!this.editing;this.host.hidden=false;this.host.toggleAttribute('data-editing',this.editing);return this.editing;}
  destroy(){if(this.disposed)return;this.disposed=true;this.cancelDrag?.();cancelAnimationFrame(this.frame);this.observer.disconnect();this.originals.clear();this.host.remove();const record=parents.get(this.parent);if(record&&!--record.count){if(this.parent.style.position==='relative')this.parent.style.position=record.original;parents.delete(this.parent);}}
}
