// SPDX-License-Identifier: GPL-3.0-only
/** Scale control CSS without transforming pointer coordinates or the fixed-position origin. */
export function scaleControlCss(root:ShadowRoot){
  // Media queries cannot use custom properties. Keep breakpoints unchanged.
  for(const style of root.querySelectorAll('style'))style.textContent=(style.textContent??'').split(/(@media[^{]+\{)/g).map(part=>part.startsWith('@media')?part:part.replace(/(\d+(?:\.\d+)?)px\b/g,'calc($1px * var(--bl-ui-scale, 1))')).join('');
}
export function setControlScale(host:HTMLElement,percent:number){host.style.setProperty('--bl-ui-scale',String(percent/100));}
