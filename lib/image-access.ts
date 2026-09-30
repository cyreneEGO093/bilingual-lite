// SPDX-License-Identifier: GPL-3.0-only
import { browser } from 'wxt/browser';

const PIXIV_RULE_ID = 1001;
let ready: Promise<void> | undefined;

// Fetch cannot set the forbidden Referer header. A session rule supplies the
// CDN's required origin only for this extension's HTTPS GET requests to pximg.
// Session rules survive service-worker suspension; reinstallation is atomic.
export async function ensureImageAccess(url: unknown): Promise<void> {
  if (typeof url !== 'string') return;
  let parsed: URL;
  try { parsed = new URL(url); } catch { return; }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password ||
      !(parsed.hostname === 'pximg.net' || parsed.hostname.endsWith('.pximg.net'))) return;
  ready ??= browser.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [PIXIV_RULE_ID],
    addRules: [{
      id: PIXIV_RULE_ID,
      priority: 1,
      action: {
        type: 'modifyHeaders',
        requestHeaders: [{ header: 'Referer', operation: 'set', value: 'https://www.pixiv.net/' }]
      },
      condition: {
        initiatorDomains: [new URL(browser.runtime.getURL('/')).hostname],
        requestDomains: ['pximg.net'],
        urlFilter: '|https://',
        requestMethods: ['get'],
        resourceTypes: ['xmlhttprequest']
      }
    }]
  }).catch(() => {
    ready = undefined;
    throw new Error('无法启用 Pixiv 图片访问，请重新加载扩展并刷新页面。');
  });
  await ready;
}
