// SPDX-License-Identifier: GPL-3.0-only
import { afterEach, expect, it, vi } from 'vitest';
import { installImageUI } from '../lib/image-ui';
import type { Bubble, Snippet } from '../lib/image-api';
import type { Region } from '../lib/image-geometry';

vi.mock('../lib/image-capture',async original=>({...await original<object>(),captureImage:vi.fn(async()=> 'data:image/jpeg;base64,MOCK')}));
let select:((crop?:Region)=>void)|undefined;
vi.mock('../lib/image-snip',()=>({selectRegion:(_target:unknown,cb:(crop?:Region)=>void)=>{select=cb;return ()=>{select=undefined;};}}));
const bubbles:Bubble[]=[{original:'Hello',translated:'你好',bbox:[100,100,250,250]}];
const uis:ReturnType<typeof installImageUI>[]=[];
afterEach(()=>{uis.splice(0).forEach(ui=>ui.destroy());vi.unstubAllGlobals();vi.restoreAllMocks();document.body.innerHTML='';select=undefined;});
function setup(){
  vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});
  vi.stubGlobal('requestAnimationFrame',()=>1);vi.stubGlobal('cancelAnimationFrame',()=>{});
  vi.stubGlobal('matchMedia',()=>({matches:false}));
  document.body.innerHTML='<div><img src="https://example.test/one.png"></div><div><img src="https://example.test/two.png"></div>';
  const images=[...document.images];
  for(const img of images){
    for(const [key,value] of Object.entries({clientWidth:800,clientHeight:500,naturalWidth:800,naturalHeight:500,complete:true,currentSrc:img.src}))Object.defineProperty(img,key,{value});
    vi.spyOn(img,'getBoundingClientRect').mockReturnValue({x:0,y:0,left:0,top:0,right:800,bottom:500,width:800,height:500,toJSON:()=>({})});
  }
  const transport={fetchImage:vi.fn(async()=>''),full:vi.fn(async()=>bubbles),snippet:vi.fn(async()=>({original:'Crop',translated:'局部译文'}))};
  const report=vi.fn(),ui=installImageUI(transport,report);uis.push(ui);
  const root=document.querySelector('[data-bl-owned=image-button]')!.shadowRoot!;
  const button=(id:string)=>root.querySelector<HTMLButtonElement>('#'+id)!;
  const overlay=(i=0)=>images[i]!.parentElement!.querySelector('[data-bl-owned=image-overlay]');
  return {images,transport,report,ui,button,overlay};
}
const flush=async()=>{for(let i=0;i<15;i++)await Promise.resolve();};
it('deletes full and crop results, keeps other images, and retranslates without stale cache',async()=>{
  const {ui,images,transport,button,overlay}=setup();
  ui.contextTranslate(images[1]!.src);await flush();ui.contextTranslate(images[0]!.src);await flush();
  button('snip').click();select!({left:.6,top:.6,width:.3,height:.3});await flush();
  expect(overlay()!.shadowRoot!.querySelectorAll('.bubble')).toHaveLength(2);
  button('clear').click();expect((overlay() as HTMLElement).hidden).toBe(true);
  button('clear').click();expect((overlay() as HTMLElement).hidden).toBe(false);
  button('adjust').click();button('discard').click();
  expect(overlay()).toBeNull();expect(overlay(1)).not.toBeNull();
  expect(button('clear').disabled).toBe(true);expect(button('discard').disabled).toBe(true);
  expect(button('adjust').hidden).toBe(true);expect(button('reset-layout').hidden).toBe(true);
  expect(transport.full).toHaveBeenCalledTimes(2);
  button('full').click();await flush();expect(transport.full).toHaveBeenCalledTimes(3);
  expect(overlay()!.shadowRoot!.querySelectorAll('.bubble')).toHaveLength(1);
});
it.each(['full','snippet'] as const)('clearing during %s ignores late results without unlocking a newer request',async mode=>{
  const {ui,images,transport,button,overlay}=setup();
  let oldResolve!:(v:Bubble[]|Snippet)=>void,newResolve!:(v:Bubble[])=>void;
  if(mode==='full')transport.full.mockImplementationOnce(()=>new Promise(r=>{oldResolve=r as typeof oldResolve;}));
  ui.contextTranslate(images[0]!.src);await flush();
  if(mode==='snippet'){transport.snippet.mockImplementationOnce(()=>new Promise(r=>{oldResolve=r as typeof oldResolve;}));button('snip').click();select!({left:.6,top:.6,width:.3,height:.3});await flush();}
  expect(button('discard').disabled).toBe(false);button('discard').click();expect(overlay()).toBeNull();
  transport.full.mockImplementationOnce(()=>new Promise(r=>{newResolve=r;}));button('full').click();await flush();
  oldResolve(mode==='full'?bubbles:{original:'Old crop',translated:'旧结果'});await flush();
  expect(overlay()).toBeNull();expect(button('full').disabled).toBe(true);
  newResolve(bubbles);await flush();expect(overlay()).not.toBeNull();expect(button('full').disabled).toBe(false);
});
it('skips a cleared target waiting in the current page-image batch',async()=>{
  const {ui,images,transport,button,overlay}=setup();
  ui.contextTranslate(images[1]!.src);await flush();
  let resolve!:(value:Bubble[])=>void;transport.full.mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));
  ui.translatePage();await flush();button('discard').click();expect(overlay(1)).toBeNull();
  resolve(bubbles);await flush();expect(overlay()).not.toBeNull();expect(overlay(1)).toBeNull();
  expect(transport.full).toHaveBeenCalledTimes(2);
});
