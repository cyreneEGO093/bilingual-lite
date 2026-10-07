// SPDX-License-Identifier: GPL-3.0-only
import { DEFAULT_PROMPTS, type PromptKind } from './custom-prompts';
import { getCustomPrompts, saveCustomPrompts } from './prompt-preferences';
export async function mountPromptSettings(container:HTMLElement,report:(message:unknown)=>void){
  container.innerHTML='<details class="overlay-settings"><summary>自定义翻译提示词</summary><p>分别修改翻译任务要求。{{targetLang}} 自动替换为目标语言；留空使用默认提示词。输出 JSON 格式、坐标规则仍由程序添加。提示词会发送给您配置的 API，较长内容会增加用量。</p><label>网页文本<textarea id="prompt-text" rows="4" maxlength="3000"></textarea></label><label>整图／漫画<textarea id="prompt-image" rows="5" maxlength="3000"></textarea></label><label>局部框选<textarea id="prompt-snippet" rows="4" maxlength="3000"></textarea></label><button id="save-prompts" type="button">保存提示词</button> <button id="reset-prompts" type="button">恢复默认提示词</button><p>保存后停止当前翻译并清除旧译文与缓存，请重新开启翻译。保存本身不发起模型请求。</p></details>';
  const kinds=Object.keys(DEFAULT_PROMPTS) as PromptKind[];
  const fields=Object.fromEntries(kinds.map(kind=>[kind,container.querySelector<HTMLTextAreaElement>(`#prompt-${kind}`)!])) as Record<PromptKind,HTMLTextAreaElement>;
  const save=container.querySelector<HTMLButtonElement>('#save-prompts')!,reset=container.querySelector<HTMLButtonElement>('#reset-prompts')!;
  const disable=(value:boolean)=>{save.disabled=reset.disabled=value;for(const field of Object.values(fields))field.disabled=value;};
  disable(true);try{const prompts=await getCustomPrompts();for(const kind of kinds)fields[kind].value=prompts[kind]||DEFAULT_PROMPTS[kind];}catch(e){report(e);}finally{disable(false);}
  const commit=async()=>{disable(true);try{await saveCustomPrompts(Object.fromEntries(kinds.map(kind=>[kind,fields[kind].value])));report('提示词已保存，请重新开启翻译。');}catch(e){report(e);}finally{disable(false);}};
  save.addEventListener('click',()=>void commit());
  reset.addEventListener('click',()=>{for(const kind of kinds)fields[kind].value=DEFAULT_PROMPTS[kind];void commit();});
}
