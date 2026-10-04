// SPDX-License-Identifier: GPL-3.0-only
import type { ImageTarget } from './image-capture';
export function pageImages():ImageTarget[]{
  return Array.from(document.querySelectorAll<HTMLImageElement|HTMLCanvasElement>('img,canvas')).filter(t=>{
    if(t.closest('[data-bl-owned]'))return false;
    const r=t.getBoundingClientRect(),css=getComputedStyle(t);
    const w=t instanceof HTMLImageElement?t.naturalWidth:t.width,h=t instanceof HTMLImageElement?t.naturalHeight:t.height;
    return r.width>=160&&r.height>=100&&Math.max(w,h)>=300&&w>0&&h>0&&css.visibility!=='hidden'&&css.visibility!=='collapse'&&css.opacity!=='0'&&(!(t instanceof HTMLImageElement)||t.complete);
  });
}
/** Never reuse a stale context-menu target for a different image URL. */
export function contextImage(last:ImageTarget|undefined,url?:string):ImageTarget|undefined {
  const matches=(t:HTMLImageElement)=>!url||t.currentSrc===url||t.src===url;
  if(last?.isConnected&&(last instanceof HTMLCanvasElement?!url:matches(last)))return last;
  return url?Array.from(document.images).find(t=>matches(t)):undefined;
}
