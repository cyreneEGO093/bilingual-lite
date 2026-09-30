// SPDX-License-Identifier: GPL-3.0-only
import { readFile, writeFile, copyFile, mkdir } from 'node:fs/promises';
await mkdir('public/legal',{recursive:true});
await copyFile('LICENSE','public/legal/LICENSE.txt');
await copyFile('THIRD_PARTY_NOTICES.txt','public/legal/THIRD_PARTY_NOTICES.txt');
const escape=text=>text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const paragraphs=(await readFile('PRIVACY.md','utf8')).trim().split(/\r?\n\r?\n/).map(block=>{
  const heading=block.match(/^(#{1,2}) (.+)$/);
  return heading?`<h${heading[1].length}>${escape(heading[2])}</h${heading[1].length}>`:`<p>${escape(block)}</p>`;
}).join('\n');
await writeFile('public/legal/privacy.html',`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>双语轻译 · 隐私说明</title><style>body{max-width:760px;margin:40px auto;padding:0 24px;font:16px/1.8 system-ui;color:#213b34;background:#f4f6f0}h1{font-size:28px}h2{font-size:20px;margin-top:28px}p{overflow-wrap:anywhere}</style><main>${paragraphs}</main></html>\n`);
