import { queue } from './api';
import { drawGeometry, IMAGE_QUALITY, type ImageLayout } from './image-geometry';
export async function fetchImage(url:unknown):Promise<string> {
  if(typeof url!=='string' || url.length>12000) throw new Error('图片地址无效。');
  const parsed=new URL(url); if(!['http:','https:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error('只支持 HTTP(S) 图片地址。');
  return queue.run(async()=>{
    let response:Response;
    try {response=await fetch(parsed.href,{credentials:'omit',signal:AbortSignal.timeout(30000)});} catch {throw new Error('图片下载失败，请检查网络。');}
    if(!response.ok) throw new Error(`图片下载失败（HTTP ${response.status}），可能需要登录或禁止外链。`);
    const mime=response.headers.get('Content-Type')?.split(';')[0]?.trim();
    if(!mime || !/^image\/(png|jpeg|webp|gif|avif)$/.test(mime)) throw new Error('仅支持 PNG、JPEG、WebP、GIF、AVIF 图片。');
    const limit=8*1024*1024;
    if(Number(response.headers.get('Content-Length'))>limit) throw new Error('原图超过 8 MB，请使用较小的图片。');
    const reader=response.body?.getReader(); if(!reader) throw new Error('图片下载失败。');
    const chunks:Uint8Array[]=[];let size=0;
    try {
      while(true) {const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit)throw new Error('原图超过 8 MB。');chunks.push(value);}
    } finally {await reader.cancel().catch(()=>{});}
    let binary=''; for(const chunk of chunks) for(let i=0;i<chunk.length;i+=8192) binary+=String.fromCharCode(...chunk.subarray(i,i+8192));
    return `data:${mime};base64,${btoa(binary)}`;
  });
}
export async function prepareRemoteImage(url:unknown,layout:ImageLayout):Promise<string> {
  if(!layout||![layout.width,layout.height].every(n=>Number.isFinite(n)&&n>0&&n<=100000)||!['fill','contain','cover','none','scale-down'].includes(layout.fit)||typeof layout.position!=='string'||layout.position.length>100)throw new Error('图片布局参数无效。');
  const raw=await fetchImage(url),[prefix,base64]=raw.split(',');
  const bytes=Uint8Array.from(atob(base64!),c=>c.charCodeAt(0));
  const bitmap=await createImageBitmap(new Blob([bytes],{type:prefix!.split(':')[1]!.split(';')[0]}));
  try{
    const g=drawGeometry(bitmap.width,bitmap.height,layout);
    const canvas=new OffscreenCanvas(g.width,g.height);
    const ctx=canvas.getContext('2d')!;ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(bitmap,g.x,g.y,g.drawWidth,g.drawHeight);
    const blob=await canvas.convertToBlob({type:'image/jpeg',quality:IMAGE_QUALITY});const result=new Uint8Array(await blob.arrayBuffer());
    let binary='';for(let i=0;i<result.length;i+=8192)binary+=String.fromCharCode(...result.subarray(i,i+8192));
    return `data:image/jpeg;base64,${btoa(binary)}`;
  }finally{bitmap.close();}
}
