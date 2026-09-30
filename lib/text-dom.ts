import type { TextItem, TextResult } from './text-api';
const SELECTOR = 'p,h1,h2,h3,h4,h5,h6,li,blockquote,figcaption,td,th';
const EXCLUDE = '[data-bl-owned],script,style,noscript,pre,code,textarea,input,select,button,nav,header,footer,[contenteditable]:not([contenteditable="false"]),[translate="no"],[aria-hidden="true"],[hidden]';
export function textOf(element: HTMLElement): string { return element.textContent?.replace(/\s+/g,' ').trim() ?? ''; }
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
interface RecordState { source: string; parts: string[]; translated: (string | undefined)[]; inflight: Set<number>; node?: HTMLElement }
export class TextTranslator {
  enabled = false;
  private records = new Map<HTMLElement,RecordState>();
  private visible = new Set<HTMLElement>();
  private timer?: ReturnType<typeof setTimeout>;
  private scanTimer?: ReturnType<typeof setTimeout>;
  private epoch = 0;
  private busy = false;
  private observer: IntersectionObserver;
  private mutations: MutationObserver;
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
    if (this.enabled) return; this.enabled=true; this.epoch++; this.report('双语翻译已开启，只发送可见段落。');
    this.scan(); this.mutations.observe(document.body,{childList:true,subtree:true,characterData:true});
  }
  stop() {
    this.enabled=false; this.epoch++; clearTimeout(this.timer); clearTimeout(this.scanTimer);
    this.observer.disconnect(); this.mutations.disconnect(); this.visible.clear();
    for (const state of this.records.values()) state.node?.remove(); this.records.clear();
  }
  toggle() { if (this.enabled) { this.stop(); this.report('双语翻译已关闭。'); } else this.start(); }
  private scan() {
    if (!this.enabled) return;
    for (const [el,state] of this.records) {
      // Remove our child translation before comparing source text in list/table cells.
      const own = state.node; const text = Array.from(el.childNodes).filter(n=>n!==own).map(n=>n.textContent).join('').replace(/\s+/g,' ').trim();
      if (!el.isConnected || text !== state.source) { own?.remove(); this.records.delete(el); this.visible.delete(el); this.observer.unobserve(el); }
    }
    for (const el of candidates()) {
      if (this.records.has(el)) continue;
      const source=textOf(el), parts=chunks(source);
      this.records.set(el,{source,parts,translated:[],inflight:new Set()}); this.observer.observe(el);
    }
    this.schedule();
  }
  private schedule() { clearTimeout(this.timer); if (this.enabled) this.timer=setTimeout(()=>void this.flush(),250); }
  private async flush() {
    if (!this.enabled || this.busy) return;
    const work: { el:HTMLElement; state:RecordState; part:number; id:string; text:string }[]=[]; let size=0;
    for (const el of this.visible) {
      const state=this.records.get(el); if (!state || !el.isConnected || getComputedStyle(el).visibility==='hidden' || el.getClientRects().length===0) continue;
      for (let part=0;part<state.parts.length;part++) {
        const text=state.parts[part]!;
        if (state.translated[part] !== undefined || state.inflight.has(part)) continue;
        if (work.length>=6 || size+text.length>3600) break;
        size+=text.length; work.push({el,state,part,id:String(work.length),text});
      }
    }
    if (!work.length) return;
    const epoch=this.epoch; this.busy=true; work.forEach(w=>w.state.inflight.add(w.part));
    try {
      const result=await this.send(work.map(({id,text})=>({id,text})));
      if (!this.enabled || epoch!==this.epoch) return;
      for (const w of work) {
        if (this.records.get(w.el)!==w.state || !w.el.isConnected) continue;
        const translated=result.find(r=>r.id===w.id)?.translated;
        if (translated===undefined) throw new Error('部分译文缺失，请重新开启翻译。');
        w.state.translated[w.part]=translated;
        if (w.state.parts.every((_,i)=>w.state.translated[i]!==undefined)) w.state.node=renderTranslation(w.el,w.state.translated.join(' '));
      }
      this.report('可见段落翻译完成。滚动后按需继续。');
    } catch (e) {
      if (epoch===this.epoch) { this.stop(); this.report(e instanceof Error?e.message:'翻译失败，请重试。'); }
    } finally { this.busy=false; work.forEach(w=>w.state.inflight.delete(w.part)); this.schedule(); }
  }
}
