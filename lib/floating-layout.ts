// SPDX-License-Identifier: GPL-3.0-only
export interface Rect {left:number;top:number;width:number;height:number}
export interface Point {left:number;top:number}
export const FLOATING_GAP=12;
export function visibleViewport():Rect {
  const v=window.visualViewport;
  return {left:v?.offsetLeft??0,top:v?.offsetTop??0,width:v?.width??innerWidth,height:v?.height??innerHeight};
}
export function clampFloating(point:Point,size:{width:number;height:number},view:Rect):Point {
  return {left:Math.max(view.left+FLOATING_GAP,Math.min(view.left+view.width-size.width-FLOATING_GAP,point.left)),top:Math.max(view.top+FLOATING_GAP,Math.min(view.top+view.height-size.height-FLOATING_GAP,point.top))};
}
function overlap(a:Rect,b:Rect){return Math.max(0,Math.min(a.left+a.width,b.left+b.width+FLOATING_GAP)-Math.max(a.left,b.left-FLOATING_GAP))*Math.max(0,Math.min(a.top+a.height,b.top+b.height+FLOATING_GAP)-Math.max(a.top,b.top-FLOATING_GAP));}
/** Keep the panel in the visual viewport, preferring nearby space outside page controls. */
export function placeFloating(size:{width:number;height:number},view:Rect,preferred:Point,obstacles:Rect[]):Point {
  const origin=clampFloating(preferred,size,view),candidates:Point[]=[origin];
  for(const b of obstacles)candidates.push(
    {left:origin.left,top:b.top-size.height-FLOATING_GAP},{left:origin.left,top:b.top+b.height+FLOATING_GAP},
    {left:b.left-size.width-FLOATING_GAP,top:origin.top},{left:b.left+b.width+FLOATING_GAP,top:origin.top});
  for(const left of [view.left,view.left+view.width-size.width])for(const top of [view.top,view.top+view.height-size.height])candidates.push({left,top});
  return candidates.map(p=>clampFloating(p,size,view)).map(p=>({p,area:obstacles.reduce((n,b)=>n+overlap({...p,...size},b),0),distance:(p.left-origin.left)**2+(p.top-origin.top)**2})).sort((a,b)=>a.area-b.area||a.distance-b.distance)[0]!.p;
}
