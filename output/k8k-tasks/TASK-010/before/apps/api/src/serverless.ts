import 'reflect-metadata';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { setupSwagger } from './openapi/swagger.js';
import { normalizeVercelRequest } from './vercel-request.js';

let application: Promise<INestApplication> | undefined;
async function initialize(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
  setupSwagger(app);
  await app.init();
  return app;
}

// One cached HTTP application per Function instance. Never imports/starts the polling worker.
export async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    normalizeVercelRequest(req);
    application ??= initialize().catch((error) => {
      application = undefined;
      return Promise.reject(error);
    });
    const app = await application;
    const listener = app.getHttpAdapter().getInstance() as (
      req: IncomingMessage,
      res: ServerResponse,
    ) => void;
    listener(req, res);
  } catch {
    if (!res.headersSent) {
      res.statusCode = 503;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-store');
      res.end(JSON.stringify({ code: 'API_INITIALIZATION_FAILED', message: 'API unavailable' }));
    }
  }
}
