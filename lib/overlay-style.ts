import type { Bubble } from './image-api';

export interface OverlayStyle { transparency: number; size: number }
export const DEFAULT_OVERLAY_STYLE: Readonly<OverlayStyle> = { transparency: 0, size: 100 };
export function validateOverlayStyle(value: unknown): OverlayStyle {
  const v=value as Partial<OverlayStyle> | null;
  if(!v || !Number.isFinite(v.transparency) || !Number.isFinite(v.size) ||
      v.transparency!<0 || v.transparency!>100 || v.size!<25 || v.size!>200) throw new Error('背景透明度须为 0–100%，默认大小须为 25–200%。');
  return {transparency:v.transparency!,size:v.size!};
}
export interface BubbleBox { left:number;top:number;width:number;height:number }
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
export function scaledBox(bbox:Bubble['bbox'],size:number):BubbleBox {
  const [y1,x1,y2,x2]=bbox;
  const width=clamp((x2-x1)/10*size/100,2,100),height=clamp((y2-y1)/10*size/100,2,100);
  return {left:clamp((x1+x2)/20-width/2,0,100-width),top:clamp((y1+y2)/20-height/2,0,100-height),width,height};
}
export function moveBox(box:BubbleBox,dx:number,dy:number):BubbleBox {
  return {...box,left:clamp(box.left+dx,0,100-box.width),top:clamp(box.top+dy,0,100-box.height)};
}
export function resizeBox(box:BubbleBox,dx:number,dy:number):BubbleBox {
  return {...box,width:clamp(box.width+dx,2,100-box.left),height:clamp(box.height+dy,2,100-box.top)};
}
