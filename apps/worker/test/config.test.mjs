import assert from 'node:assert/strict';
import { test } from '../../../tests/support/test-harness.mjs';
import { readOptions, retryDelay, safeCode, WorkerFailure } from '../dist/contracts.js';

test('bounded retry schedule and strict environment config', () => {
  assert.equal(readOptions({}).value.maxAttempts, 10);
  assert.deepEqual(
    [1, 2, 3, 4, 5, 6, 10].map(retryDelay),
    [1000, 5000, 30000, 300000, 1800000, 1800000, 1800000],
  );
  for (const value of ['0', '-1', '1.5', 'Infinity', '', '1x', '1001'])
    assert.equal(readOptions({ WORKER_MAX_ATTEMPTS: value }).ok, false);
  assert.equal(readOptions({ WORKER_MAX_ATTEMPTS: '2' }).value.maxAttempts, 2);
  assert.equal(
    readOptions({ WORKER_LEASE_MS: '1000', WORKER_PROVIDER_TIMEOUT_MS: '2000' }).ok,
    false,
  );
  assert.equal(safeCode(new Error('provider secret payload')), 'WORKER_OPERATION_FAILED');
  assert.equal(safeCode(new WorkerFailure('HANDLER_REJECTED')), 'HANDLER_REJECTED');
});

test('worker application context starts and shuts down without an HTTP listener', async () => {
  const { createRequire } = await import('node:module');
  const require = createRequire(new URL('../package.json', import.meta.url));
  require('reflect-metadata');
  const { NestFactory } = require('@nestjs/core');
  const { WorkerModule } = await import('../dist/worker.module.js');
  const previousUrl = process.env.DATABASE_URL;
  const previousMode = process.env.NODE_ENV;
  delete process.env.DATABASE_URL;
  process.env.NODE_ENV = 'test';
  try {
    const app = await NestFactory.createApplicationContext(WorkerModule, {
      logger: false,
      abortOnError: false,
    });
    await app.close();
  } finally {
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
    if (previousMode === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousMode;
  }
});
