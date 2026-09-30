import { getTranslationProfile, saveTranslationProfile } from './profile-preferences';
export async function mountProfileSettings(container:HTMLElement,report:(message:unknown)=>void){
  container.innerHTML=`<details class="overlay-settings"><summary>作品背景与专有名词</summary>
    <label>作品背景（最多 500 字）<textarea id="translation-context" rows="3" maxlength="500" placeholder="作品名称、语言、角色关系，或说明哪些词是人名、技能、职业"></textarea></label>
    <label>术语表（每行：原词 = 译名）<textarea id="translation-glossary" rows="6" maxlength="3000" placeholder="原名 = 指定译名&#10;别名 = 同一个译名&#10;技能原文 = 技能译名"></textarea></label>
    <p>最多 100 条 / 3000 字符。别名请另写一行；译名请使用当前目标语言。用于网页、整图和框选；换作品时请切换或清空。术语会随内容发送给所选模型。</p>
    <button id="save-profile" type="button">保存术语与背景</button>
    <p>保存后清除当前页面旧译文，需重新开启翻译或点击图片翻译；不会自动追加请求。模型仍可能不遵守术语，识别错误需重新框选。</p>
    </details>`;
  const context=container.querySelector<HTMLTextAreaElement>('#translation-context')!,glossary=container.querySelector<HTMLTextAreaElement>('#translation-glossary')!,save=container.querySelector<HTMLButtonElement>('#save-profile')!;
  context.disabled=glossary.disabled=save.disabled=true;
  try{const profile=await getTranslationProfile();context.value=profile.context;glossary.value=profile.glossary;}catch(e){report(e);}finally{context.disabled=glossary.disabled=save.disabled=false;}
  save.addEventListener('click',async()=>{save.disabled=true;try{await saveTranslationProfile({context:context.value,glossary:glossary.value});report('术语与背景已保存。请重新翻译以应用新译名。');}catch(e){report(e);}finally{save.disabled=false;}});
}
