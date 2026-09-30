import { defineConfig } from 'wxt';
export default defineConfig({
  manifestVersion: 3,
  outDir: 'dist',
  zip: { zipSources: false },
  manifest: {
    name: '双语轻译 · Bilingual Lite',
    description: '按需翻译可见段落与漫画气泡，自带 API Key。',
    permissions: ['storage', 'activeTab', 'contextMenus'],
    host_permissions: ['http://*/*', 'https://*/*'],
    commands: { 'toggle-translation': { suggested_key: { default: 'Alt+Shift+T' }, description: '切换双语翻译' } },
    browser_specific_settings: { gecko: { id: 'bilingual-lite@example.org', strict_min_version: '140.0', data_collection_permissions: { required: ['websiteContent', 'authenticationInfo'] } } }
  }
});
