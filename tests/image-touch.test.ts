// SPDX-License-Identifier: GPL-3.0-only
import { afterEach, expect, it, vi } from 'vitest';
import { eligibleImage, installImageTouch } from '../lib/image-touch';
let dispose:(()=>void)|undefined;
afterEach(()=>{dispose?.();vi.useRealTimers();document.body.innerHTML='';});
function fixture(){vi.useFakeTimers();document.body.innerHTML='<a href="#image"><img></a>';const img=document.querySelector('img')!;Object.defineProperties(img,{clientWidth:{value:280},clientHeight:{value:200},naturalWidth:{value:1000}});const show=vi.fn();dispose=installImageTouch(show);return {img,show};}
function pointer(target:Element,type:string,props:Record<string,unknown>={}){const e=new Event(type,{bubbles:true,cancelable:true});Object.assign(e,{pointerId:1,pointerType:'touch',isPrimary:true,clientX:20,clientY:20,...props});target.dispatchEvent(e);}
it('supports phone-sized images without enabling small desktop hover targets',()=>{const {img}=fixture();expect(eligibleImage(img,true)).toBe(true);expect(eligibleImage(img)).toBe(false);});
it('a tap leaves image links alone; a long press opens tools and suppresses navigation',()=>{
  const {img,show}=fixture();pointer(img,'pointerdown');vi.advanceTimersByTime(100);pointer(img,'pointerup');expect(show).not.toHaveBeenCalled();
  const tap=new MouseEvent('click',{bubbles:true,cancelable:true});img.dispatchEvent(tap);expect(tap.defaultPrevented).toBe(false);
  pointer(img,'pointerdown');vi.advanceTimersByTime(450);pointer(img,'pointerup');expect(show).toHaveBeenCalledExactlyOnceWith(img);
  const heldClick=new MouseEvent('click',{bubbles:true,cancelable:true});img.dispatchEvent(heldClick);expect(heldClick.defaultPrevented).toBe(true);
  vi.advanceTimersByTime(801);const later=new MouseEvent('click',{bubbles:true,cancelable:true});img.dispatchEvent(later);expect(later.defaultPrevented).toBe(false);
});
it.each(['move','scroll','multitouch','cancel'])('does not open tools during %s',mode=>{
  const {img,show}=fixture();pointer(img,'pointerdown');
  if(mode==='move')pointer(img,'pointermove',{clientY:45});
  if(mode==='scroll')window.dispatchEvent(new Event('scroll'));
  if(mode==='multitouch')pointer(img,'pointerdown',{pointerId:2,isPrimary:false});
  if(mode==='cancel')pointer(img,'pointercancel');
  vi.advanceTimersByTime(600);expect(show).not.toHaveBeenCalled();
});
