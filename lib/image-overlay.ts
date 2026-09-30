import type { Bubble } from './image-api';
import { contentBox, type ImageTarget } from './image-capture';
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
    this.root.innerHTML='<style>:host{all:initial}:host([hidden]){display:none!important}.bubble{position:absolute;box-sizing:border-box;display:flex;align-items:center;justify-content:center;background:#fff;box-shadow:0 1px 5px #0002;border-radius:5px;color:#16271f;padding:3px;overflow:hidden;white-space:pre-wrap;overflow-wrap:anywhere;text-align:center;line-height:1.2;font-family:system-ui,sans-serif;font-size:clamp(10px,var(--bl-font,16px),24px);pointer-events:auto}.words{display:block;min-width:0;max-width:100%;max-height:100%;overflow:auto}</style>';
    this.parent.append(this.host);this.observer=new ResizeObserver(()=>this.update());this.observer.observe(target);this.observer.observe(this.parent);
    this.add(bubbles);this.tick();
  }
  add(bubbles:Bubble[],replace=false){
    if(replace)for(const b of bubbles)for(const node of this.root.querySelectorAll<HTMLElement>('.bubble')){
      const x=(parseFloat(node.style.left)+parseFloat(node.style.width)/2)*10,y=(parseFloat(node.style.top)+parseFloat(node.style.height)/2)*10;
      if(x>=b.bbox[1]&&x<=b.bbox[3]&&y>=b.bbox[0]&&y<=b.bbox[2])node.remove();
    }
    for(const b of bubbles){const node=document.createElement('span'),words=document.createElement('span');node.className='bubble';words.className='words';words.textContent=b.translated;node.append(words);node.title=b.original;node.dir='auto';const[y1,x1,y2,x2]=b.bbox;Object.assign(node.style,{left:`${x1/10}%`,top:`${y1/10}%`,width:`${(x2-x1)/10}%`,height:`${(y2-y1)/10}%`,pointerEvents:'none'});node.dataset.height=String((y2-y1)/1000);this.root.append(node);
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
    this.geometry='';this.update();
    if(this.editing){this.editing=false;this.edit();}
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
      let size=Math.max(10,Math.min(24,bh*.8,estimate*.9));node.style.setProperty('--bl-font',`${size}px`);
      const words=node.querySelector<HTMLElement>('.words')!;
      while(size>10&&(words.scrollHeight>words.clientHeight+1||words.scrollWidth>words.clientWidth+1)){size=Math.max(10,size-1);node.style.setProperty('--bl-font',`${size}px`);}
    }
  }
  toggle(){this.host.hidden=!this.host.hidden;}
  edit(){this.editing=!this.editing;this.host.hidden=false;for(const node of this.root.querySelectorAll<HTMLElement>('.bubble')){node.style.pointerEvents=this.editing?'auto':'none';node.style.outline=this.editing?'2px dashed #245d48':'';node.style.cursor=this.editing?'move':'';node.style.touchAction=this.editing?'none':'';node.style.userSelect=this.editing?'none':'';}return this.editing;}
  destroy(){if(this.disposed)return;this.disposed=true;cancelAnimationFrame(this.frame);this.observer.disconnect();this.host.remove();const record=parents.get(this.parent);if(record&&!--record.count){if(this.parent.style.position==='relative')this.parent.style.position=record.original;parents.delete(this.parent);}}
}
