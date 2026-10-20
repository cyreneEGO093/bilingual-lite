// SPDX-License-Identifier: GPL-3.0-only
import assert from 'node:assert/strict';
export async function checkImageClear({run,wait,move,drag,calls}){
  await wait("return document.querySelector('img')?.complete&&!!document.querySelector('[data-bl-owned=image-button]')");
  const r=await run("const r=document.querySelector('img').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}");
  await move(r.x+20,r.y+20);
  const root="document.querySelector('[data-bl-owned=image-button]').shadowRoot";
  await wait("return document.querySelector('[data-bl-owned=image-button]').style.display==='block'");
  await run(`${root}.querySelector('#full').click()`);
  await wait("return !!document.querySelector('[data-bl-owned=image-overlay]')");
  await run(`${root}.querySelector('#snip').click()`);
  await drag(r.x+r.width*.55,r.y+r.height*.55,r.width*.35,r.height*.3);
  await wait("return [...document.querySelector('[data-bl-owned=image-overlay]').shadowRoot.querySelectorAll('.words')].some(n=>n.textContent.includes('局部'))");
  const before=calls();
  await move(r.x+20,r.y+20);await run(`${root}.querySelector('#discard').click()`);
  await wait("return !document.querySelector('[data-bl-owned=image-overlay]')");
  assert.equal(calls(),before,'clearing does not request inference');
  assert.ok(await run(`return ${root}.querySelector('#clear').disabled&&${root}.querySelector('#adjust').hidden&&${root}.querySelector('#discard').disabled`));
  await run(`${root}.querySelector('#full').click()`);await wait("return !!document.querySelector('[data-bl-owned=image-overlay]')");
  assert.equal(calls(),before+1,'clearing invalidates full-image reuse and cache');
  assert.ok(await run("return [...document.querySelector('[data-bl-owned=image-overlay]').shadowRoot.querySelectorAll('.words')].every(n=>!n.textContent.includes('局部'))"));
  console.log('PASS image clear: full/crop overlays removed, controls reset, no request on deletion, new full translation calls API.');
}
