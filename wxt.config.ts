// SPDX-License-Identifier: GPL-3.0-only
import { defineConfig } from 'wxt';
import { runtimeAudit } from './build/runtime-audit';
export default defineConfig({
  manifestVersion: 3,
  outDir: 'dist',
  zip: { zipSources: false },
  // Supported browsers have native modulepreload; omit Vite's legacy runtime polyfill.
  vite: ({ browser }) => ({ build:{modulePreload:{polyfill:false}},plugins:[runtimeAudit(browser)] }),
  manifest: {
    name: '双语轻译 · Bilingual Lite',
    description: '用户自备 API Key，按需翻译网页段落和漫画气泡，支持整页、滚动和框选。内容发送至用户配置的 AI 服务。',
    icons: {16:'icons/16.png',32:'icons/32.png',48:'icons/48.png',96:'icons/96.png',128:'icons/128.png'},
    action: {default_icon:{16:'icons/16.png',32:'icons/32.png'}},
    incognito: 'not_allowed',
    permissions: ['storage', 'activeTab', 'contextMenus', 'declarativeNetRequestWithHostAccess'],
    host_permissions: ['http://*/*', 'https://*/*'],
    commands: { 'toggle-translation': { suggested_key: { default: 'Alt+Shift+T' }, description: '切换双语翻译' } },
    browser_specific_settings: { gecko: { id: 'bilingual-lite@example.org', strict_min_version: '140.0', data_collection_permissions: { required: ['websiteContent', 'authenticationInfo'] } }, gecko_android: {strict_min_version:'142.0'} }
  }
});
