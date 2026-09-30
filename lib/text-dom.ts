// SPDX-License-Identifier: GPL-3.0-only
import type { TextItem, TextResult } from './text-api';
import { hideOriginal } from './text-view';
import type { TextScope } from './text-scope';
import { OutputFormatError } from './translation-error';
const SELECTOR = 'p,h1,h2,h3,h4,h5,h6,li,blockquote,figcaption,td,th,article';
const EXCLUDE = '[data-bl-owned],script,style,noscript,pre,code,textarea,input,select,button,nav,header,footer,[contenteditable]:not([contenteditable="false"]),[translate="no"],[aria-hidden="true"],[hidden]';
export function textOf(element: HTMLElement): string {
  const walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT),parts:string[]=[];
  let node:Node|null;
  while((node=walker.nextNode())){
    let excluded=false;
    for(let parent=node.parentElement;parent;parent=parent.parentElement){
      if(parent.matches(EXCLUDE)&&parent.dataset.blOwned!=='source-wrapper'){excluded=true;break;}
      if(parent===element)break;
    }
    if(!excluded)parts.push(node.textContent??'');
  }
  return parts.join('').replace(/\s+/g,' ').trim();
}
export function candidates(root: ParentNode = document): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(SELECTOR)).filter(el => !el.closest(EXCLUDE) && !el.querySelector(SELECTOR) && textOf(el).length >= 3);
}
export function chunks(text: string): string[] {
  const result: string[] = [];
  while (text.length > 1200) {
    let end = text.lastIndexOf(' ',1200); if (end < 600) end = 1200;
    // Do not cut a UTF-16 surrogate pair in half.
    if (/[\uD800-\uDBFF]/.test(text.charAt(end-1))) end--;
    result.push(text.slice(0,end)); text = text.slice(end).trimStart();
  }
  if (text) result.push(text); return result;
}
export function renderTranslation(source: HTMLElement, text: string) {
  const node = document.createElement('div'); node.dataset.blOwned = 'translation'; node.className='bl-translation';
  node.textContent = text; node.dir='auto';
  const style = getComputedStyle(source);
  Object.assign(node.style,{ fontFamily:style.fontFamily, fontSize:style.fontSize, lineHeight:style.lineHeight, fontWeight:style.fontWeight, textAlign:style.textAlign, color:style.color });
  if (['LI','TD','TH'].includes(source.tagName)) source.append(node); else source.after(node);
  return node;
}
interface RecordState { source: string; parts: string[]; translated: (string | undefined)[]; inflight: Set<number>; failed: Set<number>; node?: HTMLElement; restore?:()=>void }
export class TextTranslator {
  enabled = false;
  onlyTranslated = false;
  scope: TextScope = 'viewport';
  paused = false;
  private consecutiveFailures = 0;
  private records = new Map<HTMLElement,RecordState>();
  private visible = new Set<HTMLElement>();
  private timer?: ReturnType<typeof setTimeout>;
  private scanTimer?: ReturnType<typeof setTimeout>;
  private epoch = 0;
  private busy = false;
  private observer: IntersectionObserver;
  private mutations: MutationObserver;
  get failedCount() { return [...this.records.values()].reduce((n,state)=>n+state.failed.size,0); }
  constructor(private send: (items: TextItem[]) => Promise<TextResult[]>, private report: (message:string) => void) {
    this.observer = new IntersectionObserver(entries => {
      for (const entry of entries) entry.isIntersecting ? this.visible.add(entry.target as HTMLElement) : this.visible.delete(entry.target as HTMLElement);
      this.schedule();
    }, { threshold:0.01 });
    this.mutations = new MutationObserver(entries => {
      if (entries.every(e => (e.target as Element).closest?.('[data-bl-owned]') || (e.type === 'childList' && [...e.addedNodes,...e.removedNodes].every(n => n instanceof Element && n.hasAttribute('data-bl-owned'))))) return;
      clearTimeout(this.scanTimer); this.scanTimer = setTimeout(()=>this.scan(),300);
    });
  }
  start() {
    if (this.enabled) return; this.enabled=true; this.epoch++; this.report(this.scope==='page'?'整页翻译已开启，将分批处理当前已加载的段落。':'滚动翻译已开启，只发送可见段落。');
    this.scan(); this.mutations.observe(document.body,{childList:true,subtree:true,characterData:true});
  }
  stop() {
    this.enabled=false; this.epoch++; clearTimeout(this.timer); clearTimeout(this.scanTimer);
    this.observer.disconnect(); this.mutations.disconnect(); this.visible.clear();
    for (const state of this.records.values()) {state.restore?.();state.node?.remove();} this.records.clear();this.onlyTranslated=false;this.paused=false;this.consecutiveFailures=0;
  }
  toggle() { if (this.enabled) { this.stop(); this.report('双语翻译已关闭。'); } else this.start(); }
  retryFailed() {
    if (!this.enabled || (!this.paused && !this.failedCount)) return;
    for (const state of this.records.values()) state.failed.clear();
    this.paused=false;this.consecutiveFailures=0;
    this.report('已继续翻译未完成的段落，已完成译文保持不变。');this.schedule();
  }
  setScope(scope: TextScope) {
    if (this.scope===scope) return;
    this.scope=scope;
    if(this.enabled){this.report(scope==='page'?'已切换整页翻译，将继续分批处理剩余段落。':'已切换滚动翻译，后续只处理可见段落。');this.schedule();}
  }
  toggleMode(){
    if(!this.enabled)return;
    this.onlyTranslated=!this.onlyTranslated;
    for(const [el,state] of this.records){state.restore?.();state.restore=undefined;if(this.onlyTranslated&&state.node)state.restore=hideOriginal(el,state.node);}
    this.report(this.onlyTranslated?'仅显示已完成的译文；未翻译段落继续保留原文。':'已恢复双语显示。');
  }
  private scan() {
    if (!this.enabled) return;
    for (const [el,state] of this.records) {
      // Remove our child translation before comparing source text in list/table cells.
      const own = state.node; const text = textOf(el);
      if (!el.isConnected || text !== state.source) { state.restore?.();own?.remove(); this.records.delete(el); this.visible.delete(el); this.observer.unobserve(el); }
    }
    for (const el of candidates()) {
      if (this.records.has(el)) continue;
      const source=textOf(el), parts=chunks(source);
      this.records.set(el,{source,parts,translated:[],inflight:new Set(),failed:new Set()}); this.observer.observe(el);
    }
    this.schedule();
  }
  private schedule() { clearTimeout(this.timer); if (this.enabled && !this.paused) this.timer=setTimeout(()=>void this.flush(),250); }
  private async flush() {
    if (!this.enabled || this.paused || this.busy) return;
    const work: { el:HTMLElement; state:RecordState; part:number; id:string; text:string }[]=[]; let size=0;
    for (const el of this.scope==='page'?this.records.keys():this.visible) {
      const state=this.records.get(el); if (!state || !el.isConnected || getComputedStyle(el).visibility==='hidden' || el.getClientRects().length===0) continue;
      for (let part=0;part<state.parts.length;part++) {
        const text=state.parts[part]!;
        if (state.translated[part] !== undefined || state.inflight.has(part) || state.failed.has(part)) continue;
        if (work.length>=6 || size+text.length>1800) break;
        size+=text.length; work.push({el,state,part,id:String(work.length),text});
      }
    }
    if (!work.length) return;
    const epoch=this.epoch; this.busy=true; work.forEach(w=>w.state.inflight.add(w.part));
    try {
      const result=await this.send(work.map(({id,text})=>({id,text})));
      if (!this.enabled || epoch!==this.epoch) return;
      // Validate the entire batch before touching DOM or recording partial success.
      if (!Array.isArray(result) || result.length!==work.length || new Set(result.map(r=>r?.id)).size!==work.length || work.some(w=>!result.some(r=>r?.id===w.id && typeof r.translated==='string' && r.translated.trim()))) throw new OutputFormatError('部分译文缺失或格式无效，请重试。');
      this.consecutiveFailures=0;
      for (const w of work) {
        if (this.records.get(w.el)!==w.state || !w.el.isConnected) continue;
        const translated=result.find(r=>r.id===w.id)!.translated;
        w.state.translated[w.part]=translated;
        if (w.state.parts.every((_,i)=>w.state.translated[i]!==undefined)) {w.state.node=renderTranslation(w.el,w.state.translated.join(' '));if(this.onlyTranslated)w.state.restore=hideOriginal(w.el,w.state.node);}
      }
      if(this.scope==='page'){
        const pending=[...this.records].some(([el,state])=>state.parts.some((_,i)=>state.translated[i]===undefined&&!state.failed.has(i))&&el.isConnected&&getComputedStyle(el).visibility!=='hidden'&&el.getClientRects().length>0);
        this.report(pending?'本批段落已完成，整页翻译继续处理中。':this.failedCount?`其余段落已完成，${this.failedCount} 个片段待重试。`:'当前已加载页面翻译完成。');
      }else this.report('可见段落翻译完成。滚动后按需继续。');
    } catch (e) {
      if (this.enabled && epoch===this.epoch) {
        for (const w of work) if (this.records.get(w.el)===w.state && w.el.isConnected && w.state.translated[w.part]===undefined) w.state.failed.add(w.part);
        this.consecutiveFailures++;
        this.paused=!(e instanceof OutputFormatError) || this.consecutiveFailures>=3;
        if(e instanceof OutputFormatError){
          this.report(this.paused?'连续 3 批译文格式异常，已暂停后续请求并保留现有译文。可点击“重试并继续”。':'本批译文格式异常，已保留原文并继续其他段落。可点击“重试未完成”。');
        }else this.report(`${e instanceof Error?e.message:'翻译失败。'} 已暂停并保留现有译文，可点击“重试并继续”。`);
      }
    } finally { this.busy=false; work.forEach(w=>w.state.inflight.delete(w.part)); this.schedule(); }
  }
}
