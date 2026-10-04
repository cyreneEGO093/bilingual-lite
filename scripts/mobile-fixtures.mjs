// SPDX-License-Identifier: GPL-3.0-only
export const mobileBubbles=[{original:'Top test',translated:'顶部测试译文',bbox:[20,570,180,950]},{original:'Second test',translated:'第二个测试对白',bbox:[480,100,640,460]}];
export function serveMobileFixture(req,res){
  if(req.url==='/mobile'){
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Mobile controls test</title>
      <style>body{margin:12px;padding-bottom:140px;font:16px system-ui;background:#eef3ef}p{min-height:110px}form{position:fixed;box-sizing:border-box;bottom:10px;left:10px;right:10px;display:flex;align-items:center;gap:8px;padding:10px;background:#243d34;border-radius:18px}textarea{box-sizing:border-box;flex:1;min-width:0;height:64px;font:16px system-ui;border-radius:8px}button{min-height:48px;min-width:48px}#sent{margin-bottom:150px}</style>
      <h1>Local mobile test</h1>${Array.from({length:5},(_,i)=>`<p>Mobile translation paragraph ${i}. Read this text and keep the input accessible.</p>`).join('')}
      <output id="sent">0</output><form id="composer"><textarea id="message" aria-label="Test message"></textarea><button id="send">Send</button></form><script>document.querySelector('form').onsubmit=e=>{e.preventDefault();document.querySelector('#sent').textContent=String(Number(document.querySelector('#sent').textContent)+1)};</script>`);return true;
  }
  if(req.url==='/mobile-manga'){
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.end('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Touch image test</title><style>body{margin:10px}img{display:block;width:360px;max-width:100%;height:auto}</style><a href="#image-link"><img src="/toolbar.svg" alt="Synthetic touch comic"></a>');return true;
  }
  return false;
}

export async function checkComposer({run,wait,press,drag,touch=false,onInputFocus=async()=>{}}){
  const host="document.querySelector('[data-bl-owned=controls]')",root=`${host}.shadowRoot`;
  await wait(`return !!${host}&&${root}.querySelector('#text-scope').disabled===false`);
  const clear=`const c=${host}.getBoundingClientRect(),e=document.querySelector('#composer').getBoundingClientRect(),v=visualViewport;return c.left>=v.offsetLeft&&c.top>=v.offsetTop&&c.right<=v.offsetLeft+v.width&&c.bottom<=v.offsetTop+v.height&&(c.right<=e.left||c.left>=e.right||c.bottom<=e.top||c.top>=e.bottom)`;
  await wait(clear);
  if(touch){await wait(`return !${root}.querySelector('#controls-expand').hidden`);await press(`${root}.querySelector('#controls-expand')`);}
  await wait(`return !${root}.querySelector('#controls-panel').hidden`);
  await wait(clear);
  const before=await run(`const r=${host}.getBoundingClientRect();return {x:r.x,y:r.y}`);
  await drag(`${root}.querySelector('#controls-move')`,-70,-65);
  await wait(`const r=${host}.getBoundingClientRect();return Math.abs(r.left-${before.x})>15||Math.abs(r.top-${before.y})>15`);
  await wait(clear);
  await press(`${root}.querySelector('#controls-collapse')`);
  await wait(`return !${root}.querySelector('#controls-expand').hidden`);
  await drag(`${root}.querySelector('#controls-expand')`,-20,-35);
  await wait(`return ${root}.querySelector('#controls-panel').hidden`);
  await press(`${root}.querySelector('#controls-expand')`);
  await press(`${root}.querySelector('#text-toggle')`);
  await wait("return document.querySelectorAll('.bl-translation').length>0");
  await press(`${root}.querySelector('#text-mode')`);
  await wait(`return ${root}.querySelector('#text-mode').textContent==='显示双语'`);
  await press("document.querySelector('#message')");
  await wait(`return ${root}.querySelector('#controls-panel').hidden`);
  await wait(clear);
  await onInputFocus();
  await press("document.querySelector('#send')");
  await wait("return document.querySelector('#sent').textContent==='1'");
  console.log('PASS floating controls: avoid composer/send button, real drag, collapse/expand, drag does not click, text translation and input focus collapse.');
}
