// SPDX-License-Identifier: GPL-3.0-only
import type { ImageTarget } from './image-capture';
export function eligibleImage(target:ImageTarget,touch=false){
  if(!touch)return target.clientWidth>300&&target.clientHeight>300;
  const w=target instanceof HTMLImageElement?target.naturalWidth:target.width;
  return target.clientWidth>=160&&target.clientHeight>=100&&w>=300;
}
/** Long press opens tools on touch screens without turning a scroll into a request. */
export function installImageTouch(show:(target:ImageTarget)=>void){
  let pending:{target:ImageTarget;id:number;x:number;y:number}|undefined,timer:ReturnType<typeof setTimeout>|undefined;
  let held:ImageTarget|undefined,blockUntil=0;
  const cancel=()=>{clearTimeout(timer);pending=undefined;};
  const down=(e:PointerEvent)=>{
    if(e.pointerType!=='touch')return;cancel();
    if(!e.isPrimary)return;
    const t=e.target;if(!(t instanceof HTMLImageElement||t instanceof HTMLCanvasElement)||!eligibleImage(t,true))return;
    pending={target:t,id:e.pointerId,x:e.clientX,y:e.clientY};
    timer=setTimeout(()=>{if(!pending||!t.isConnected)return;held=t;blockUntil=Date.now()+2000;show(t);},450);
  };
  const move=(e:PointerEvent)=>{if(pending?.id===e.pointerId&&Math.hypot(e.clientX-pending.x,e.clientY-pending.y)>10)cancel();};
  const up=(e:PointerEvent)=>{if(pending?.id===e.pointerId){if(held===pending.target)blockUntil=Date.now()+800;cancel();}};
  const suppress=(e:Event)=>{if(held&&e.target===held&&Date.now()<blockUntil){e.preventDefault();e.stopImmediatePropagation();}};
  document.addEventListener('pointerdown',down,true);document.addEventListener('pointermove',move,true);document.addEventListener('pointerup',up,true);document.addEventListener('pointercancel',cancel,true);
  document.addEventListener('click',suppress,true);document.addEventListener('contextmenu',suppress,true);window.addEventListener('scroll',cancel,true);
  return ()=>{cancel();document.removeEventListener('pointerdown',down,true);document.removeEventListener('pointermove',move,true);document.removeEventListener('pointerup',up,true);document.removeEventListener('pointercancel',cancel,true);document.removeEventListener('click',suppress,true);document.removeEventListener('contextmenu',suppress,true);window.removeEventListener('scroll',cancel,true);};
}
