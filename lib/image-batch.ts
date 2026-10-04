// SPDX-License-Identifier: GPL-3.0-only
export interface ImageBatchState {running:boolean;stopping:boolean;total:number;done:number;failed:number;skipped:number;error:string}
export class ImageBatch<T> {
  state:ImageBatchState={running:false,stopping:false,total:0,done:0,failed:0,skipped:0,error:''};
  private generation=0;
  constructor(private process:(item:T,active:()=>boolean)=>Promise<'done'|'skipped'>,private changed:(state:ImageBatchState)=>void){}
  stop(){if(this.state.running){this.state.stopping=true;this.emit();}}
  reset(){this.generation++;this.state={running:false,stopping:false,total:0,done:0,failed:0,skipped:0,error:''};this.emit();}
  private emit(){this.changed({...this.state});}
  async start(items:T[]){
    if(this.state.running)return;
    const generation=++this.generation;let failures=0;
    this.state={running:true,stopping:false,total:items.length,done:0,failed:0,skipped:0,error:''};this.emit();
    const active=()=>generation===this.generation&&!this.state.stopping;
    for(const item of items){
      if(!active())break;
      try{const result=await this.process(item,active);if(generation!==this.generation)return;this.state[result]++;failures=0;}
      catch(error){
        if(generation!==this.generation)return;
        this.state.failed++;failures++;this.state.error=error instanceof Error?error.message:'图片翻译失败。';
        const status=(error as {status?:number}|null)?.status;
        if(failures>=3||(status!==undefined&&[401,402,403,404,429,503].includes(status)))this.state.stopping=true;
      }
      this.emit();
    }
    if(generation!==this.generation)return;
    this.state.running=false;this.emit();
  }
}
