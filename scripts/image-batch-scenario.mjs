// SPDX-License-Identifier: GPL-3.0-only
import assert from 'node:assert/strict';
export function serveBatchFixture(req,res){
  if(req.url.startsWith('/batch.svg')){res.setHeader('Content-Type','image/svg+xml');res.end(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400"><rect width="800" height="400" fill="${req.url.endsWith('2')?'#c4deef':'#d6ead3'}"/><text x="60" y="140" font-size="40">LOCAL IMAGE TEST</text></svg>`);return true;}
  if(req.url==='/batch'){
    res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><meta charset="utf-8"><title>Page images regression</title><style>body{margin:20px}img{display:block;width:400px;height:200px;margin-bottom:700px}#small{width:32px;height:32px}#hidden{display:none}</style><img id="one" src="/batch.svg?1"><img id="two" src="/batch.svg?2"><img id="duplicate" src="/batch.svg?1"><img id="hidden" src="/batch.svg?3"><img id="small" src="/batch.svg?4">');return true;
  }
  return false;
}
export async function checkBatch({run,wait,press,calls}){
  await wait("return [...document.images].every(i=>i.complete)&&!!document.querySelector('[data-bl-owned=controls]')");
  const before=calls(),button="document.querySelector('[data-bl-owned=controls]').shadowRoot.querySelector('#images-page')";
  await press(button);
  await wait(`return ${button}.textContent==='翻译整页图片'&&document.querySelectorAll('[data-bl-owned=image-overlay]').length===3`);
  assert.ok(calls()-before<=2,'duplicate source is cached across image elements');assert.equal(await run('return scrollY'),0,'no automatic scrolling to load more images');
  const count=calls();await press(button);
  await wait(`return ${button}.textContent==='翻译整页图片'`);assert.equal(calls(),count,'completed full-image translations are reused');
  assert.ok(await run("return !document.querySelector('#hidden').parentElement.querySelector('#hidden + [data-bl-owned]')"));
  console.log('PASS page images: loaded offscreen images, duplicate cache, skip hidden/small, repeat without new inference, no auto scroll.');
}
