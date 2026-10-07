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
