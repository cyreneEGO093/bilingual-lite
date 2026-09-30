import { beforeEach, it, expect, vi } from 'vitest';

const updateSessionRules = vi.hoisted(() => vi.fn());
vi.mock('wxt/browser', () => ({ browser: {
  runtime: { getURL: () => 'chrome-extension://test-extension-id/' },
  declarativeNetRequest: { updateSessionRules }
} }));
beforeEach(() => { vi.resetModules(); updateSessionRules.mockReset().mockResolvedValue(undefined); });

it('leaves other sites, lookalike domains and non-HTTPS requests untouched', async () => {
  const { ensureImageAccess } = await import('../lib/image-access');
  for (const url of ['https://example.com/a.png','https://evilpximg.net/a.png','https://i.pximg.net.evil.com/a.png','http://i.pximg.net/a.png','https://user:pass@i.pximg.net/a.png','invalid',null]) await ensureImageAccess(url);
  expect(updateSessionRules).not.toHaveBeenCalled();
});
it('installs one rule before concurrent Pixiv downloads, scoped to its own GET requests', async () => {
  const { ensureImageAccess } = await import('../lib/image-access');
  await Promise.all([ensureImageAccess('https://i.pximg.net/a.png'),ensureImageAccess('https://s.pximg.net/b.png')]);
  expect(updateSessionRules).toHaveBeenCalledTimes(1);
  expect(updateSessionRules.mock.calls[0]![0]).toEqual({removeRuleIds:[1001],addRules:[{
    id:1001,priority:1,
    action:{type:'modifyHeaders',requestHeaders:[{header:'Referer',operation:'set',value:'https://www.pixiv.net/'}]},
    condition:{initiatorDomains:['test-extension-id'],requestDomains:['pximg.net'],urlFilter:'|https://',requestMethods:['get'],resourceTypes:['xmlhttprequest']}
  }]});
});
it('reports missing rule permission and permits retry after reload or recovery', async () => {
  updateSessionRules.mockRejectedValueOnce(new Error('permission denied'));
  const { ensureImageAccess } = await import('../lib/image-access');
  await expect(ensureImageAccess('https://i.pximg.net/a.png')).rejects.toThrow('重新加载扩展');
  await ensureImageAccess('https://i.pximg.net/a.png');
  expect(updateSessionRules).toHaveBeenCalledTimes(2);
});
