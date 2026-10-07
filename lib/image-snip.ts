// SPDX-License-Identifier: GPL-3.0-only
import { viewportContentBox, type ImageTarget } from './image-capture';
import type { Region } from './image-geometry';

/** A selection owns no inference state. Closing, tiny drags and Escape never send requests. */
export function selectRegion(target:ImageTarget,finish:(region:Region|null)=>void):()=>void {
  const bounds=viewportContentBox(target),host=document.createElement('div');host.dataset.blOwned='snip';
  Object.assign(host.style,{position:'fixed',left:`${bounds.left}px`,top:`${bounds.top}px`,width:`${bounds.width}px`,height:`${bounds.height}px`,zIndex:'2147483647',cursor:'crosshair',touchAction:'none',userSelect:'none'});
  const root=host.attachShadow({mode:'open'});root.innerHTML='<style>:host{all:initial;cursor:crosshair}.surface{position:absolute;inset:0;border:2px dashed #2581df;background:#137cbd15;box-sizing:border-box;cursor:crosshair}.rect{position:absolute;border:2px solid #1688e8;background:#2581df40;box-sizing:border-box;pointer-events:none}.hint{position:absolute;top:6px;left:6px;background:#fff;color:#173a59;font:13px system-ui;padding:5px;border-radius:4px;pointer-events:none}.hint button{pointer-events:auto;margin-left:8px;min-height:32px;border:1px solid #8babc6;border-radius:4px;background:white;color:#173a59;cursor:pointer}</style><div class="surface"></div><div class="rect" hidden></div><span class="hint">拖动框选 · Esc 取消<button type="button">取消</button></span>';
  document.documentElement.append(host);const rect=root.querySelector<HTMLElement>('.rect')!;
  let start:{x:number;y:number}|undefined,pointer:number|undefined,closed=false,frame=0;
  const point=(e:PointerEvent)=>({x:Math.max(0,Math.min(1,(e.clientX-bounds.left)/bounds.width)),y:Math.max(0,Math.min(1,(e.clientY-bounds.top)/bounds.height))});
  const region=(p:{x:number;y:number}):Region=>({left:Math.min(start!.x,p.x),top:Math.min(start!.y,p.y),width:Math.abs(start!.x-p.x),height:Math.abs(start!.y-p.y)});
  const close=(result:Region|null)=>{if(closed)return;closed=true;host.remove();cancelAnimationFrame(frame);document.removeEventListener('keydown',key,true);window.removeEventListener('scroll',cancel,true);window.removeEventListener('resize',cancel);finish(result);};
  const cancel=()=>close(null);
  const cancelButton=root.querySelector('button')!;cancelButton.addEventListener('pointerdown',e=>e.stopPropagation());cancelButton.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();cancel();});
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();cancel();}};
  host.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();e.stopPropagation();start=point(e);pointer=e.pointerId;host.setPointerCapture(pointer);rect.hidden=false;Object.assign(rect.style,{left:`${start.x*100}%`,top:`${start.y*100}%`,width:'0',height:'0'});});
  host.addEventListener('pointermove',e=>{if(!start||e.pointerId!==pointer)return;const r=region(point(e));Object.assign(rect.style,{left:`${r.left*100}%`,top:`${r.top*100}%`,width:`${r.width*100}%`,height:`${r.height*100}%`});});
  host.addEventListener('pointerup',e=>{if(!start||e.pointerId!==pointer)return;e.preventDefault();e.stopPropagation();const r=region(point(e));close(r.width*bounds.width>=8&&r.height*bounds.height>=8?r:null);});
  host.addEventListener('pointercancel',cancel);
  const tick=()=>{if(closed)return;const b=viewportContentBox(target);if(!target.isConnected||Math.abs(b.left-bounds.left)>.5||Math.abs(b.top-bounds.top)>.5||Math.abs(b.width-bounds.width)>.5||Math.abs(b.height-bounds.height)>.5){cancel();return;}frame=requestAnimationFrame(tick);};
  frame=requestAnimationFrame(tick);document.addEventListener('keydown',key,true);window.addEventListener('scroll',cancel,true);window.addEventListener('resize',cancel);
  return cancel;
}
