// Temporary reviewer surface. Static allowlist only, loopback only, no API.
import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
const build = new URL('../../../packages/ui/dist/storybook/', import.meta.url);
const files = new Set((await readdir(build, { recursive: true, withFileTypes: true }))
  .filter((e) => e.isFile()).map((e) => pathToFileURL(join(e.parentPath, e.name)).href.slice(build.href.length)));
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const server = createServer(async (req, res) => {
  const file = new URL(req.url, 'http://localhost').pathname.slice(1) || 'index.html';
  if (req.method !== 'GET' || !files.has(file)) return res.writeHead(403).end();
  res.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream' });
  res.end(await readFile(new URL(file, build)));
});
server.listen(6007, '127.0.0.1', () => console.log('Reviewer catalog http://127.0.0.1:6007'));
