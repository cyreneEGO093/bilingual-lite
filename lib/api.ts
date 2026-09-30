// SPDX-License-Identifier: GPL-3.0-only
import type { Settings } from './settings';
import { OutputFormatError } from './translation-error';

export const MAX_OUTPUT_TOKENS = 1500;
export const TEMPERATURE = 0.1;
export interface TextPart { type: 'text'; text: string }
export interface ImagePart { type: 'image_url'; image_url: { url: string } }
export interface ChatMessage { role: 'system' | 'user'; content: string | (TextPart | ImagePart)[] }
export interface ModelInfo {
  id: string; vision: boolean; context?: number;
  pricing?: { prompt?: string; completion?: string };
  mandatoryReasoning: boolean;
}
interface CompletionResponse {
  choices?: { finish_reason?: string; message?: { content?: unknown; refusal?: unknown } }[];
  usage?: { completion_tokens?: number; completion_tokens_details?: { reasoning_tokens?: number } };
}
export class ApiError extends Error {
  constructor(public status: number) {
    super(({401:'API Key 无效，请在设置中检查。',402:'账户余额不足，请充值或更换 Key。',403:'模型访问被拒绝，请检查地区、权限或服务政策。',404:'模型不存在或没有满足账户条件的路由，请查询模型列表。',429:'请求过于频繁，请稍后重试。',503:'模型服务暂不可用，请稍后重试。'} as Record<number,string>)[status] ?? `服务请求失败（HTTP ${status}）。`);
  }
}
export class Queue {
  private active = 0;
  private waiting: (() => void)[] = [];
  constructor(private limit = 3) {}
  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.limit) {
      if (this.waiting.length >= 30) throw new Error('请求队列已满，请稍后重试。');
      await new Promise<void>(resolve => this.waiting.push(resolve));
    } else this.active++;
    try { return await fn(); } finally {
      const next = this.waiting.shift();
      if (next) next(); else this.active--;
    }
  }
}
export const queue = new Queue(3);
function retryDelay(header: string | null): number {
  if (!header) return 500;
  const seconds = Number(header);
  return Number.isFinite(seconds) ? Math.max(0,seconds*1000) : Math.max(0,Date.parse(header)-Date.now());
}
export async function request(s: Settings, path: string, body?: unknown): Promise<unknown> {
  return queue.run(async () => {
    const local = ['localhost','127.0.0.1','[::1]'].includes(new URL(s.baseUrl).hostname);
    if (body && !s.apiKey && !local) throw new Error('请先打开设置，保存 API Key。');
    for (let attempt=0;attempt<2;attempt++) {
      let response: Response;
      try {
        response = await fetch(`${s.baseUrl}${path}`, {
          method: body ? 'POST' : 'GET', credentials:'omit', redirect:'error',
          headers:{'Content-Type':'application/json',...(s.apiKey?{Authorization:`Bearer ${s.apiKey}`}:{})},
          ...(body?{body:JSON.stringify(body)}:{}), signal:AbortSignal.timeout(60000)
        });
      } catch { throw new Error('连接失败或超时，请检查地址和网络。本次不自动重发，以免重复计费。'); }
      if (!response.ok) {
        const delay=retryDelay(response.headers?.get('Retry-After')??null);
        if(attempt===0 && [429,503].includes(response.status) && Number.isFinite(delay) && delay<=5000){
          await response.body?.cancel().catch(()=>{});
          await new Promise(resolve=>setTimeout(resolve,delay)); continue;
        }
        throw new ApiError(response.status);
      }
      const data: unknown=await response.json();
      if (!data || typeof data!=='object' || 'error' in data) throw new Error('模型服务返回错误，请检查模型和请求格式。');
      return data;
    }
    throw new Error('服务重试失败。');
  });
}
export async function listModels(s: Settings): Promise<ModelInfo[]> {
  const data=await request(s,'/models') as {data?: unknown};
  if(!Array.isArray(data.data))throw new Error('模型列表格式无效。');
  return data.data.filter((m: {id?:unknown})=>typeof m?.id==='string').map(m=>({
    id:m.id, vision:m.architecture?.input_modalities?.includes('image')===true,
    context:m.context_length, pricing:m.pricing, mandatoryReasoning:m.reasoning?.mandatory===true
  }));
}
export function parseJson(content: unknown): unknown {
  if(typeof content!=='string')throw new OutputFormatError('模型未返回文本。');
  try{return JSON.parse(content.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,''));}
  catch{throw new OutputFormatError('模型未返回有效 JSON，请减少输入或更换模型。');}
}
export interface OutputSchema { name:string; schema:Record<string,unknown> }
export async function complete(s: Settings, model: string, messages: ChatMessage[], shape?:OutputSchema): Promise<unknown> {
  // These two catalog entries were verified to expose structured_outputs.
  // Custom models retain prompt + runtime validation rather than guessed capabilities.
  const structured=shape&&['deepseek/deepseek-v4.1-flash','inclusionai/ling-3.0-flash-vl'].includes(model)
    ? {response_format:{type:'json_schema',json_schema:{...shape,strict:true}},provider:{require_parameters:true}} : {};
  // OpenRouter's documented normalized switch. This is a raw HTTP body, not SDK extra_body.
  const data=await request(s,'/chat/completions',{
    model,messages,temperature:TEMPERATURE,max_tokens:MAX_OUTPUT_TOKENS,stream:false,
    reasoning:{enabled:false},...structured
  }) as CompletionResponse;
  const choice=data.choices?.[0];
  if(choice?.finish_reason==='content_filter'||choice?.message?.refusal)throw new Error('模型服务拒绝处理此内容。本次不会自动重试。');
  if((data.usage?.completion_tokens_details?.reasoning_tokens??0)>0)throw new Error('服务仍消耗了思考 Token，未遵守关闭思考的请求。请更换可禁用思考的模型。');
  if((data.usage?.completion_tokens??0)>MAX_OUTPUT_TOKENS)throw new Error('服务返回的 Token 用量超过上限，请更换遵守输出限制的模型。');
  if(choice?.finish_reason==='length')throw new Error('译文达到 1500 Token 上限。请减少文本或使用手动框选；不会自动增加预算。');
  return parseJson(choice?.message?.content);
}
