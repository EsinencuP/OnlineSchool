import 'reflect-metadata';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Logger } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import type { HttpRequest, HttpResponse } from './core/http.js';
import { setupSwagger } from './openapi/swagger.js';

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
    if (
      (req.method !== 'GET' && req.method !== 'HEAD') ||
      !/^\/(?:$|(?:account|student|teacher|manager|director|operator)(?:\/|$))/.test(path)
    ) {
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
