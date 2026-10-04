// SPDX-License-Identifier: GPL-3.0-only
import { it, expect, vi, afterEach } from 'vitest';
import { scaledBox, moveBox, resizeBox, validateOverlayStyle } from '../lib/overlay-style';
import { ImageOverlay } from '../lib/image-overlay';
import type { Bubble } from '../lib/image-api';
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();document.body.innerHTML='';});
it('scales around the detected center and keeps even edge boxes on the image',()=>{
  expect(scaledBox([100,90,320,430],50)).toEqual({left:17.5,top:15.5,width:17,height:11});
  expect(scaledBox([800,800,1000,1000],200)).toEqual({left:60,top:60,width:40,height:40});
  expect(scaledBox([0,0,1000,1000],200)).toEqual({left:0,top:0,width:100,height:100});
});
it('clamps dragging and resizing to image bounds and a usable minimum',()=>{
  const box={left:30,top:40,width:20,height:30};
  expect(moveBox(box,100,-100)).toEqual({...box,left:80,top:0});
  expect(resizeBox(box,100,100)).toEqual({...box,width:70,height:60});
  expect(resizeBox(box,-100,-100)).toEqual({...box,width:2,height:2});
});
it.each([null,{transparency:101,size:100},{transparency:0,size:24},{transparency:0,size:201},{transparency:NaN,size:100},{transparency:'50',size:100}])('rejects invalid appearance %j',value=>{expect(()=>validateOverlayStyle(value)).toThrow();});
it('updates backgrounds and untouched boxes, preserves manual edits, and resets without new translation',()=>{
  vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});vi.stubGlobal('requestAnimationFrame',()=>1);vi.stubGlobal('cancelAnimationFrame',()=>{});
  document.body.innerHTML='<div style="position:static"><img></div>';const img=document.querySelector('img')!;
  Object.defineProperties(img,{clientWidth:{value:800},clientHeight:{value:500}});
  const bubble:Bubble={original:'Hello',translated:'你好',bbox:[100,90,320,430]};
  vi.stubGlobal('matchMedia',()=>({matches:false}));
  const overlay=new ImageOverlay(img,[bubble],{transparency:40,size:50});
  vi.spyOn(overlay.host,'getBoundingClientRect').mockReturnValue({width:800,height:500} as DOMRect);
  const node=overlay.host.shadowRoot!.querySelector<HTMLElement>('.bubble')!;
  expect(overlay.host.style.getPropertyValue('--bl-opacity')).toBe('0.6');expect(node.style.width).toBe('17%');
  node.querySelector('.move-handle')!.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
  expect(parseFloat(node.style.left)).toBeCloseTo(17.625);
  overlay.setStyle({transparency:70,size:100});expect(node.style.width).toBe('17%');expect(overlay.host.style.getPropertyValue('--bl-opacity')).toBeCloseTo(.3);
  overlay.resetLayout();expect(node.style.left).toBe('9%');expect(node.style.width).toBe('34%');
  overlay.add([{...bubble,bbox:[500,500,800,800]}]);expect(overlay.host.shadowRoot!.querySelectorAll('.bubble')).toHaveLength(2);
  overlay.setStyle({transparency:0,size:50});expect(node.style.width).toBe('17%');overlay.destroy();expect(img.parentElement!.style.position).toBe('static');
});
