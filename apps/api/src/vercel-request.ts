import { parse } from 'node:querystring';
import type { IncomingMessage } from 'node:http';

// Vercel prepopulates req.query with named rewrite captures. Nest must validate
// the client's query, without the internal catch-all parameter from vercel.json.
export function normalizeVercelRequest(req: IncomingMessage): void {
  const url = new URL(req.url ?? '/', 'http://internal.invalid');
  const query = parse(url.search.slice(1));
  const capture = '__vercel_api_path';
  if (url.pathname.startsWith('/api/') && query[capture] === url.pathname.slice(5)) {
    delete query[capture];
  }
  Object.defineProperty(req, 'query', { value: query, writable: true, configurable: true });
}
