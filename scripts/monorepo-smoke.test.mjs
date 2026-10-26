import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const requireFromApi = createRequire(new URL('../apps/api/package.json', import.meta.url));
const { NestFactory } = requireFromApi('@nestjs/core');
requireFromApi('reflect-metadata');
const { AppModule } = await import('../apps/api/dist/app.module.js');
const { WorkerModule } = await import('../apps/worker/dist/worker.module.js');

test('API serves the generated health contract using workspace ESM imports', async () => {
  const app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
  try {
    await app.listen(0, '127.0.0.1');
    const response = await fetch(`${await app.getUrl()}/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok', service: 'api' });
  } finally {
    await app.close();
  }
});

test('standalone worker loads workspace imports and releases its lifecycle timer', async () => {
  const worker = await NestFactory.createApplicationContext(WorkerModule, {
    logger: false,
    abortOnError: false,
  });
  await worker.close();
});
