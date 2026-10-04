// SPDX-License-Identifier: GPL-3.0-only
export interface ToolbarRect {left:number;top:number;width:number;height:number}
export interface ToolbarSize {width:number;height:number}
const GAP=6,EDGE=4;
function intersects(a:ToolbarRect,b:ToolbarRect){return a.left<b.left+b.width+GAP&&a.left+a.width>b.left-GAP&&a.top<b.top+b.height+GAP&&a.top+a.height>b.top-GAP;}
/** Find a visible position without covering translated bubbles or their handles. */
export function placeImageToolbar(image:ToolbarRect,size:ToolbarSize,viewport:ToolbarSize,obstacles:ToolbarRect[]):{left:number;top:number}|undefined {
  const maxX=viewport.width-size.width-EDGE,maxY=viewport.height-size.height-EDGE;
  if(maxX<EDGE||maxY<EDGE)return;
  const clampX=(x:number)=>Math.max(EDGE,Math.min(maxX,x));
  const right=clampX(image.left+image.width-size.width-EDGE),left=clampX(image.left+EDGE);
  const clear=(x:number,y:number)=>y>=EDGE&&y<=maxY&&!obstacles.some(o=>intersects({left:x,top:y,...size},o));
  // Prefer image margins; the toolbar never consumes the image's layout space.
  for(const y of [image.top-size.height-GAP,image.top+image.height+GAP])if(clear(right,y))return {left:right,top:y};
  const top=Math.max(EDGE,image.top+GAP),bottom=Math.min(maxY,image.top+image.height-size.height-GAP);
  if(top>bottom)return;
  const visible=obstacles.filter(o=>o.top+o.height>=top-GAP&&o.top<=bottom+size.height+GAP);
  const xs=[...new Set([right,left,...visible.flatMap(o=>[clampX(o.left-size.width-GAP),clampX(o.left+o.width+GAP)])])];
  const ys=[...new Set([top,bottom,...visible.flatMap(o=>[o.top-size.height-GAP,o.top+o.height+GAP])])].filter(y=>y>=top&&y<=bottom).sort((a,b)=>a-b);
  for(const y of ys)for(const x of xs)if(clear(x,y))return {left:x,top:y};
}
