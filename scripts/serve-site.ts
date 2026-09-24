/**
 * Serves _site/ locally so the web terminal can be tried before deploying.
 * Usage: npm run preview  (then open http://localhost:4173)
 */
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname } from 'node:path';

const ROOT = new URL('../_site/', import.meta.url);
const PORT = Number(process.env.PORT ?? 4173);
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

createServer(async (request, response) => {
  const path = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
  const file = new URL(`.${path.endsWith('/') ? `${path}index.html` : path}`, ROOT);
  // Refuse anything that resolves outside _site/.
  if (!file.href.startsWith(ROOT.href)) {
    response.writeHead(403).end();
    return;
  }
  try {
    const body = await readFile(file);
    response.writeHead(200, { 'Content-Type': TYPES[extname(file.pathname)] ?? 'application/octet-stream' }).end(body);
  } catch {
    response.writeHead(404).end('Not found');
  }
}).listen(PORT, () => console.log(`Web terminal: http://localhost:${PORT}`));
