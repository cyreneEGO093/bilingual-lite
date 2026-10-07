// SPDX-License-Identifier: GPL-3.0-only
import { browser } from 'wxt/browser';
export const DEFAULT_FLOATING_SCALE=100;
export function validateFloatingScale(value:unknown):number {
  if(typeof value!=='number'||!Number.isFinite(value)||value<75||value>150)throw new Error('悬浮工具大小须为 75%–150%。');
  return Math.round(value);
}
export async function getFloatingScale():Promise<number>{
  const {floatingScale}=await browser.storage.local.get('floatingScale');
  try{return validateFloatingScale(floatingScale);}catch{return DEFAULT_FLOATING_SCALE;}
}
export async function saveFloatingScale(value:unknown){await browser.storage.local.set({floatingScale:validateFloatingScale(value)});}
export async function mountFloatingSettings(container:HTMLElement,report:(message:unknown)=>void){
  container.innerHTML='<details class="overlay-settings"><summary>悬浮工具大小</summary><label>显示比例：<output id="floating-scale-value">100%</output><input id="floating-scale" type="range" min="75" max="150" step="5" value="100" disabled></label><p>调整翻译入口、展开面板及图片工具的按钮和文字，不改变漫画译文框大小。自动保存，当前页面立即生效。工具不自动避让网页内容，可手动拖动。</p><button id="floating-defaults" type="button" disabled>恢复默认大小</button></details>';
  const input=container.querySelector<HTMLInputElement>('#floating-scale')!,reset=container.querySelector<HTMLButtonElement>('#floating-defaults')!;
  const label=()=>{container.querySelector('output')!.textContent=`${input.value}%`;};
  try{input.value=String(await getFloatingScale());label();}catch(e){report(e);}finally{input.disabled=reset.disabled=false;}
  const save=async()=>{try{await saveFloatingScale(Number(input.value));report('悬浮工具大小已保存，当前页面已同步。');}catch(e){report(e);}};
  input.addEventListener('input',label);input.addEventListener('change',()=>{label();void save();});
  reset.addEventListener('click',()=>{input.value=String(DEFAULT_FLOATING_SCALE);label();void save();});
}
