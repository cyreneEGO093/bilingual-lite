import type { Settings } from './settings';
export class ApiError extends Error {
  constructor(public status: number) {
    super(({ 401: 'API Key 无效，请在设置中检查。', 402: '账户余额不足，请充值或更换 Key。', 403: '模型访问被拒绝，可能存在地区或权限限制，请更换模型。', 429: '请求过于频繁，请稍后手动重试。' } as Record<number, string>)[status] ?? `服务请求失败（HTTP ${status}），请稍后重试。`);
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
export async function request(s: Settings, path: string, body?: unknown) {
  return queue.run(async () => {
    const local = ['localhost','127.0.0.1','[::1]'].includes(new URL(s.endpoint).hostname);
    if (body && !s.apiKey && !local) throw new Error('请先打开设置，保存 API Key。');
    let response: Response;
    try {
      response = await fetch(`${s.endpoint}${path}`, {
        method: body ? 'POST' : 'GET', credentials: 'omit', redirect: 'error',
        headers: { 'Content-Type': 'application/json', ...(s.apiKey ? { Authorization: `Bearer ${s.apiKey}` } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(60000)
      });
    } catch { throw new Error('连接失败或超时，请检查 API 地址、网络和代理。'); }
    if (!response.ok) throw new ApiError(response.status);
    const data = await response.json();
    if (data.error) throw new Error('模型服务返回错误，请检查模型名称后重试。');
    return data;
  });
}
export async function listModels(s: Settings) {
  const data = await request(s, '/models');
  if (!Array.isArray(data.data)) throw new Error('模型列表格式无效。');
  return data.data.filter((m: any) => typeof m.id === 'string').map((m: any) => ({ id: m.id, vision: m.architecture?.input_modalities?.includes('image') === true, context: m.context_length, pricing: m.pricing }));
}
export function parseJson(content: unknown): unknown {
  if (typeof content !== 'string') throw new Error('模型未返回文本。');
  try { return JSON.parse(content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')); }
  catch { throw new Error('模型返回了无效 JSON，请手动重试或更换模型。'); }
}
export async function complete(s: Settings, model: string, messages: unknown[], maxTokens: number) {
  // This OpenRouter model otherwise spends the entire short translation budget on reasoning.
  const extra = model === 'deepseek/deepseek-v4.1-flash' ? { reasoning: { enabled: false } } : {};
  const data = await request(s, '/chat/completions', { model, messages, temperature: 0, max_tokens: maxTokens, stream: false, ...extra });
  if (data.choices?.[0]?.finish_reason === 'content_filter' || data.choices?.[0]?.message?.refusal) throw new Error('模型服务拒绝处理此内容。请检查服务政策；本次不会自动重试。');
  if (data.choices?.[0]?.finish_reason === 'length') throw new Error('模型输出达到上限，可能被思考 Token 耗尽。请更换非思考模型或缩小文本 / 图片。');
  return parseJson(data.choices?.[0]?.message?.content);
}
