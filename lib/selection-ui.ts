// SPDX-License-Identifier: GPL-3.0-only
import { chunks } from './text-dom';
import type { TextItem, TextResult } from './text-api';
export const MAX_SELECTION_LENGTH=6000;
export function createSelectionUI(request:(items:TextItem[])=>Promise<TextResult[]>){
  const host=document.createElement('div');host.dataset.blOwned='selection';
  Object.assign(host.style,{position:'fixed',right:'12px',top:'12px',width:'min(420px, calc(100% - 24px))',zIndex:'2147483647'});
  const root=host.attachShadow({mode:'open'});
  root.innerHTML=`<style>:host{all:initial}*{box-sizing:border-box}[hidden]{display:none!important}
    .panel{font:14px/1.6 system-ui;color:#213b34;background:#f4f6f0;border:1px solid #cdd7cc;border-radius:12px;padding:16px;box-shadow:0 4px 24px #0004;max-height:70vh;max-height:70dvh;overflow:auto;overflow-wrap:anywhere}
    header{display:flex;gap:12px;align-items:center;justify-content:space-between}h2{font-size:16px;margin:0}button{font:inherit;min-height:36px;padding:5px 12px;border:1px solid #bccbbc;border-radius:8px;background:white;color:inherit;cursor:pointer}button:focus-visible{outline:2px solid #5e9c7c}p{margin:10px 0}.translation,.source{white-space:pre-wrap}summary{cursor:pointer}.source{color:#66766e}
  </style><section class="panel" role="dialog" aria-label="选中文本翻译" tabindex="-1"><header><h2>选中文本翻译</h2><button id="close" aria-label="关闭选中文本翻译">关闭</button></header><p id="status" role="status" aria-live="polite"></p><p class="translation" dir="auto"></p><details><summary>查看原文</summary><p class="source" dir="auto"></p></details><button id="retry" hidden>重试未完成</button></section>`;
  const status=root.querySelector<HTMLElement>('#status')!,result=root.querySelector<HTMLElement>('.translation')!,source=root.querySelector<HTMLElement>('.source')!,retry=root.querySelector<HTMLButtonElement>('#retry')!;
  let revision=0,items:TextItem[]=[],done=new Map<string,string>();
  const close=()=>{revision++;host.remove();items=[];done.clear();result.textContent=source.textContent='';};
  root.querySelector('#close')!.addEventListener('click',close);
  root.addEventListener('keydown',event=>{if((event as KeyboardEvent).key==='Escape'){event.stopPropagation();close();}});
  async function run(){
    const version=++revision;retry.hidden=true;status.textContent='正在翻译选中文本…';
    const missing=items.filter(item=>!done.has(item.id));
    try{
      // Reuse paragraph requests, queue, output limit and cache. A manual retry
      // retains completed chunks; closing stops subsequent chunks and rendering.
      for(const item of missing){
        const rows=await request([item]);if(version!==revision)return;
        const row=rows[0];
        if(rows.length!==1||!row||row.id!==item.id||typeof row.translated!=='string'||!row.translated.trim())throw new Error('选中文本译文格式无效，请重试。');
        done.set(item.id,row.translated);result.textContent=items.map(i=>done.get(i.id)).filter(Boolean).join('\n\n');
      }
      status.textContent='翻译完成。';
    }catch(error){if(version!==revision)return;status.textContent=error instanceof Error?error.message:'翻译失败，请重试。';retry.hidden=false;}
  }
  retry.addEventListener('click',()=>{void run();});
  return {root,host,close,destroy:close,translate:(value:unknown)=>{
    close();document.documentElement.append(host);root.querySelector<HTMLElement>('.panel')!.focus({preventScroll:true});retry.hidden=true;root.querySelector('details')!.open=false;
    if(typeof value!=='string'||!value.trim()){status.textContent='请先选中要翻译的文本。';return;}
    if(value.length>MAX_SELECTION_LENGTH){status.textContent=`单次最多选择 ${MAX_SELECTION_LENGTH} 字符，请缩小选区后重试。`;return;}
    const text=value.trim();source.textContent=text;items=chunks(text).map((text,index)=>({id:`selection-${index}`,text}));void run();
  }};
}
