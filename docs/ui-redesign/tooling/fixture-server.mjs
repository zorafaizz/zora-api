// Presentation-only fixture host. Never imports server.js, a DB, mail or providers.
// Use after explicit P0 authorization; API execution always returns a labeled 503.
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateOpenAPISpec, renderScalarHtml } from '../../../src/modules/docs/openapi.js';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const publicRoot = path.join(repo, 'public');
const buildRoot = process.env.KG_QA_BUILD_DIR && path.resolve(process.env.KG_QA_BUILD_DIR);
const port = Number(process.env.KG_QA_PORT || 43873);
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.woff2': 'font/woff2', '.webp': 'image/webp', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.webm': 'video/webm', '.mp4': 'video/mp4', '.wasm': 'application/wasm' };
const server = http.createServer(async (req, res) => {
  res.setHeader('X-KanjutGede-QA', 'isolated-presentation-fixture');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const send = (status, type, body) => { res.writeHead(status, { 'Content-Type': type }); res.end(req.method === 'HEAD' ? undefined : body); };
  try {
    const url = new URL(req.url, 'http://127.0.0.1');
    const name = decodeURIComponent(url.pathname);
    if (!['GET', 'HEAD'].includes(req.method)) return send(503, 'application/json', JSON.stringify({ status: false, error: 'QA fixture: execution, authentication and billing disabled.' }));
    if (name === '/api/v1/openapi.json') return send(200, 'application/json', JSON.stringify(generateOpenAPISpec()));
    if (name === '/docs' || name === '/api/v1/docs') return send(200, 'text/html; charset=utf-8', renderScalarHtml());
    if (name.startsWith('/api/')) return send(503, 'application/json', JSON.stringify({ status: false, error: 'QA fixture: no live API or session. Intercept responses in the test harness.' }));
    if (name === '/explorer.html' || name === '/signin.html') { res.writeHead(308, { Location: name.slice(0, -5) }); return res.end(); }
    const relative = name === '/' ? 'index.html' : name === '/explorer' ? 'explorer.html' : name === '/signin' ? 'signin.html' : name.slice(1);
    // Only public assets and the three actual HTML entries; no repository browsing.
    if (!['index.html', 'explorer.html', 'signin.html'].includes(relative) && !relative.startsWith('assets/')) return send(404, 'text/plain', 'Not found');
    for (const root of [buildRoot, publicRoot].filter(Boolean)) {
      const file = path.resolve(root, relative);
      if (!file.startsWith(root + path.sep)) return send(403, 'text/plain', 'Forbidden');
      try {
        if (!(await stat(file)).isFile()) continue;
        return send(200, mime[path.extname(file)] || 'application/octet-stream', await readFile(file));
      } catch (e) { if (e.code !== 'ENOENT') throw e; }
    }
    send(404, 'text/plain', 'Not found');
  } catch { send(400, 'text/plain', 'Invalid fixture request'); }
});
server.listen(port, '127.0.0.1', () => console.log(`QA fixture: http://127.0.0.1:${server.address().port}; all API execution disabled`));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => server.close(() => process.exit(0)));
