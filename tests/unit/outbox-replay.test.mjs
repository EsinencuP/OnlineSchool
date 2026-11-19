import '../../apps/api/node_modules/reflect-metadata/Reflect.js';
import { afterAll, beforeAll, beforeEach, expect, jest, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../../apps/api/dist/app.module.js';
import { OUTBOX_AUDIT_REPLAY_TOPIC } from '../../apps/api/dist/modules/qa/outbox-replay.js';
import { createHandlers } from '../../apps/worker/dist/handlers.js';
import { Prisma } from '../../packages/db/dist/index.js';
import { managerFixture } from '../support/manager-crm-fixture.mjs';

function deadDemoSwitch() {
  const sessionId = randomUUID();
  const operationId = randomUUID();
  return {
    id: randomUUID(),
    status: 'DEAD',
    topic: 'auth.demo.switch.v1',
    last_error_code: 'OUTBOX_HANDLER_NOT_REGISTERED',
    schema_version: 1,
    aggregate_type: 'Session',
    aggregate_id: sessionId,
    source_operation_id: operationId,
    payload: { schemaVersion: 1, resourceId: sessionId },
    audit_event_ref: {
      action: 'auth.demo.switch',
      result: 'SUCCESS',
      resource_id: sessionId,
      source_operation_id: operationId,
    },
  };
}

let fixture, source;
const command = (index = 5, options = {}) =>
  fixture.api('post', `/api/v1/qa/outbox/${options.id ?? source.id}/replay`, index, {
    key: randomUUID(),
    ...options,
  });

beforeAll(async () => {
  fixture = await managerFixture({ module: AppModule, basePath: '' });
  fixture.client.outboxEvent.findUnique = async ({ where }) =>
    where.id === source.id ? source : null;
  fixture.client.outboxEvent.findFirst = async ({ where }) =>
    fixture.state.outbox.find(
      (event) =>
        event.topic === where.topic &&
        event.aggregate_id === where.aggregate_id &&
        where.status.in.includes(event.status ?? 'PENDING'),
    ) ?? null;
});
beforeEach(async () => {
  source = deadDemoSwitch();
  await fixture.reset();
});
afterAll(async () => await fixture?.app.close());

test('the command writes one audit/outbox pair and retries return the same accepted result', async () => {
  const original = structuredClone(source);
  const key = randomUUID();
  const accepted = await command(5, { key });
  expect(accepted.status).toBe(202);
  expect(accepted.body).toEqual({ eventId: source.id, status: 'QUEUED' });
  expect((await command(5, { key })).body).toEqual(accepted.body);
  expect(source).toEqual(original);
  expect(fixture.state.outbox).toHaveLength(1);
  expect(fixture.state.outbox[0]).toMatchObject({
    topic: OUTBOX_AUDIT_REPLAY_TOPIC,
    aggregate_type: 'OutboxEvent',
    aggregate_id: source.id,
    source_operation_id: key,
    payload: { schemaVersion: 1, resourceId: source.id },
  });
  expect(fixture.state.audit).toContainEqual(
    expect.objectContaining({
      id: fixture.state.outbox[0].audit_event_id,
      actor_id: fixture.accounts[5].id,
      action: 'ops.outbox.audit-replay',
      result: 'SUCCESS',
      resource_id: source.id,
    }),
  );
});

test.each([
  [null, 401],
  [0, 403],
  [2, 403],
  [3, 403],
])('role fixture %s cannot queue replay', async (index, status) => {
  expect((await command(index)).status).toBe(status);
  expect(fixture.state.outbox).toHaveLength(0);
});

test('a privileged command requires session CSRF protection and verified MFA', async () => {
  expect((await command(4, { csrf: false })).status).toBe(403);
  const session = [...fixture.state.sessions.values()].find(
    (row) => row.account_id === fixture.accounts[5].id,
  );
  session.mfa_verified_at = null;
  const result = await command(5);
  expect(result.status).toBe(403);
  expect(result.body.code).toBe('MFA_REQUIRED');
  expect(fixture.state.outbox).toHaveLength(0);
});

test.each([
  { topic: 'finance.payment.confirmed.v1' },
  { topic: 'notification.deliver.v1' },
  { topic: 'teacher.meet.operation.v1' },
  { status: 'DELIVERED' },
  { last_error_code: 'ATTEMPTS_EXHAUSTED' },
  { schema_version: 2 },
  { payload: { schemaVersion: 1, resourceId: randomUUID() } },
])('rejects ineligible source %j', async (change) => {
  Object.assign(source, change);
  const result = await command();
  expect(result.status).toBe(409);
  expect(result.body.code).toBe('OUTBOX_REPLAY_INELIGIBLE');
  expect(fixture.state.outbox).toHaveLength(0);
});

test('a missing or malformed source produces a safe response', async () => {
  expect((await command(5, { id: randomUUID() })).status).toBe(404);
  const malformed = await command(5, { id: 'not-a-uuid' });
  expect(malformed.status).toBe(400);
  expect(malformed.body.code).toBe('INVALID_OUTBOX_EVENT_ID');
  expect(fixture.state.outbox).toHaveLength(0);
});

test('a live replay blocks a second key across operators and can be replaced after terminal failure', async () => {
  const [first, second] = await Promise.all([command(4), command(5)]);
  expect([first.status, second.status].sort()).toEqual([202, 409]);
  expect([first, second].find((response) => response.status === 409).body.code).toBe(
    'OUTBOX_REPLAY_ALREADY_QUEUED',
  );
  expect(fixture.state.outbox).toHaveLength(1);
  fixture.state.outbox[0].status = 'DEAD';
  expect((await command(5)).status).toBe(202);
  expect(fixture.state.outbox).toHaveLength(2);
  fixture.state.outbox[1].status = 'DELIVERED';
  expect((await command(4)).status).toBe(409);
});

test('a concurrent insert conflict rolls back the replay audit and idempotency record', async () => {
  fixture.client.outboxEvent.create.mockRejectedValueOnce(
    new Prisma.PrismaClientKnownRequestError('duplicate', { code: 'P2002', clientVersion: '7' }),
  );
  const response = await command();
  expect(response.status).toBe(409);
  expect(response.body.code).toBe('OUTBOX_REPLAY_ALREADY_QUEUED');
  expect(fixture.state.audit.some((row) => row.action === 'ops.outbox.audit-replay')).toBe(false);
  expect(fixture.state.idem.size).toBe(0);
});

test('the worker preserves the original observation key and operation on replay', async () => {
  const handle = createHandlers().get(OUTBOX_AUDIT_REPLAY_TOPIC);
  const outboxEvent = { findUnique: jest.fn(async () => source) };
  const auditEvent = { createMany: jest.fn(async () => ({ count: 1 })) };
  const replay = {
    id: randomUUID(),
    source_operation_id: randomUUID(),
    aggregate_type: 'OutboxEvent',
    aggregate_id: source.id,
    payload: { schemaVersion: 1, resourceId: source.id },
  };
  const tx = { outboxEvent, auditEvent };
  await expect(handle(tx, replay, new Date())).resolves.toMatchObject({ ok: true });
  expect(auditEvent.createMany).toHaveBeenCalledWith({
    skipDuplicates: true,
    data: [
      expect.objectContaining({
        event_key: `worker:observed:${source.id}`,
        action: 'worker.event-observed',
        source_operation_id: source.source_operation_id,
        resource_id: source.aggregate_id,
      }),
    ],
  });
  source.audit_event_ref.result = 'ERROR';
  await expect(handle(tx, replay, new Date())).resolves.toMatchObject({
    ok: false,
    error: { code: 'OUTBOX_REPLAY_INELIGIBLE' },
  });
  await expect(
    handle(tx, { ...replay, payload: { resourceId: randomUUID() } }, new Date()),
  ).resolves.toMatchObject({
    ok: false,
    error: { code: 'OUTBOX_REPLAY_INVALID_REFERENCE' },
  });
  expect(auditEvent.createMany).toHaveBeenCalledTimes(1);
});
