// SPDX-License-Identifier: GPL-3.0-only
// Inspect native action popup targets through the Chrome DevTools Protocol.
import assert from 'node:assert/strict';
export async function checkNativePopup(context,worker){
  const cdp=await context.browser().newBrowserCDPSession();let sequence=0;
  const evaluate=(sessionId,expression)=>new Promise((resolve,reject)=>{
    const id=++sequence,timer=setTimeout(()=>{cdp.off('Target.receivedMessageFromTarget',listener);reject(new Error('Popup evaluation timeout'));},5000);
    const listener=event=>{if(event.sessionId!==sessionId)return;const reply=JSON.parse(event.message);if(reply.id!==id)return;clearTimeout(timer);cdp.off('Target.receivedMessageFromTarget',listener);if(reply.error||reply.result?.exceptionDetails)reject(new Error(JSON.stringify(reply)));else resolve(reply.result.result.value);};
    cdp.on('Target.receivedMessageFromTarget',listener);
    cdp.send('Target.sendMessageToTarget',{sessionId,message:JSON.stringify({id,method:'Runtime.evaluate',params:{expression,returnByValue:true}})}).catch(error=>{clearTimeout(timer);cdp.off('Target.receivedMessageFromTarget',listener);reject(error);});
  });
  try{
    for(let i=0;i<10;i++){
      await worker.evaluate(()=>chrome.action.openPopup());let target;
      for(let tries=0;tries<50&&!target;tries++){target=(await cdp.send('Target.getTargets')).targetInfos.find(t=>t.url.endsWith('/popup.html'));if(!target)await new Promise(r=>setTimeout(r,100));}
      assert.ok(target,'Native popup target exists');
      const {sessionId}=await cdp.send('Target.attachToTarget',{targetId:target.targetId,flatten:false});let state;
      for(let tries=0;tries<50;tries++){
        state=await evaluate(sessionId,"({width:document.body?.getBoundingClientRect().width,overflow:document.body?.scrollWidth,heading:document.querySelector('h1')?.textContent,scroll:scrollY,ready:!!document.querySelector('[name=textModel]')?.value})");
        if(state.ready)break;await new Promise(r=>setTimeout(r,100));
      }
      assert.equal(state.ready,true);assert.equal(state.width,390);assert.ok(state.overflow<=390);assert.equal(state.heading,'双语轻译');assert.equal(state.scroll,0);
      await evaluate(sessionId,'scrollTo(0,1000)');await cdp.send('Target.closeTarget',{targetId:target.targetId});
    }
    console.log('PASS Chromium native action popup: 10 opens, visible heading/form, 390px body, no horizontal overflow, reopening resets scroll.');
  }finally{await cdp.detach();}
}
