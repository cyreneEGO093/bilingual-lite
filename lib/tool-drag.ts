// SPDX-License-Identifier: GPL-3.0-only
import { clampFloating, visibleViewport, type Point } from './floating-layout';
export function installToolDrag(host:HTMLElement,handles:HTMLElement[],remember:(point:Point)=>void){
  let cancel:(()=>void)|undefined,ignoreUntil=0;
  const start=(event:PointerEvent)=>{
    if(event.button!==0)return;cancel?.();const target=event.currentTarget as HTMLElement,r=host.getBoundingClientRect(),x=event.clientX,y=event.clientY;let moved=false;
    target.setPointerCapture(event.pointerId);
    const move=(e:PointerEvent)=>{if(e.pointerId!==event.pointerId)return;if(!moved&&Math.hypot(e.clientX-x,e.clientY-y)<6)return;moved=true;const v=visibleViewport(),p=clampFloating({left:r.left+e.clientX-x,top:r.top+e.clientY-y},host.getBoundingClientRect(),v);host.style.left=`${p.left}px`;host.style.top=`${p.top}px`;remember({left:p.left-v.left,top:p.top-v.top});};
    const end=()=>{if(moved)ignoreUntil=Date.now()+400;target.removeEventListener('pointermove',move);target.removeEventListener('pointerup',end);target.removeEventListener('pointercancel',end);target.removeEventListener('lostpointercapture',end);if(target.hasPointerCapture(event.pointerId))target.releasePointerCapture(event.pointerId);cancel=undefined;};
    cancel=end;target.addEventListener('pointermove',move);target.addEventListener('pointerup',end);target.addEventListener('pointercancel',end);target.addEventListener('lostpointercapture',end);
  };
  const click=(event:Event)=>{if(Date.now()<ignoreUntil){event.preventDefault();event.stopImmediatePropagation();}};
  for(const handle of handles){handle.style.touchAction='none';handle.style.userSelect='none';handle.addEventListener('pointerdown',start);handle.addEventListener('click',click,true);}
  return ()=>{cancel?.();for(const handle of handles){handle.removeEventListener('pointerdown',start);handle.removeEventListener('click',click,true);}};
}
