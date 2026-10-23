// SPDX-License-Identifier: GPL-3.0-only
export const DEFAULT_OUTPUT_TOKENS = 1500;
export const MIN_OUTPUT_TOKENS = 128;
export const MAX_OUTPUT_TOKENS = 65536;
export function outputTokenLimit(value: unknown): number {
  if (value === undefined) return DEFAULT_OUTPUT_TOKENS;
  const number = typeof value === 'string' && /^\d+$/.test(value.trim()) ? Number(value.trim()) : value;
  if (typeof number !== 'number' || !Number.isSafeInteger(number) || number < MIN_OUTPUT_TOKENS || number > MAX_OUTPUT_TOKENS)
    throw new Error(`输出 Token 上限须为 ${MIN_OUTPUT_TOKENS}–${MAX_OUTPUT_TOKENS} 的整数。`);
  return number;
}
