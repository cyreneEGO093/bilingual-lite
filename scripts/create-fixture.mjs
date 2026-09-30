import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const browser=await chromium.launch({channel:'chromium',...(process.env.TEST_BROWSER_PATH?{executablePath:process.env.TEST_BROWSER_PATH}:{})});
try {const page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1});await page.setContent(`<style>body{margin:0}</style>${await readFile('tests/fixtures/manga.svg','utf8')}`);await page.screenshot({path:'tests/fixtures/manga.png'});}finally{await browser.close();}
