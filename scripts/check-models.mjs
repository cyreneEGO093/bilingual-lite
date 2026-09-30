// SPDX-License-Identifier: GPL-3.0-only
// Public, unbilled catalog check. Deliberately no API key input.
const response = await fetch('https://openrouter.ai/api/v1/models', { signal: AbortSignal.timeout(30000) });
if (!response.ok) throw new Error(`Models HTTP ${response.status}`);
const { data } = await response.json();
const model = data.find(m => m.id === 'inclusionai/ling-3.0-flash-vl');
if (!model?.architecture?.input_modalities?.includes('image')) throw new Error('Default model unavailable or lacks image input');
console.log(JSON.stringify({ checkedAt:new Date().toISOString(), status:response.status, totalModels:data.length, model:model.id, context:model.context_length, pricing:model.pricing, inferenceRequests:0, inferenceCostUSD:0 },null,2));
