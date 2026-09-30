// SPDX-License-Identifier: GPL-3.0-only
import { getOverlayStyle, saveOverlayStyle } from './overlay-preferences';
import { DEFAULT_OVERLAY_STYLE } from './overlay-style';

export async function mountOverlaySettings(container:HTMLElement,report:(message:unknown)=>void){
  container.innerHTML=`<details class="overlay-settings"><summary>漫画译文框外观</summary>
    <label>默认背景透明度：<output id="overlay-transparency-value">0%</output><input id="overlay-transparency" type="range" min="0" max="100" step="1" value="0" disabled></label>
    <p>0% 为纯白，100% 为透明；文字保持清晰。</p>
    <label>默认大小：<output id="overlay-size-value">100%</output><input id="overlay-size" type="range" min="25" max="200" step="5" value="100" disabled></label>
    <p>按识别框或选区比例缩放，自动保存。已手动调整的框保留位置和大小；可用图片工具条的“重置框位”重新套用。</p>
    <button type="button" id="overlay-defaults">恢复默认外观</button>
    </details>`;
  const transparency=container.querySelector<HTMLInputElement>('#overlay-transparency')!,size=container.querySelector<HTMLInputElement>('#overlay-size')!;
  const reset=container.querySelector<HTMLButtonElement>('#overlay-defaults')!;
  const labels=()=>{container.querySelector('#overlay-transparency-value')!.textContent=`${transparency.value}%`;container.querySelector('#overlay-size-value')!.textContent=`${size.value}%`;};
  reset.disabled=true;
  try{const style=await getOverlayStyle();transparency.value=String(style.transparency);size.value=String(style.size);labels();}catch(e){report(e);}finally{transparency.disabled=size.disabled=reset.disabled=false;}
  // Input updates labels immediately; change commits on release (also keyboard).
  const save=async()=>{try{await saveOverlayStyle({transparency:Number(transparency.value),size:Number(size.value)});report('译文框外观已保存，当前页面已同步。');}catch(e){report(e);}};
  for(const control of [transparency,size]){control.addEventListener('input',labels);control.addEventListener('change',()=>{labels();void save();});}
  reset.addEventListener('click',()=>{transparency.value=String(DEFAULT_OVERLAY_STYLE.transparency);size.value=String(DEFAULT_OVERLAY_STYLE.size);labels();void save();});
}
