// SPDX-License-Identifier: GPL-3.0-only
import { it,expect,vi,afterEach } from 'vitest';
import { createSelectionUI,MAX_SELECTION_LENGTH } from '../lib/selection-ui';
afterEach(()=>document.querySelectorAll('[data-bl-owned=selection]').forEach(el=>el.remove()));
it('translates only the explicit selection and treats model output as text',async()=>{
  document.body.innerHTML='<p>Unrelated private passage</p>';
  const request=vi.fn(async items=>items.map((i:any)=>({id:i.id,translated:'<img src=x onerror=alert(1)>'})));
  const ui=createSelectionUI(request);ui.translate(' Selected words ');
  await vi.waitFor(()=>expect(ui.root.querySelector('#status')!.textContent).toBe('翻译完成。'));
  expect(request).toHaveBeenCalledWith([{id:'selection-0',text:'Selected words'}]);
  expect(ui.root.querySelector('.translation')!.textContent).toContain('<img');expect(ui.root.querySelector('img')).toBeNull();ui.destroy();
});
it('rejects empty or oversized selections without inference',()=>{
  const request=vi.fn(),ui=createSelectionUI(request);
  for(const value of [null,' ', 'x'.repeat(MAX_SELECTION_LENGTH+1)])ui.translate(value);
  expect(request).not.toHaveBeenCalled();expect(ui.root.querySelector('#status')!.textContent).toContain('6000');ui.destroy();
});
it('splits bounded selections and retries only unfinished chunks',async()=>{
  let failed=false;
  const request=vi.fn(async items=>{if(items[0].id==='selection-1'&&!failed){failed=true;throw new Error('HTTP 429');}return items.map((i:any)=>({id:i.id,translated:i.id}));});
  const ui=createSelectionUI(request);ui.translate('a'.repeat(2500));
  await vi.waitFor(()=>expect(ui.root.querySelector('#retry')!.hasAttribute('hidden')).toBe(false));
  expect(ui.root.querySelector('.translation')!.textContent).toBe('selection-0');
  (ui.root.querySelector('#retry') as HTMLButtonElement).click();
  await vi.waitFor(()=>expect(ui.root.querySelector('#status')!.textContent).toBe('翻译完成。'));
  expect(request.mock.calls.map(c=>c[0][0].id)).toEqual(['selection-0','selection-1','selection-1','selection-2']);
  expect(request.mock.calls.every(c=>c[0][0].text.length<=1200)).toBe(true);ui.destroy();
});
it('closing or replacing a selection discards late responses and stops later chunks',async()=>{
  let resolve!:(rows:any[])=>void;
  const request=vi.fn(()=>new Promise<any[]>(r=>resolve=r)),ui=createSelectionUI(request);
  ui.translate('a'.repeat(2500));ui.close();resolve([{id:'selection-0',translated:'stale'}]);
  await new Promise(r=>setTimeout(r,0));expect(request).toHaveBeenCalledTimes(1);expect(ui.host.isConnected).toBe(false);expect(ui.root.querySelector('.translation')!.textContent).toBe('');
  ui.translate('New');const old=resolve;ui.translate('Newest');old([{id:'selection-0',translated:'Old result'}]);
  await new Promise(r=>setTimeout(r,0));expect(ui.root.querySelector('.translation')!.textContent).toBe('');
  resolve([{id:'selection-0',translated:'New result'}]);await vi.waitFor(()=>expect(ui.root.querySelector('.translation')!.textContent).toBe('New result'));ui.destroy();
});
it('invalid IDs are surfaced as a retryable failure without rendering',async()=>{
  const ui=createSelectionUI(async()=>[{id:'wrong',translated:'Wrong result'}]);ui.translate('Hello');
  await vi.waitFor(()=>expect(ui.root.querySelector('#status')!.textContent).toContain('格式无效'));expect(ui.root.querySelector('.translation')!.textContent).toBe('');ui.destroy();
});
