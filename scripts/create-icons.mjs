// SPDX-License-Identifier: GPL-3.0-only
// Optional asset maintenance; checked-in PNGs mean release builds need no browser.
import { chromium } from '@playwright/test';
import { readFile, mkdir } from 'node:fs/promises';
const browser=await chromium.launch({channel:'chromium',...(process.env.TEST_BROWSER_PATH?{executablePath:process.env.TEST_BROWSER_PATH}:{}),headless:true});
try {
  await mkdir('public/icons',{recursive:true});
  const svg=await readFile('assets/icon.svg','utf8');
  for(const size of [16,32,48,96,128,256,512]) {
    const page=await browser.newPage({viewport:{width:size,height:size},deviceScaleFactor:1});
    await page.setContent(`<style>body{margin:0}svg{display:block;width:100vw;height:100vh}</style>${svg}`);
    await page.screenshot({path:size>=256?`assets/icon-${size}.png`:`public/icons/${size}.png`,omitBackground:true});await page.close();
  }
}finally{await browser.close();}
