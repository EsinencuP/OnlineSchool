import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { setupSwagger } from './openapi/swagger.js';

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
