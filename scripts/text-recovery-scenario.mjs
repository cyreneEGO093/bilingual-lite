import assert from 'node:assert/strict';

export const recoveryPage='<!doctype html><meta charset="utf-8"><title>Novel recovery test</title><style>body{margin:40px}p{min-height:200px}</style>'+Array.from({length:19},(_,i)=>`<p>Recovery novel paragraph ${i}.</p>`).join('');
export function recoveryMock(){
  const calls=[];
  return {calls,reply(body){
    if(typeof body.messages?.[1]?.content!=='string')return null;
    const items=JSON.parse(body.messages[1].content);
    if(!items.some(i=>i.text.startsWith('Recovery novel')))return null;
    calls.push(items);
    assert.equal(body.model,'deepseek/deepseek-v4.1-flash');
    assert.equal(body.response_format?.json_schema?.strict,true);
    assert.deepEqual(body.provider,{require_parameters:true});
    assert.equal(body.max_tokens,1500);assert.deepEqual(body.reasoning,{enabled:false});
    const rows=items.map(i=>({id:calls.length===3?Number(i.id):i.id,translated:'测试译文：'+i.text}));
    if(calls.length===2)rows[0].id='invalid-id';
    return JSON.stringify({choices:[{message:{content:JSON.stringify({translations:rows})}}]});
  }};
}

// Shared assertions run through the actual extension in Chrome and Firefox.
export async function checkTextRecovery(run,wait,calls){
  const root="document.querySelector('[data-bl-owned=controls]').shadowRoot";
  await wait(`return ${root}.querySelector('#text-scope')?.disabled===false`);
  await run(`const root=${root},s=root.querySelector('#text-scope');s.value='page';s.dispatchEvent(new Event('change'));`);
  await wait(`return ${root}.querySelector('#text-scope').value==='page'`);
  await run(`const root=${root};root.querySelector('button').click();`);
  await wait(`return !${root}.querySelector('#text-mode').hidden`);
  await run(`const root=${root};root.querySelector('#text-mode').click();window.scrollTo(0,document.body.scrollHeight);`);
  await wait("return document.querySelectorAll('.bl-translation').length===13");
  assert.equal(calls.length,4);
  assert.ok(await run(`return ${root}.querySelector('button').textContent==='译 · 关闭翻译' && ${root}.querySelector('#text-mode').textContent==='显示双语' && !${root}.querySelector('#text-retry').hidden`));
  assert.ok(await run("const p=document.querySelectorAll('body > p');window.__firstTranslation=document.querySelector('.bl-translation');return getComputedStyle(p[0]).display==='none'&&getComputedStyle(p[6]).display!=='none'"));
  await run("const p=document.createElement('p');p.textContent='Recovery novel lazy paragraph.';document.body.append(p);window.scrollTo(0,document.body.scrollHeight)");
  await wait("return document.querySelectorAll('.bl-translation').length===14");assert.equal(calls.length,5);
  await run(`const root=${root};root.querySelector('#text-retry').click()`);
  await wait("return document.querySelectorAll('.bl-translation').length===20");
  assert.equal(calls.length,6);assert.deepEqual(calls[5].map(i=>i.text),calls[1].map(i=>i.text));
  assert.ok(await run(`return window.__firstTranslation.isConnected && ${root}.querySelector('#text-retry').hidden && ${root}.querySelector('#text-mode').textContent==='显示双语'`));
  await run(`const root=${root};root.querySelector('#text-mode').click()`);
  assert.ok(await run("return [...document.querySelectorAll('body > p')].every(p=>getComputedStyle(p).display!=='none')"));
  await run(`const root=${root};root.querySelector('button').click()`);
  assert.equal(await run("return document.querySelectorAll('.bl-translation').length"),0);
  console.log('PASS text recovery: whole page + translated-only + scrolling, invalid batch skipped, numeric IDs accepted, lazy content continues, manual retry sends only failed text, no lost/duplicate translations; 6 local calls.');
}
