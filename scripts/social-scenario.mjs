// SPDX-License-Identifier: GPL-3.0-only
import assert from 'node:assert/strict';
export const socialTranslations={
  '오늘은 작은 정원에서 새로운 꽃을 보았습니다.':'今天在小花园里看到了新花。',
  '今日は小さな庭で新しい花を見つけました。':'今天在小花园里发现了新花。',
  'はい':'是的。',
  '明日は図書館で新しい本を読みます。':'明天去图书馆读新书。',
  '새로운 이야기를 함께 읽어 봅시다.':'一起读新的故事吧。'
};
export function serveSocialFixture(req,res){
  if(req.url!=='/social')return false;
  const card=(id,text,style='')=>`<article data-testid="tweet" style="${style}"><div class="author">Example ${id} @fixture <time>5h</time></div><div data-testid="tweetText" id="${id}"><span>${text}</span></div><button>Like 123</button><span>456 views</span></article>`;
  res.setHeader('Content-Type','text/html; charset=utf-8');
  res.end(`<!doctype html><meta charset="utf-8"><title>Synthetic social feed</title><style>body{font:20px system-ui;margin:32px;max-width:680px}article{padding:24px 0;border-bottom:1px solid #ddd}.author{color:#607080;font-size:16px}.bl-translation{color:#245d48}</style>${card('first',Object.keys(socialTranslations)[0])}${card('second',Object.keys(socialTranslations)[1])}${card('short','はい')}${card('offscreen',Object.keys(socialTranslations)[3],'margin-top:1600px')}`);
  return true;
}
export async function checkSocial({go,run,wait,requests}){
  const controls="document.querySelector('[data-bl-owned=controls]').shadowRoot";
  for(const scope of ['viewport','page']){
    await go();await wait("return !!document.querySelector('[data-bl-owned=controls]')");
    const before=requests().length;
    await run(`const s=${controls}.querySelector('#text-scope');s.value='${scope}';s.dispatchEvent(new Event('change',{bubbles:true}));`);
    await wait(`return ${controls}.querySelector('#text-scope').value==='${scope}'`);
    await run(`${controls}.querySelector('#text-toggle').click()`);
    await wait("return document.querySelector('#short').nextElementSibling?.className==='bl-translation'");
    assert.equal(await run("return document.querySelector('#first').nextElementSibling.textContent"),socialTranslations[Object.keys(socialTranslations)[0]]);
    if(scope==='viewport'){
      assert.equal(await run("return document.querySelector('#offscreen').nextElementSibling.className==='bl-translation'"),false);
      await run("document.querySelector('#offscreen').scrollIntoView()");await wait("return document.querySelector('#offscreen').nextElementSibling.className==='bl-translation'");
    }else{await wait("return document.querySelectorAll('.bl-translation').length===4");assert.equal(await run('return scrollY'),0);}
    await run(`scrollTo(0,0);${controls}.querySelector('#text-mode').click()`);
    await wait("return getComputedStyle(document.querySelector('#first')).display==='none'");
    assert.ok(await run("return [...document.querySelectorAll('article,.author,article button')].every(n=>n.getBoundingClientRect().height>0)"));
    const calls=requests().length;
    await run("document.querySelector('#first').nextElementSibling.remove()");
    await wait("return document.querySelector('#first').nextElementSibling.className==='bl-translation'");
    assert.equal(requests().length,calls,'restore removed translation without inference');
    await run(`document.querySelector('#first').textContent=${JSON.stringify(Object.keys(socialTranslations)[4])}`);
    await wait(`return document.querySelector('#first').nextElementSibling.textContent===${JSON.stringify(Object.values(socialTranslations)[4])}`);
    const sent=requests().slice(before).flatMap(r=>JSON.parse(r.messages[1].content).map(i=>i.text));
    assert.ok(sent.every(text=>Object.hasOwn(socialTranslations,text)),'no authors, dates or counters sent to translation');
    await run(`${controls}.querySelector('#text-toggle').click()`);
    assert.equal(await run("return document.querySelectorAll('.bl-translation').length"),0);
    assert.notEqual(await run("return getComputedStyle(document.querySelector('#first')).display"),'none');
  }
  console.log('PASS synthetic X structure: body-only requests, Korean/Japanese/short replies, scroll/page, recycled body, translated-only metadata, removed translation restored without inference.');
}
