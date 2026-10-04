// SPDX-License-Identifier: GPL-3.0-only
import { expect, it } from 'vitest';
import { placeImageToolbar, type ToolbarRect } from '../lib/image-toolbar-layout';

const viewport={width:1000,height:800},size={width:480,height:36};
function check(image:ToolbarRect,bubbles:ToolbarRect[],toolbar=size,screen=viewport){
  const p=placeImageToolbar(image,toolbar,screen,bubbles);
  expect(p).toBeDefined();if(!p)throw new Error('No free position');
  expect(p.left).toBeGreaterThanOrEqual(4);expect(p.top).toBeGreaterThanOrEqual(4);
  expect(p.left+toolbar.width).toBeLessThanOrEqual(screen.width-4);expect(p.top+toolbar.height).toBeLessThanOrEqual(screen.height-4);
  for(const b of bubbles)expect(p.left+toolbar.width<=b.left-6||p.left>=b.left+b.width+6||p.top+toolbar.height<=b.top-6||p.top>=b.top+b.height+6).toBe(true);
  return p;
}
it('uses the margin above an image instead of covering its top-edge bubble',()=>{
  const p=check({left:30,top:80,width:800,height:1500},[{left:430,top:80,width:220,height:140}]);
  expect(p.top+size.height).toBeLessThan(80);
});
it('uses the bottom margin when there is no room above a short image',()=>{
  const p=check({left:30,top:0,width:800,height:500},[{left:350,top:0,width:400,height:150}]);
  expect(p.top).toBeGreaterThan(500);
});
it('avoids top bubbles when neither image margin fits on screen',()=>{
  const p=check({left:0,top:0,width:800,height:1800},[{left:350,top:0,width:400,height:150}]);
  expect(p.top).toBeGreaterThanOrEqual(156);
});
it('keeps the toolbar in view while a long image is scrolled',()=>{
  check({left:0,top:-900,width:800,height:2200},[{left:350,top:-20,width:400,height:180}]);
});
it('avoids multiple bubbles in a narrow viewport with a wrapped toolbar',()=>{
  check({left:0,top:0,width:360,height:1800},[{left:0,top:0,width:150,height:120},{left:220,top:160,width:140,height:180}],{width:352,height:72},{width:360,height:600});
});
it('reports a filled viewport so the UI can collapse rather than cover handles',()=>{
  const image={left:0,top:0,width:1000,height:1800};
  expect(placeImageToolbar(image,size,viewport,[image])).toBeUndefined();
  check(image,[{left:1,top:1,width:20,height:20}],{width:90,height:36});
});
