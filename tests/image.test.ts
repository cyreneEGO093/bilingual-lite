// SPDX-License-Identifier: GPL-3.0-only
import { it, expect, vi, afterEach } from 'vitest';
import { validateBubbles, translateImage, translateSnippet, fetchImage } from '../lib/image-api';
import { fittedRect, ImageOverlay } from '../lib/image-dom';
import { drawGeometry, validateRegion, IMAGE_QUALITY } from '../lib/image-geometry';
const settings={baseUrl:'https://openrouter.ai/api/v1',apiKey:'mock-key',targetLang:'简体中文',textModel:'test',visionModel:'vision'};
const bubble={original:'Hello',translated:'你好',bbox:[100,90,320,430]};
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();document.body.innerHTML='';});
it('uses image_url parts and validates the vision JSON',async()=>{
  const fetch=vi.fn().mockResolvedValue({ok:true,json:async()=>({choices:[{message:{content:JSON.stringify([bubble])}}]})});vi.stubGlobal('fetch',fetch);
  expect(await translateImage(settings,'data:image/jpeg;base64,YQ==')).toEqual([bubble]);
  const body=JSON.parse(fetch.mock.calls[0]![1].body);expect(body.model).toBe('vision');expect(body.messages[1].content[1].image_url.url).toBe('data:image/jpeg;base64,YQ==');expect(body.max_tokens).toBe(1500);
});
it.each([[320,90,100,430],[-1,0,400,400],[0,0,1001,400],[0,0,NaN,400],[0,10,20,10]])('rejects invalid bbox %j',(...bbox)=>{expect(()=>validateBubbles([{...bubble,bbox}])).toThrow();});
it('allows empty image results and rejects oversized image input',async()=>{
  expect(validateBubbles([])).toEqual([]);await expect(translateImage(settings,'https://example.com/image.png')).rejects.toThrow('无效');
});
it('requests right-to-left full-image coordinates but no coordinates in snippet mode',async()=>{
  const fetch=vi.fn().mockResolvedValue({ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({original:'こんにちは',translated:'你好'})}}]})});vi.stubGlobal('fetch',fetch);
  expect(await translateSnippet(settings,'data:image/jpeg;base64,YQ==')).toEqual({original:'こんにちは',translated:'你好'});
  const body=JSON.parse(fetch.mock.calls[0]![1].body);expect(body.messages[0].content).toContain('No coordinates');expect(body.max_tokens).toBe(1500);
  fetch.mockResolvedValue({ok:true,json:async()=>({choices:[{message:{content:'[]'}}]})});await translateImage(settings,'data:image/jpeg;base64,YQ==');expect(JSON.parse(fetch.mock.calls[1]![1].body).messages[0].content).toContain('RIGHT TO LEFT');
});
it.each(['deepseek/deepseek-v4.1-flash','inclusionai/ling-3.0-flash-vl'])('uses verified structured output for %s and validates wrapped bubbles',async visionModel=>{
  const fetch=vi.fn().mockResolvedValue({ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({bubbles:[bubble]})}}]})});vi.stubGlobal('fetch',fetch);
  expect(await translateImage({...settings,visionModel},'data:image/jpeg;base64,YQ==')).toEqual([bubble]);
  const body=JSON.parse(fetch.mock.calls[0]![1].body);expect(body.response_format).toMatchObject({type:'json_schema',json_schema:{strict:true}});expect(body.provider).toEqual({require_parameters:true});
  expect(body.response_format.json_schema.schema.properties.bubbles.items.required).toContain('bbox');
});
it('cross-origin downloader omits cookies and does not attach API credentials',async()=>{
  const bytes=new TextEncoder().encode('mock');const fetch=vi.fn().mockResolvedValue(new Response(bytes,{headers:{'Content-Type':'image/png'}}));vi.stubGlobal('fetch',fetch);
  expect(await fetchImage('https://images.example.com/manga.png')).toBe('data:image/png;base64,bW9jaw==');
  expect(fetch.mock.calls[0]![1].credentials).toBe('omit');expect(fetch.mock.calls[0]![1].headers).toBeUndefined();
  expect(fetch.mock.calls[0]![1].redirect).toBe('error');expect(fetch.mock.calls[0]![1].referrerPolicy).toBe('no-referrer');
  await expect(fetchImage('file:///secret')).rejects.toThrow();
});
it('rejects unencrypted remote downloads before any network request',async()=>{
  const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
  await expect(fetchImage('http://images.example.com/page.png')).rejects.toThrow('HTTPS');expect(fetch).not.toHaveBeenCalled();
  fetch.mockResolvedValue(new Response(new Uint8Array([1]),{headers:{'Content-Type':'image/png'}}));
  expect(await fetchImage('http://127.0.0.1:8787/mock.png')).toMatch(/^data:image\/png;base64,/);
});
it('rejects non-image and oversized downloads',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('',{headers:{'Content-Type':'text/html'}})));await expect(fetchImage('https://example.com/a')).rejects.toThrow('仅支持');
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('',{headers:{'Content-Type':'image/png','Content-Length':'9000000'}})));await expect(fetchImage('https://example.com/a')).rejects.toThrow('8 MB');
});
it('maps contain and cover crops, including object position',()=>{
  expect(fittedRect(1600,1000,800,800,'contain','50% 50%')).toEqual({x:0,y:150,width:800,height:500});
  expect(fittedRect(1600,1000,800,800,'cover','100% 50%')).toEqual({x:-480,y:0,width:1280,height:800});
});
it('crops before downsampling and uses the same geometry for page and background',()=>{
  const layout={width:800,height:500,fit:'fill',position:'50% 50%'};
  expect(drawGeometry(1600,1000,layout)).toMatchObject({width:1280,height:800});
  expect(drawGeometry(1600,1000,{...layout,crop:{left:.5,top:.5,width:.25,height:.25}})).toEqual({width:400,height:250,x:-800,y:-500,drawWidth:1600,drawHeight:1000});
  expect(drawGeometry(100,80,{...layout,width:100,height:80})).toMatchObject({width:100,height:80});
  expect(()=>validateRegion({left:.9,top:0,width:.2,height:.3})).toThrow();expect(()=>validateRegion({left:0,top:0,width:NaN,height:1})).toThrow();expect(IMAGE_QUALITY).toBe(.85);
});
it('renders normalized bubbles safely and restores parent positioning',()=>{
  vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});vi.stubGlobal('requestAnimationFrame',()=>1);vi.stubGlobal('cancelAnimationFrame',()=>{});
  document.body.innerHTML='<div style="position:static"><img src="test.png"></div>';const img=document.querySelector('img')!;
  Object.defineProperty(img,'clientWidth',{value:800});Object.defineProperty(img,'clientHeight',{value:500});
  vi.stubGlobal('matchMedia',()=>({matches:false}));
  const overlay=new ImageOverlay(img,validateBubbles([{...bubble,translated:'<img onerror=evil()>你好'}]));
  const node=overlay.host.shadowRoot!.querySelector<HTMLElement>('.bubble')!;
  expect(node.style.left).toBe('9%');expect(node.style.top).toBe('10%');expect(node.querySelector('img')).toBeNull();expect(node.textContent).toContain('<img');
  expect(img.parentElement!.style.position).toBe('relative');overlay.destroy();expect(img.parentElement!.style.position).toBe('static');
});
