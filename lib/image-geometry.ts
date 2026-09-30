// SPDX-License-Identifier: GPL-3.0-only
export interface Region { left:number; top:number; width:number; height:number }
export interface ImageLayout { width:number; height:number; fit:string; position:string; crop?:Region }
export const IMAGE_QUALITY = 0.85;
export const IMAGE_MAX_EDGE = 1280;
export function validateRegion(value:unknown): Region {
  const r=value as Region;
  if(!r||![r.left,r.top,r.width,r.height].every(Number.isFinite)||r.left<0||r.top<0||r.width<=0||r.height<=0||r.left+r.width>1.000001||r.top+r.height>1.000001)throw new Error('框选区域无效，请重新选择。');
  return {left:r.left,top:r.top,width:Math.min(r.width,1-r.left),height:Math.min(r.height,1-r.top)};
}
export function drawGeometry(nw:number,nh:number,layout:ImageLayout) {
  if(!layout||![nw,nh,layout.width,layout.height].every(n=>Number.isFinite(n)&&n>0&&n<=100000)||!['fill','contain','cover','none','scale-down'].includes(layout.fit)||typeof layout.position!=='string'||layout.position.length>100)throw new Error('图片布局参数无效。');
  const crop=layout.crop?validateRegion(layout.crop):{left:0,top:0,width:1,height:1};
  const rect=fittedRect(nw,nh,layout.width,layout.height,layout.fit,layout.position);
  const width=layout.width*crop.width,height=layout.height*crop.height;
  const scale=Math.min(IMAGE_MAX_EDGE/Math.max(width,height),nw/rect.width,nh/rect.height);
  return {width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale)),
    x:(rect.x-crop.left*layout.width)*scale,y:(rect.y-crop.top*layout.height)*scale,
    drawWidth:rect.width*scale,drawHeight:rect.height*scale};
}
export function fittedRect(nw:number,nh:number,w:number,h:number,fit:string,position:string) {
  let width=w,height=h;
  if(fit!=='fill') {
    let scale=fit==='cover'?Math.max(w/nw,h/nh):Math.min(w/nw,h/nh);
    if(fit==='none') scale=1; if(fit==='scale-down') scale=Math.min(1,scale);
    width=nw*scale;height=nh*scale;
  }
  const tokens=position.split(/\s+/);const pos=(token:string|undefined,free:number)=>{
    if(!token || token==='center') return free/2;
    if(token==='left'||token==='top') return 0;if(token==='right'||token==='bottom')return free;
    if(token.endsWith('%'))return free*parseFloat(token)/100;
    if(token.endsWith('px'))return parseFloat(token);return free/2;
  };
  return {x:pos(tokens[0],w-width),y:pos(tokens[1],h-height),width,height};
}
