export interface ImageLayout { width:number; height:number; fit:string; position:string }
export function fittedRect(nw:number,nh:number,w:number,h:number,fit:string,position:string) {
  let width=w,height=h;
  if(fit!=='fill') {
    let scale=fit==='cover'?Math.max(w/nw,h/nh):Math.min(w/nw,h/nh);
    if(fit==='none') scale=1; if(fit==='scale-down') scale=Math.min(1,scale);
    width=nw*scale;height=nh*scale;
  }
  const tokens=position.split(/\s+/);const pos=(token:string|undefined,free:number)=>{
    if(!token || token==='center') return free/2;
    if(token==='left'||token==='top') return 0;if(token==='right'||token==='bottom')return free;
    if(token.endsWith('%'))return free*parseFloat(token)/100;
    if(token.endsWith('px'))return parseFloat(token);return free/2;
  };
  return {x:pos(tokens[0],w-width),y:pos(tokens[1],h-height),width,height};
}
