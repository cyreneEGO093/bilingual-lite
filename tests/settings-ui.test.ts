import { it, expect, vi } from 'vitest';
const api = vi.hoisted(() => ({ get:vi.fn().mockResolvedValue({}), set:vi.fn().mockResolvedValue(undefined), sendMessage:vi.fn().mockResolvedValue({ok:true,data:[{id:'cheap-vision',vision:true,context:1000000,pricing:{prompt:'0.0000001'}}]}) }));
vi.mock('wxt/browser',()=>({browser:{storage:{local:api},runtime:api}}));
import { mountSettings } from '../lib/settings-ui';
it('saves the actual form and populates vision model choices',async()=>{
  document.body.innerHTML='<main id="app"></main>';
  await mountSettings();
  (document.querySelector('[name="apiKey"]') as HTMLInputElement).value='mock-key';
  document.querySelector('form')!.dispatchEvent(new Event('submit',{cancelable:true}));
  await vi.waitFor(()=>expect(api.set).toHaveBeenCalled());
  expect(api.set.mock.calls[0]![0].settings.apiKey).toBe('mock-key');
  (document.querySelector('#models') as HTMLButtonElement).click();
  await vi.waitFor(()=>expect(document.querySelector('#image-models option')?.getAttribute('value')).toBe('cheap-vision'));
  expect(document.querySelector('#status')?.textContent).toContain('连接成功');
});
