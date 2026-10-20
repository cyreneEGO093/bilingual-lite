// SPDX-License-Identifier: GPL-3.0-only
/** Conservative copy-through check, not a general language detector. Only flag
 * unchanged Japanese/Korean prose for a Chinese target; names and already-Chinese
 * passages can legitimately be identical. Never retry or incur costs here. */
export function copiedForeignProse(source:string,translated:string,target:string):boolean{
  if(!/^(?:简体中文|繁體中文|繁体中文|中文|Chinese(?:\s*\([^)]*\))?|zh(?:[-_](?:CN|TW|HK|Hans|Hant))?)$/i.test(target.trim()))return false;
  const normalize=(value:string)=>value.normalize('NFKC').replace(/\s+/g,'').trim();
  if(normalize(source)!==normalize(translated))return false;
  // Handles, links and hashtags can contain untranslated names.
  const prose=source.replace(/https?:\/\/\S+|[@#][\p{L}\p{N}_]+/gu,'');
  const kana=prose.match(/[\p{Script=Hiragana}\p{Script=Katakana}]/gu)?.length??0;
  const hangul=prose.match(/\p{Script=Hangul}/gu)?.length??0;
  return (kana>=6||hangul>=8)&&(/[。！？.!?]/.test(prose)||(prose.match(/\s+/g)?.length??0)>=3);
}
