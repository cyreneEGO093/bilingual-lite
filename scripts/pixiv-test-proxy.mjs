// An isolated HTTPS origin simulator: no traffic is forwarded to the Internet.
// Certificates are generated per run and removed with the temporary directory.
import { createServer } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

export async function startPixivProxy() {
  const temporary = await mkdtemp(resolve(tmpdir(), 'bilingual-pixiv-tls-'));
  const requests = [];
  const sockets = new Set();
  let origin, proxy;
  const close = async () => {
    for (const socket of sockets) socket.destroy();
    await Promise.all([origin, proxy].filter(Boolean).map(server => new Promise(r => server.close(r))));
    await rm(temporary, { recursive: true, force: true });
  };
  try {
    execFileSync(process.env.TEST_OPENSSL_PATH || 'openssl', ['req','-x509','-newkey','rsa:2048','-nodes','-days','1',
      '-subj','/CN=localhost','-keyout',resolve(temporary,'key.pem'),'-out',resolve(temporary,'cert.pem')],
    { windowsHide: true, stdio: 'pipe' });
    const image = await readFile('tests/fixtures/manga.png');
    origin = createHttpsServer({key:await readFile(resolve(temporary,'key.pem')),cert:await readFile(resolve(temporary,'cert.pem'))}, (req,res) => {
      res.setHeader('Cache-Control','no-store');
      if (req.headers.host === 'www.pixiv.net') {
        res.setHeader('Content-Type','text/html; charset=utf-8');
        res.end('<body style="margin:30px"><div id="panel" style="width:800px"><img style="width:100%;display:block" src="https://i.pximg.net/test.png"></div></body>');
      } else {
        const allowed = req.headers.referer === 'https://www.pixiv.net/';
        requests.push({ method:req.method,url:req.url,referer:req.headers.referer,cookie:req.headers.cookie,authorization:req.headers.authorization,status:allowed?200:403 });
        res.statusCode = allowed ? 200 : 403;
        res.setHeader('Content-Type',allowed?'image/png':'text/plain');
        res.end(allowed?image:'Forbidden: Pixiv Referer required');
      }
    });
    proxy = createServer((req,res) => {res.writeHead(502);res.end('Only test HTTPS origins are available');});
    proxy.on('connection',socket => {sockets.add(socket);socket.on('close',()=>sockets.delete(socket));});
    proxy.on('connect',(req,socket,head) => {
      if (!['www.pixiv.net:443','i.pximg.net:443'].includes(req.url)) { socket.end('HTTP/1.1 502 Bad Gateway\r\n\r\n');return; }
      socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      if (head.length) socket.unshift(head);
      origin.emit('connection',socket);
    });
    await new Promise(r=>proxy.listen(0,'127.0.0.1',r));
    return {port:proxy.address().port,requests,close};
  } catch(e) {await close();throw e;}
}
