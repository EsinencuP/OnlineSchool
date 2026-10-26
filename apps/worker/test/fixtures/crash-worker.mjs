import { createPoolClient } from '@online-school/db';
import { OutboxWorker } from '../../dist/outbox.js';
import { readOptions } from '../../dist/contracts.js';

const connection = createPoolClient({ DATABASE_URL: process.env.WORKER_TEST_DATABASE_URL });
if (!connection.ok) process.exit(1);
const worker = new OutboxWorker(connection.value, readOptions({}).value);
const claim = await worker.claim();
process.send(claim);
// The integration test kills this process after the committed claim, before delivery.
setInterval(() => {}, 1000);
