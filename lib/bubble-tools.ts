// SPDX-License-Identifier: GPL-3.0-only
import { placeFloating, visibleViewport } from './floating-layout';
/** Touch editing controls live outside the text bubble, including very small bubbles. */
export class BubbleTools {
  readonly host=document.createElement('div');
  private selected?:HTMLElement;
  constructor(start:(node:HTMLElement,event:PointerEvent)=>void,finish:()=>void,private changed:()=>void){
    this.host.dataset.blOwned='bubble-tools';
    Object.assign(this.host.style,{position:'fixed',zIndex:'2147483646',display:'none',width:'max-content'});
    const root=this.host.attachShadow({mode:'open'});
    root.innerHTML='<style>:host{all:initial}.tools{display:flex;gap:4px;padding:4px;background:#f8fbf8;border:1px solid #8cae9d;border-radius:9px;box-shadow:0 2px 10px #0003}button{min-width:44px;height:44px;border:0;border-radius:6px;background:#245d48;color:white;font:14px system-ui;touch-action:none;user-select:none}button:focus-visible{outline:2px solid #d89017}</style><div class="tools"><button class="move-handle" data-action="move" aria-label="拖动移动选中的译文框">移动</button><button class="resize-handle" data-action="resize" aria-label="拖动缩放选中的译文框">缩放</button><button id="done">完成</button></div>';
    for(const button of root.querySelectorAll<HTMLButtonElement>('[data-action]'))button.addEventListener('pointerdown',event=>{if(this.selected)start(this.selected,event);});
    root.querySelector('#done')!.addEventListener('click',finish);
    document.documentElement.append(this.host);
    window.visualViewport?.addEventListener('resize',this.position);window.visualViewport?.addEventListener('scroll',this.position);
  }
  show(node?:HTMLElement){this.selected?.removeAttribute('data-selected');this.selected=node;node?.setAttribute('data-selected','');this.position();this.changed();}
  position=()=>{
    if(!this.selected?.isConnected||this.selected.closest('[hidden]')){this.host.style.display='none';return;}
    const r=this.selected.getBoundingClientRect(),v=visibleViewport();
    if(r.bottom<=v.top||r.top>=v.top+v.height||r.right<=v.left||r.left>=v.left+v.width){this.host.style.display='none';return;}
    this.host.style.display='block';
    const controls=document.querySelector('[data-bl-owned=controls]')?.getBoundingClientRect();
    const p=placeFloating({width:this.host.offsetWidth,height:this.host.offsetHeight},v,{left:r.left,top:r.bottom+12},[r,...(controls?[controls]:[])]);
    this.host.style.left=`${p.left}px`;this.host.style.top=`${p.top}px`;
  };
  rects(){return this.host.style.display==='none'?[]:[this.host.getBoundingClientRect()];}
  destroy(){this.show();this.host.remove();window.visualViewport?.removeEventListener('resize',this.position);window.visualViewport?.removeEventListener('scroll',this.position);}
}
