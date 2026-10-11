// SPDX-License-Identifier: GPL-3.0-only
import { mountSettings } from '../../lib/settings-ui';
void mountSettings(true).catch(() => {
  const app=document.querySelector('#app');
  if(app){app.replaceChildren();const message=document.createElement('p');message.textContent='设置初始化失败，请打开完整设置页重试。';const link=document.createElement('a');link.href='options.html';link.target='_blank';link.rel='noopener';link.textContent='打开完整设置页';app.append(message,link);}
});
