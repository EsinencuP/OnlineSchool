import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WorkerLifecycle, WorkerModule } from './worker.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerModule, { abortOnError: false });
  // Drain before Nest destroys imported modules and their database connections.
  let shutdown: Promise<void> | undefined;
  const stop = () => {
    shutdown ??= app
      .get(WorkerLifecycle)
      .onModuleDestroy()
      .then(() => app.close());
    void shutdown.catch(() => {
      Logger.error('Worker shutdown failed', 'Bootstrap');
      process.exitCode = 1;
    });
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}

void bootstrap().catch(() => {
  Logger.error('Worker initialization failed', 'Bootstrap');
  process.exitCode = 1;
});
