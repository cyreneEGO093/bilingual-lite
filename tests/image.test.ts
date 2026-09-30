import { it, expect, vi, afterEach } from 'vitest';
import { validateBubbles, translateImage, fetchImage } from '../lib/image-api';
import { fittedRect, ImageOverlay } from '../lib/image-dom';
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
it('cross-origin downloader omits cookies and does not attach API credentials',async()=>{
  const bytes=new TextEncoder().encode('mock');const fetch=vi.fn().mockResolvedValue(new Response(bytes,{headers:{'Content-Type':'image/png'}}));vi.stubGlobal('fetch',fetch);
  expect(await fetchImage('https://images.example.com/manga.png')).toBe('data:image/png;base64,bW9jaw==');
  expect(fetch.mock.calls[0]![1].credentials).toBe('omit');expect(fetch.mock.calls[0]![1].headers).toBeUndefined();
  await expect(fetchImage('file:///secret')).rejects.toThrow();
});
it('rejects non-image and oversized downloads',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('',{headers:{'Content-Type':'text/html'}})));await expect(fetchImage('https://example.com/a')).rejects.toThrow('仅支持');
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('',{headers:{'Content-Type':'image/png','Content-Length':'9000000'}})));await expect(fetchImage('https://example.com/a')).rejects.toThrow('8 MB');
});
it('maps contain and cover crops, including object position',()=>{
  expect(fittedRect(1600,1000,800,800,'contain','50% 50%')).toEqual({x:0,y:150,width:800,height:500});
  expect(fittedRect(1600,1000,800,800,'cover','100% 50%')).toEqual({x:-480,y:0,width:1280,height:800});
});
it('renders normalized bubbles safely and restores parent positioning',()=>{
  vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});vi.stubGlobal('requestAnimationFrame',()=>1);vi.stubGlobal('cancelAnimationFrame',()=>{});
  document.body.innerHTML='<div style="position:static"><img src="test.png"></div>';const img=document.querySelector('img')!;
  Object.defineProperty(img,'clientWidth',{value:800});Object.defineProperty(img,'clientHeight',{value:500});
  const overlay=new ImageOverlay(img,validateBubbles([{...bubble,translated:'<img onerror=evil()>你好'}]));
  const node=overlay.host.shadowRoot!.querySelector<HTMLElement>('.bubble')!;
  expect(node.style.left).toBe('9%');expect(node.style.top).toBe('10%');expect(node.querySelector('img')).toBeNull();expect(node.textContent).toContain('<img');
  expect(img.parentElement!.style.position).toBe('relative');overlay.destroy();expect(img.parentElement!.style.position).toBe('static');
});
