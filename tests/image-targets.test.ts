// SPDX-License-Identifier: GPL-3.0-only
import { afterEach,expect,it } from 'vitest';
import { contextImage,pageImages } from '../lib/image-targets';
afterEach(()=>document.body.innerHTML='');
function image(url:string,width=400,height=200){const img=document.createElement('img');img.src=url;Object.defineProperties(img,{naturalWidth:{value:800},naturalHeight:{value:400},complete:{value:true}});img.getBoundingClientRect=()=>({left:0,top:2000,width,height,right:width,bottom:2000+height}) as DOMRect;document.body.append(img);return img;}
it('includes loaded offscreen images but excludes small, hidden and extension images',()=>{const valid=image('https://example.test/a.png');image('https://example.test/small.png',32,32);image('https://example.test/hidden.png').style.visibility='hidden';const own=image('https://example.test/own.png');own.dataset.blOwned='test';expect(pageImages()).toEqual([valid]);});
it('prefers the clicked matching node and rejects stale or mismatched context targets',()=>{const a=image('https://example.test/a.png'),b=image('https://example.test/b.png');expect(contextImage(a,b.src)).toBe(b);expect(contextImage(a,a.src)).toBe(a);a.remove();expect(contextImage(a,a.src)).toBeUndefined();});
