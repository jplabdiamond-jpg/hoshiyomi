// ローカル検証用：public/ を配信し、/api/* を実計算パイプラインで再現（鑑定文のみスタブ）
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { DIVINATIONS } from '../functions/_lib/divinations.js';
import { computeDivination, buildMessages, DISCLAIMER } from '../functions/_lib/reading.js';

const PUB = new URL('../public/', import.meta.url).pathname;
const TYPES = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript', '.json':'application/json' };

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/api/divinations') {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ divinations: DIVINATIONS }));
    }
    if (url.pathname === '/api/reading' && req.method === 'POST') {
      let b = ''; for await (const c of req) b += c;
      const { divination, answers } = JSON.parse(b);
      const computed = computeDivination(divination, answers);
      const msgs = buildMessages(divination, computed, answers); // 構築確認
      const reading =
        `①全体像\nこれは検証用のスタブ鑑定文です（実環境ではWorkers AIが生成）。\n\n②詳細\n` +
        `受け取った確定データ:\n${computed.material}\n\n（messages=${msgs.length}）`;
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ divination, title: computed.title, data: computed.data, material: computed.material, meta: computed.meta, reading, disclaimer: DISCLAIMER, model: 'stub' }));
    }
    let p = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    const buf = await readFile(join(PUB, p));
    res.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream' });
    res.end(buf);
  } catch (e) {
    res.writeHead(404); res.end('not found: ' + e.message);
  }
});
server.listen(8787, () => console.log('mock on http://127.0.0.1:8787'));
