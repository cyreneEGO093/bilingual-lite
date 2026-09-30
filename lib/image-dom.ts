import type { Bubble } from './image-api';
import { fittedRect, type ImageLayout } from './image-geometry';
export { fittedRect } from './image-geometry';
export type ImageTarget = HTMLImageElement | HTMLCanvasElement;
function contentBox(target:ImageTarget) {
  const css=getComputedStyle(target);
  const pl=parseFloat(css.paddingLeft)||0,pt=parseFloat(css.paddingTop)||0;
  return {css,pl,pt,w:target.clientWidth-pl-(parseFloat(css.paddingRight)||0),h:target.clientHeight-pt-(parseFloat(css.paddingBottom)||0)};
}
export async function captureImage(target:ImageTarget, fallback:(url:string,layout:ImageLayout)=>Promise<string>):Promise<string> {
  const {css,w,h}=contentBox(target);
  if(w<=0||h<=0)throw new Error('图片尚未显示。');
  const nw=target instanceof HTMLImageElement?target.naturalWidth:target.width;
  const nh=target instanceof HTMLImageElement?target.naturalHeight:target.height;
  if(!nw||!nh)throw new Error('图片尚未加载。');
  const scale=Math.min(1280/Math.max(w,h),Math.max(nw/w,nh/h));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(w*scale));canvas.height=Math.max(1,Math.round(h*scale));
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('无法创建图片画布。');
  const rect=fittedRect(nw,nh,w,h,css.objectFit||'fill',css.objectPosition||'50% 50%');
  const draw=(source:CanvasImageSource)=>{ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(source,rect.x*scale,rect.y*scale,rect.width*scale,rect.height*scale);return canvas.toDataURL('image/jpeg',.86);};
  try{return draw(target);}catch{
    if(!(target instanceof HTMLImageElement))throw new Error('此 Canvas 受跨域保护，无法读取。请翻译原始图片。');
    // Keep decode and compression in the background realm: Firefox otherwise
    // taints the page canvas when drawing an extension-principal data URL.
    return fallback(target.currentSrc||target.src,{width:w,height:h,fit:css.objectFit||'fill',position:css.objectPosition||'50% 50%'});
  }
}
const parents=new Map<HTMLElement,{count:number;original:string}>();
export class ImageOverlay {
  readonly host:HTMLDivElement;
  private parent:HTMLElement;
  private observer:ResizeObserver;
  private frame=0;
  private signature:string;
  private aspect:number;
  private root:ShadowRoot;
  private disposed=false;
  editing=false;
  private geometry='';
  constructor(private target:ImageTarget,bubbles:Bubble[]) {
    this.parent=(target.parentElement?.tagName==='PICTURE'?target.parentElement.parentElement:target.parentElement)??document.body;
    const record=parents.get(this.parent);
    if(record)record.count++;else{parents.set(this.parent,{count:1,original:this.parent.style.position});if(getComputedStyle(this.parent).position==='static')this.parent.style.position='relative';}
    const box=contentBox(target);this.aspect=box.w/box.h;this.signature=this.source();
    this.host=document.createElement('div');this.host.dataset.blOwned='image-overlay';
    Object.assign(this.host.style,{position:'absolute',pointerEvents:'none',zIndex:'2147483645',overflow:'hidden',margin:'0',padding:'0',border:'0'});
    this.root=this.host.attachShadow({mode:'open'});
    this.root.innerHTML='<style>:host{all:initial}:host([hidden]){display:none!important}.bubble{position:absolute;box-sizing:border-box;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.94);backdrop-filter:blur(5px);border-radius:5px;color:#16271f;padding:3px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;text-align:center;line-height:1.2;font-family:system-ui,sans-serif;pointer-events:auto}</style>';
    for(const b of bubbles){const node=document.createElement('span');node.className='bubble';node.textContent=b.translated;node.title=b.original;node.dir='auto';const[y1,x1,y2,x2]=b.bbox;Object.assign(node.style,{left:`${x1/10}%`,top:`${y1/10}%`,width:`${(x2-x1)/10}%`,height:`${(y2-y1)/10}%`,pointerEvents:'none'});node.dataset.height=String((y2-y1)/1000);this.root.append(node);
      node.addEventListener('pointerdown',event=>{
        if(!this.editing||event.button!==0)return;event.preventDefault();event.stopPropagation();node.setPointerCapture(event.pointerId);
        const start={x:event.clientX,y:event.clientY,left:parseFloat(node.style.left),top:parseFloat(node.style.top),width:parseFloat(node.style.width),height:parseFloat(node.style.height)};
        const bounds=this.host.getBoundingClientRect(),resize=event.shiftKey;
        const move=(e:PointerEvent)=>{const dx=(e.clientX-start.x)/bounds.width*100,dy=(e.clientY-start.y)/bounds.height*100;
          if(resize){node.style.width=`${Math.max(2,Math.min(100-start.left,start.width+dx))}%`;node.style.height=`${Math.max(2,Math.min(100-start.top,start.height+dy))}%`;node.dataset.height=String(parseFloat(node.style.height)/100);}
          else{node.style.left=`${Math.max(0,Math.min(100-start.width,start.left+dx))}%`;node.style.top=`${Math.max(0,Math.min(100-start.height,start.top+dy))}%`;}
          this.geometry='';this.update();
        };
        const end=()=>{node.removeEventListener('pointermove',move);node.removeEventListener('pointerup',end);node.removeEventListener('pointercancel',end);};
        node.addEventListener('pointermove',move);node.addEventListener('pointerup',end);node.addEventListener('pointercancel',end);
      });
    }
    this.parent.append(this.host);this.observer=new ResizeObserver(()=>this.update());this.observer.observe(target);this.observer.observe(this.parent);
    this.update();this.tick();
  }
  private source(){return this.target instanceof HTMLImageElement?this.target.currentSrc||this.target.src:`${this.target.width}x${this.target.height}`;}
  private tick=()=>{if(this.disposed)return;if(!this.target.isConnected){this.destroy();return;}this.update();this.frame=requestAnimationFrame(this.tick);};
  private update() {
    const {w,h,pl,pt}=contentBox(this.target);
    if(this.source()!==this.signature||Math.abs(w/h-this.aspect)>.02){this.host.hidden=true;this.host.dataset.stale='true';return;}
    const rect=this.target.getBoundingClientRect(),parent=this.parent.getBoundingClientRect();
    const sx=this.parent.offsetWidth?parent.width/this.parent.offsetWidth:1,sy=this.parent.offsetHeight?parent.height/this.parent.offsetHeight:1;
    const geometry=[rect.x,rect.y,parent.x,parent.y,w,h,sx,sy,this.parent.scrollLeft,this.parent.scrollTop].join(',');if(geometry===this.geometry)return;this.geometry=geometry;
    Object.assign(this.host.style,{left:`${(rect.left-parent.left)/(sx||1)-this.parent.clientLeft+this.parent.scrollLeft+this.target.clientLeft+pl}px`,top:`${(rect.top-parent.top)/(sy||1)-this.parent.clientTop+this.parent.scrollTop+this.target.clientTop+pt}px`,width:`${w}px`,height:`${h}px`});
    for(const node of this.root.querySelectorAll<HTMLElement>('.bubble')){
      const bh=h*Number(node.dataset.height),bw=w*parseFloat(node.style.width)/100;
      const estimate=Math.sqrt(Math.max(1,(bw-6)*(bh-6))/Math.max(1,(node.textContent?.length??1)*.85));
      node.style.fontSize=`${Math.max(10,Math.min(24,bh*.8,estimate*.9))}px`;
    }
  }
  toggle(){this.host.hidden=!this.host.hidden;}
  edit(){this.editing=!this.editing;this.host.hidden=false;for(const node of this.root.querySelectorAll<HTMLElement>('.bubble')){node.style.pointerEvents=this.editing?'auto':'none';node.style.outline=this.editing?'2px dashed #245d48':'';node.style.cursor=this.editing?'move':'';node.style.touchAction=this.editing?'none':'';node.style.userSelect=this.editing?'none':'';}return this.editing;}
  destroy(){if(this.disposed)return;this.disposed=true;cancelAnimationFrame(this.frame);this.observer.disconnect();this.host.remove();const record=parents.get(this.parent);if(record&&!--record.count){if(this.parent.style.position==='relative')this.parent.style.position=record.original;parents.delete(this.parent);}}
}
export function installImageUI(send:(message:unknown)=>Promise<any>,report:(text:string)=>void) {
  const host=document.createElement('div');host.dataset.blOwned='image-button';Object.assign(host.style,{position:'fixed',zIndex:'2147483647',display:'none'});
  const root=host.attachShadow({mode:'open'});root.innerHTML='<style>button{font:13px system-ui;border:1px solid #d5e4d7;background:#245d48;color:#fff;border-radius:8px;padding:8px 12px;cursor:pointer;box-shadow:0 2px 12px #0004}button:disabled{opacity:.65}button[hidden]{display:none}</style><button>翻译图片</button><button id="adjust" hidden>校准位置</button>';
  document.documentElement.append(host);const button=root.querySelector('button')!,adjust=root.querySelector<HTMLButtonElement>('#adjust')!;
  let current:ImageTarget|undefined,lastContext:ImageTarget|undefined,epoch=0;const busy=new WeakSet<ImageTarget>();const overlays=new Map<ImageTarget,ImageOverlay>();
  const position=()=>{if(!current?.isConnected){host.style.display='none';return;}const rect=current.getBoundingClientRect(),width=host.offsetWidth;host.style.left=`${Math.max(4,Math.min(innerWidth-width-4,rect.right-width-4))}px`;host.style.top=`${Math.max(4,rect.top+8)}px`;};
  const over=(e:Event)=>{const target=e.target;if(target===host||(target instanceof Element&&target.closest('[data-bl-owned=image-overlay]')))return;if(target instanceof HTMLImageElement||target instanceof HTMLCanvasElement){if(target.clientWidth<60||target.clientHeight<60)return;current=target;host.style.display='block';button.textContent=overlays.has(target)?'切换图片译文':'翻译图片';button.disabled=busy.has(target);adjust.hidden=!overlays.has(target);adjust.textContent=overlays.get(target)?.editing?'完成校准':'校准位置';position();}else{host.style.display='none';}};
  const context=(e:Event)=>{lastContext=e.target instanceof HTMLImageElement||e.target instanceof HTMLCanvasElement?e.target:undefined;};
  const translate=async(target:ImageTarget)=>{
    const previous=overlays.get(target);
    if(previous&&!previous.host.dataset.stale){previous.toggle();return;}
    previous?.destroy();overlays.delete(target);if(busy.has(target))return;
    const turn=epoch;busy.add(target);button.disabled=true;button.textContent='翻译中…';report('正在读取图片并翻译气泡…');
    const source=target instanceof HTMLImageElement?target.currentSrc:undefined;
    try{
      const dataUrl=await captureImage(target,async(url,layout)=>{const r=await send({type:'fetchImage',url,layout});if(!r.ok)throw new Error(r.error);return r.data;});
      if(turn!==epoch)return;
      const result=await send({type:'translateImage',dataUrl});if(!result.ok)throw new Error(result.error);
      if(turn!==epoch||!target.isConnected||(target instanceof HTMLImageElement&&target.currentSrc!==source))return;
      if(!result.data.length){report('图片中没有识别到可读文字。');return;}
      overlays.set(target,new ImageOverlay(target,result.data));adjust.hidden=false;report(`已翻译 ${result.data.length} 个气泡。位置有偏差时可点击“校准位置”。`);
    }catch(e){report(e instanceof Error?e.message:'图片翻译失败。');}finally{busy.delete(target);button.disabled=current?busy.has(current):false;button.textContent=current&&overlays.has(current)?'切换图片译文':'翻译图片';adjust.hidden=!current||!overlays.has(current);adjust.textContent=current&&overlays.get(current)?.editing?'完成校准':'校准位置';position();}
  };
  button.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();if(current)void translate(current);});
  adjust.addEventListener('click',()=>{if(!current)return;const editing=overlays.get(current)?.edit();adjust.textContent=editing?'完成校准':'校准位置';report(editing?'拖动气泡移动位置；按住 Shift 拖动调整大小。校准不调用 API。':'校准完成。位置按比例随图片缩放。');});
  document.addEventListener('pointerover',over,true);document.addEventListener('contextmenu',context,true);window.addEventListener('scroll',position,true);window.addEventListener('resize',position);
  return {contextTranslate:(url?:string)=>{const target=lastContext??Array.from(document.images).find(img=>img.currentSrc===url||img.src===url);if(target)void translate(target);else report('未找到该图片，请使用图片悬浮按钮。');},reset:()=>{epoch++;for(const overlay of overlays.values())overlay.destroy();overlays.clear();},destroy:()=>{epoch++;for(const overlay of overlays.values())overlay.destroy();overlays.clear();host.remove();document.removeEventListener('pointerover',over,true);document.removeEventListener('contextmenu',context,true);window.removeEventListener('scroll',position,true);window.removeEventListener('resize',position);}};
}
