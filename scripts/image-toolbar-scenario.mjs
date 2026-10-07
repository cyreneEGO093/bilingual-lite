// SPDX-License-Identifier: GPL-3.0-only
import assert from 'node:assert/strict';

export const toolbarBubbles=[{original:'Top edge',translated:'顶部对白：拖动手柄调整位置。',bbox:[0,600,110,960]},{original:'After scrolling',translated:'滚动后也能调整位置。',bbox:[370,100,480,420]}];
export function serveToolbarFixture(req,res){
  if(req.url==='/toolbar'){
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.end('<!doctype html><meta charset="utf-8"><title>Toolbar regression</title><style>body{margin:12px}img{display:block;width:800px;max-width:100%;height:auto}</style><div id="frame"><img src="/toolbar.svg" alt="Synthetic long comic"></div>');return true;
  }
  if(req.url==='/toolbar.svg'){
    res.setHeader('Content-Type','image/svg+xml');
    res.end('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1800"><rect width="800" height="1800" fill="#edf3ec"/><path d="M0 600H800M0 1200H800" stroke="#245d48" stroke-width="8"/><g font-family="sans-serif" font-size="24" fill="#245d48"><text x="24" y="300">SYNTHETIC COMIC / TOP EDGE</text><text x="24" y="950">SCROLL / RESIZE / DRAG</text><text x="24" y="1550">LOCAL MOCK ONLY</text></g></svg>');return true;
  }
  return false;
}

// Run identical real-pointer assertions in Chromium and Firefox.
export async function checkImageToolbar({run,wait,move,click,drag,escape,resize,calls}){
  const host="document.querySelector('[data-bl-owned=image-button]')";
  const overlay="document.querySelector('[data-bl-owned=image-overlay]')";
  await wait(`return document.querySelector('img')?.naturalWidth>0&&!!${host}`);
  await move(24,260);
  const control=async id=>run(`const h=${host},r=h.shadowRoot.querySelector(arguments[0]).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,width:r.width,height:r.height,visible:getComputedStyle(h).display!=='none'&&getComputedStyle(h).visibility!=='hidden'}`,[id]);
  const press=async id=>{const p=await control(id);assert.ok(p.visible&&p.width>0&&p.height>0,`${id} must be reachable`);await click(p.x,p.y);};
  await press('#full');await wait(`return ${overlay}?.shadowRoot.querySelectorAll('.bubble').length===2`);
  const count=calls();
  const clear=async()=>{
    await wait(`const r=${host}.getBoundingClientRect();return r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight`);
  };
  // Move the toolbar manually away from top-edge text; it must not auto-avoid.
  const grip=await control('#move-toolbar');await drag(grip.x,grip.y,-200,240);
  const fixed=await run(`const r=${host}.getBoundingClientRect();return {x:r.x,y:r.y}`);
  await run(`const b=${overlay}.shadowRoot.querySelector('.bubble');b.style.left='0%';b.style.width='100%';b.style.height='25%';`);
  await new Promise(r=>setTimeout(r,150));
  assert.deepEqual(await run(`const r=${host}.getBoundingClientRect();return {x:r.x,y:r.y}`),fixed,'image toolbar does not avoid a changed bubble');
  await press('#reset-layout');
  const box=async index=>run(`const r=${overlay}.shadowRoot.querySelectorAll('.bubble')[arguments[0]].getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}`,[index]);
  const adjust=async(index,kind,dx,dy)=>{
    const before=await box(index);
    const p=await run(`const handle=${overlay}.shadowRoot.querySelectorAll('.bubble')[arguments[0]].querySelector(arguments[1]),r=handle.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;let hit=document.elementFromPoint(x,y);while(hit?.shadowRoot){const next=hit.shadowRoot.elementFromPoint(x,y);if(!next||next===hit)break;hit=next;}return {x,y,reachable:hit===handle,hit:hit?.tagName+' '+hit?.className,scrollY,overlayHidden:${overlay}.hidden,image:document.querySelector('img').getBoundingClientRect().toJSON()}`,[index,`.${kind}-handle`]);
    assert.equal(p.reachable,true,`${kind} handle must receive pointer events: ${JSON.stringify(p)}`);
    await drag(p.x,p.y,dx,dy);
    const after=await box(index);
    assert.ok(Math.abs(after[kind==='move'?'x':'width']-before[kind==='move'?'x':'width']-dx)<2);
    assert.ok(Math.abs(after[kind==='move'?'y':'height']-before[kind==='move'?'y':'height']-dy)<2);
    await clear();
  };
  await clear();await adjust(0,'move',-40,25);await adjust(0,'resize',20,20);
  await press('#collapse');assert.ok((await control('#expand')).width>0);await clear();
  await press('#expand');await clear();
  await escape();assert.ok((await control('#expand')).width>0);await press('#expand');
  await press('#snip');await wait("return !!document.querySelector('[data-bl-owned=snip]')");
  await escape();assert.equal(await run("return !!document.querySelector('[data-bl-owned=snip]')"),false);
  assert.ok((await control('#snip')).width>0,'Escape cancels selection without also collapsing the toolbar');
  await press('#snip');await wait("return !!document.querySelector('[data-bl-owned=snip]')");
  const cancel=await run("const r=document.querySelector('[data-bl-owned=snip]').shadowRoot.querySelector('button').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}");
  await click(cancel.x,cancel.y);await wait("return !document.querySelector('[data-bl-owned=snip]')");
  await run('window.scrollTo(0,650)');await wait('return scrollY===650');await clear();await adjust(1,'move',30,20);
  await run('window.scrollTo(0,0)');await resize(420,800);
  await wait(`const r=${host}.getBoundingClientRect();return r.right<=innerWidth&&r.bottom<=innerHeight`);
  await clear();await adjust(0,'move',-15,15);
  await resize(1100,900);await run("document.querySelector('#frame').style.paddingTop='80px'");
  await clear();
  // Cross the gap from the image to the toolbar using real pointer movement.
  await move(24,300);await press('#collapse');await press('#expand');await clear();
  assert.equal(calls(),count,'layout, dragging, collapsing and cancellation must not call the model');
  console.log('PASS image toolbar: manual toolbar drag without auto avoidance, bubble move/resize, scroll, narrow viewport, collapse/expand, Escape and selection cancellation; real pointer hit testing in both browsers.');
}
