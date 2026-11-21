import 'reflect-metadata';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Logger } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import type { HttpRequest, HttpResponse } from './core/http.js';
import { setupSwagger } from './openapi/swagger.js';

const cabinetPath = /^\/(?:$|(?:account|student|teacher|manager|director|operator)(?:\/|$))/;
const servicePath = /^\/(?:api|health|assets)(?:\/|$)/;
const wantsHtml = (req: HttpRequest) => {
  const accept = req.headers.accept;
  return typeof accept === 'string' && accept.includes('text/html');
};
const notFoundPage = Buffer.from(`<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Страница не найдена</title>
<style>
body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;background:#f6f5fb;color:#1f1d2b}
main{max-width:420px;padding:32px 24px;text-align:center}
h1{margin:0 0 12px;font-size:24px}
p{margin:0 0 24px;color:#5b5870;line-height:1.5}
a{display:inline-block;padding:12px 20px;border-radius:12px;background:#5b4bdb;color:#fff;text-decoration:none;font-weight:600}
a:focus-visible{outline:3px solid #1f1d2b;outline-offset:3px}
</style>
</head>
<body>
<main>
<h1>Страница не найдена</h1>
<p>Такого адреса в кабинете нет. Проверьте ссылку или вернитесь в свой кабинет.</p>
<a href="/account">Перейти в кабинет</a>
</main>
</body>
</html>
`);

async function serveCabinets(app: INestApplication, directory: string) {
  const root = resolve(directory);
  const index = await readFile(join(root, 'index.html'));
  app.getHttpAdapter().useStaticAssets!(join(root, 'assets'), {
    prefix: '/assets/',
    index: false,
    maxAge: '1y',
    immutable: true,
  });
  app.use((req: HttpRequest, res: HttpResponse, next: () => void) => {
    const path = req.url?.split('?')[0] ?? '';
    const readable = req.method === 'GET' || req.method === 'HEAD';
    if (readable && !cabinetPath.test(path) && !servicePath.test(path) && wantsHtml(req)) {
      // A browser typing an unknown address gets a page, not the API's JSON error.
      res.writeHead(404, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Length': notFoundPage.length,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'same-origin',
      });
      res.end(req.method === 'HEAD' ? undefined : notFoundPage);
      return;
    }
    if (!readable || !cabinetPath.test(path)) {
      next();
      return;
    }
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Length': index.length,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'same-origin',
    });
    res.end(req.method === 'HEAD' ? undefined : index);
  });
}

async function bootstrap(): Promise<void> {
  const port = Number(process.env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    Logger.error('PORT must be an integer between 0 and 65535', 'Bootstrap');
    process.exitCode = 1;
    return;
  }

  const app = await NestFactory.create(AppModule, { abortOnError: false });
  setupSwagger(app);
  app.enableShutdownHooks();
  try {
    if (process.env.PLATFORM_DIST_DIR) await serveCabinets(app, process.env.PLATFORM_DIST_DIR);
    await app.listen(port, process.env.HOST ?? '127.0.0.1');
  } catch {
    await app.close();
    Logger.error('API listener could not start', 'Bootstrap');
    process.exitCode = 1;
  }
}

void bootstrap().catch(() => {
  Logger.error('API initialization failed', 'Bootstrap');
  process.exitCode = 1;
});
