// SPDX-License-Identifier: GPL-3.0-only
import { expect,it,vi } from 'vitest';
import { ImageBatch } from '../lib/image-batch';
const gate=()=>{let release!:()=>void;const promise=new Promise<void>(r=>release=r);return {promise,release};};
it('runs one image at a time and continues after an isolated failure',async()=>{
  let active=0,max=0;const queue=new ImageBatch<number>(async i=>{active++;max=Math.max(max,active);await Promise.resolve();active--;if(i===2)throw new Error('bad image');return i===3?'skipped':'done';},()=>{});
  await queue.start([1,2,3,4]);expect(max).toBe(1);expect(queue.state).toMatchObject({running:false,done:2,failed:1,skipped:1});
});
it('stopping retains the in-flight result but does not start the next image',async()=>{
  const g=gate(),work=vi.fn(async()=>{await g.promise;return 'done' as const;}),queue=new ImageBatch(work,()=>{});
  const task=queue.start([1,2,3]);queue.stop();g.release();await task;expect(work).toHaveBeenCalledTimes(1);expect(queue.state).toMatchObject({running:false,stopping:true,done:1});
});
it('stops early for billing/auth/rate errors',async()=>{
  for(const status of [401,402,403,404,429,503]){const work=vi.fn(async()=>{throw Object.assign(new Error('service'),{status});}),queue=new ImageBatch(work,()=>{});await queue.start([1,2]);expect(work).toHaveBeenCalledTimes(1);expect(queue.state.stopping).toBe(true);}
});
it('stops after three consecutive failures and ignores duplicate start',async()=>{
  const g=gate(),work=vi.fn(async()=>{await g.promise;throw new Error('network');}),queue=new ImageBatch(work,()=>{});
  const task=queue.start([1,2,3,4]);await queue.start([5]);g.release();await task;expect(work).toHaveBeenCalledTimes(3);expect(queue.state.failed).toBe(3);
});
it('reset invalidates a pending run without corrupting the next run',async()=>{
  const g=gate(),queue=new ImageBatch<number>(async i=>{if(i===1)await g.promise;return 'done';},()=>{});
  const old=queue.start([1,2]);queue.reset();await queue.start([3]);g.release();await old;expect(queue.state).toMatchObject({total:1,done:1,running:false});
});
