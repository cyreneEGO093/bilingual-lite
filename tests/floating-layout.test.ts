// SPDX-License-Identifier: GPL-3.0-only
import { expect, it } from 'vitest';
import { clampFloating, placeFloating, type Rect } from '../lib/floating-layout';
const view={left:0,top:0,width:800,height:1100},size={width:360,height:64};
const overlaps=(a:Rect,b:Rect)=>a.left<b.left+b.width&&a.left+a.width>b.left&&a.top<b.top+b.height&&a.top+a.height>b.top;
it('moves above a bottom composer instead of covering its send button',()=>{
  const composer={left:20,top:990,width:760,height:96};
  const p=placeFloating(size,view,{left:420,top:1016},[composer]);
  expect(overlaps({...p,...size},composer)).toBe(false);expect(p.top+size.height).toBeLessThan(composer.top);
});
it('avoids a fixed corner button without moving outside the viewport',()=>{
  const button={left:700,top:950,width:90,height:90},p=placeFloating(size,view,{left:420,top:1016},[button]);
  expect(overlaps({...p,...size},button)).toBe(false);expect(p.left).toBeGreaterThanOrEqual(12);expect(p.left+size.width).toBeLessThanOrEqual(788);
});
it('respects a reduced and offset visual viewport during keyboard use and zoom',()=>{
  const keyboardView={left:60,top:120,width:360,height:340},p=clampFloating({left:780,top:1000},{width:48,height:48},keyboardView);
  expect(p).toEqual({left:360,top:400});
});
it('keeps a dragged control visible after orientation changes',()=>{
  expect(clampFloating({left:-100,top:1000},size,{left:0,top:0,width:700,height:360})).toEqual({left:12,top:284});
});
