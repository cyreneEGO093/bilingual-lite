// SPDX-License-Identifier: GPL-3.0-only
import { drawGeometry, IMAGE_QUALITY, type ImageLayout, type Region } from './image-geometry';
export type ImageTarget = HTMLImageElement | HTMLCanvasElement;
export function contentBox(target:ImageTarget) {
  const css=getComputedStyle(target);
  const pl=parseFloat(css.paddingLeft)||0,pt=parseFloat(css.paddingTop)||0;
  return {css,pl,pt,w:target.clientWidth-pl-(parseFloat(css.paddingRight)||0),h:target.clientHeight-pt-(parseFloat(css.paddingBottom)||0)};
}
export function viewportContentBox(target:ImageTarget) {
  const box=contentBox(target),rect=target.getBoundingClientRect();
  const sx=target.offsetWidth?rect.width/target.offsetWidth:1,sy=target.offsetHeight?rect.height/target.offsetHeight:1;
  return {left:rect.left+(target.clientLeft+box.pl)*sx,top:rect.top+(target.clientTop+box.pt)*sy,width:box.w*sx,height:box.h*sy};
}
export async function captureImage(target:ImageTarget, fallback:(url:string,layout:ImageLayout)=>Promise<string>, crop?:Region):Promise<string> {
  const {css,w,h}=contentBox(target);
  const nw=target instanceof HTMLImageElement?target.naturalWidth:target.width;
  const nh=target instanceof HTMLImageElement?target.naturalHeight:target.height;
  if(!nw||!nh)throw new Error('图片尚未加载。');
  const layout:ImageLayout={width:w,height:h,fit:css.objectFit||'fill',position:css.objectPosition||'50% 50%',...(crop?{crop}:{})};
  const g=drawGeometry(nw,nh,layout),canvas=document.createElement('canvas');canvas.width=g.width;canvas.height=g.height;
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('无法创建图片画布。');
  try{
    ctx.fillStyle='#fff';ctx.fillRect(0,0,g.width,g.height);ctx.drawImage(target,g.x,g.y,g.drawWidth,g.drawHeight);
    return canvas.toDataURL('image/jpeg',IMAGE_QUALITY);
  }catch{
    if(!(target instanceof HTMLImageElement))throw new Error('此 Canvas 受跨域保护，无法读取。请翻译原始图片。');
    // Firefox requires decoding and encoding in the background realm after CORS fallback.
    return fallback(target.currentSrc||target.src,layout);
  }
}
