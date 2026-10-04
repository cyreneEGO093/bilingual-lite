// SPDX-License-Identifier: GPL-3.0-only
// Optional AMO functional-review fixture. No cloud, key, or user content needed.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { serveMobileFixture } from './mobile-fixtures.mjs';
import { serveToolbarFixture } from './image-toolbar-scenario.mjs';
import { serveBatchFixture } from './image-batch-scenario.mjs';
const server=createServer(async(req,res)=>{
  try {
    if(serveMobileFixture(req,res)||serveToolbarFixture(req,res)||serveBatchFixture(req,res))return;
    if(req.url==='/v1/models') {
      res.setHeader('Content-Type','application/json');
      res.end(JSON.stringify({data:[{id:'deepseek/deepseek-v4.1-flash',architecture:{input_modalities:['text','image']},context_length:10000}]}));return;
    }
    if(req.url==='/v1/chat/completions'&&req.method==='POST') {
      const chunks=[];let size=0;
      for await(const chunk of req){size+=chunk.length;if(size>4*1024*1024){res.writeHead(413).end();return;}chunks.push(chunk);}
      const body=JSON.parse(Buffer.concat(chunks).toString()),content=body.messages?.[1]?.content;
      const result=typeof content==='string'?{translations:JSON.parse(content).map(i=>({id:i.id,translated:'本地模拟译文：'+i.text}))}:
        content?.[0]?.text?.includes('框内')?{original:'Test crop',translated:'本地框选译文'}:
        {bubbles:[{original:'HELLO, FRIEND!',translated:'你好，朋友！',bbox:[100,90,320,430]},{original:'A NEW WORLD',translated:'全新的世界',bbox:[560,560,780,920]}]};
      res.setHeader('Content-Type','application/json');res.end(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(result)}}]}));return;
    }
    if(req.url==='/manga.png'){res.setHeader('Content-Type','image/png');res.end(await readFile('tests/fixtures/manga.png'));return;}
    res.setHeader('Content-Type','text/html; charset=utf-8');
    if(req.url==='/manga'){res.end('<!doctype html><meta charset="utf-8"><title>Local manga test</title><body style="margin:40px"><div style="width:800px"><img style="width:100%" src="/manga.png"></div></body>');return;}
    res.end(await readFile('tests/fixtures/text.html'));
  }catch{res.writeHead(400).end('Invalid local test request');}
});
server.listen(8787,'127.0.0.1',()=>console.log('Local review server: http://127.0.0.1:8787 — set API Endpoint to http://127.0.0.1:8787/v1 and leave Key empty. Ctrl+C stops it.'));
