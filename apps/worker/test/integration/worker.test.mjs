import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { after, before, beforeEach, test } from '../../../../tests/support/test-harness.mjs';
import { createPoolClient } from '@online-school/db';
import { ok, err } from '@online-school/shared';
import { OutboxWorker } from '../../dist/outbox.js';
import { RecoveryWorker } from '../../dist/recovery.js';
import { LessonOutcomeTimeoutHandler, StarPendingHandler } from '../../dist/handlers.js';
import { dbNow, readOptions } from '../../dist/contracts.js';
import {
  director,
  fundedSubscription,
  insert,
} from '../../../../packages/db/test/integration/finance-fixtures.mjs';

const url = process.env.WORKER_TEST_DATABASE_URL;
assert.ok(url, 'Set WORKER_TEST_DATABASE_URL to an isolated migrated test database');
const target = new URL(url);
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname));
assert.match(target.pathname, /^\/online_school_test_task11[a-z0-9_]*$/);
assert.notEqual(process.env.APP_ENV, 'production');
const connection = createPoolClient({ DATABASE_URL: url });
assert.ok(connection.ok);
const db = connection.value;
const requireDb = createRequire(new URL('../../../../packages/db/package.json', import.meta.url));
const { Pool } = requireDb('pg');
const pool = new Pool({ connectionString: url });
const options = { ...readOptions({}).value, batchSize: 1 };
let staff, finance, student, paymentWithContact;

before(async () => {
  staff = await director(pool);
  student = await insert(pool, 'students', { full_name: 'Synthetic worker student' }, false);
  finance = await fundedSubscription(pool, staff.id, student.id);
  paymentWithContact = await insert(pool, 'payment_receipts', {
    student_id: student.id,
    amount: '100.0000',
    currency: 'MDL',
    registered_by_manager_id: staff.id,
    registered_at: '2026-10-01T12:00:00Z',
    confirmed_by_director_id: staff.id,
    confirmed_by_director_at: '2026-10-01T12:00:00Z',
    confirmation_operation_id: randomUUID(),
  });
});
beforeEach(async () => {
  // Isolate each short smoke from historical pending fixtures in this disposable TASK-11 clone.
  await db.outboxEvent.updateMany({
    where: { status: 'PENDING' },
    data: { next_attempt_at: new Date('2100-01-01') },
  });
  await db.recoveryState.updateMany({
    where: { status: 'PENDING' },
    data: { next_check_at: new Date('2100-01-01') },
  });
});
after(async () => {
  await db.$disconnect();
  await pool.end();
});

async function event(topic = 'student.created.v1', overrides = {}) {
  const operationId = randomUUID();
  const audit = await db.auditEvent.create({
    data: {
      actor_kind: 'SYSTEM',
      system_actor_ref: 'worker-test',
      action: 'worker-test',
      resource_type: 'Fixture',
      result: 'SUCCESS',
      request_id: randomUUID(),
      source_operation_id: operationId,
      event_key: randomUUID(),
    },
  });
  return db.outboxEvent.create({
    data: {
      topic,
      aggregate_type: 'Fixture',
      aggregate_id: randomUUID(),
      source_operation_id: operationId,
      audit_event_id: audit.id,
      event_key: randomUUID(),
      payload: { schemaVersion: 1 },
      next_attempt_at: new Date(0),
      ...overrides,
    },
  });
}
async function retryNow(e) {
  await db.outboxEvent.update({ where: { id: e.id }, data: { next_attempt_at: new Date(0) } });
}
async function jobFor(e) {
  return db.jobRecord.findUniqueOrThrow({
    where: { deduplication_key: `outbox-delivery:${e.id}` },
  });
}

test('two workers consume independent events; duplicate payment delivery creates one task and preserves resolution', async () => {
  const payment = paymentWithContact;
  const first = await event('finance.payment.confirmed.v1', { aggregate_id: payment.id });
  const second = await event('payment.confirmed.v1', { aggregate_id: payment.id });
  await Promise.all([
    new OutboxWorker(db, options).processDue(),
    new OutboxWorker(db, options).processDue(),
  ]);
  for (const e of [first, second])
    assert.equal((await db.outboxEvent.findUnique({ where: { id: e.id } })).status, 'DELIVERED');
  const key = `payment-confirmed:${payment.id}`;
  assert.equal(await db.crmTask.count({ where: { idempotency_key: key } }), 1);
  await db.crmTask.update({
    where: { idempotency_key: key },
    data: { status: 'RESOLVED', resolved_at: new Date(), resolved_by_staff_id: staff.id },
  });
  await event('payment.confirmed.v1', { aggregate_id: payment.id });
  await new OutboxWorker(db, options).processDue();
  assert.equal(
    (await db.crmTask.findUnique({ where: { idempotency_key: key } })).status,
    'RESOLVED',
  );
});

test('a locked outbox row is skipped; a second worker can continue', async () => {
  const locked = await event();
  const free = await event();
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM outbox_events WHERE id=${locked.id}::uuid FOR UPDATE`;
    await new OutboxWorker(db, options).processDue();
    assert.equal((await db.outboxEvent.findUnique({ where: { id: free.id } })).status, 'DELIVERED');
  });
  assert.equal((await db.outboxEvent.findUnique({ where: { id: locked.id } })).status, 'PENDING');
});

test('failed handler rolls back effects, persists sanitized attempt and backoff, then retries successfully', async () => {
  const e = await event('test.fail.v1');
  const key = `rollback:${e.id}`;
  const worker = new OutboxWorker(
    db,
    options,
    new Map([
      [
        'test.fail.v1',
        async (tx) => {
          await tx.crmTask.create({
            data: {
              type: 'MANUAL',
              student_id: student.id,
              title: 'Synthetic rolled-back task',
              due_at: new Date(),
              idempotency_key: key,
            },
          });
          return err({ code: 'HANDLER_REJECTED' });
        },
      ],
    ]),
  );
  await worker.processDue();
  assert.equal(await db.crmTask.count({ where: { idempotency_key: key } }), 0);
  const pending = await db.outboxEvent.findUniqueOrThrow({ where: { id: e.id } });
  assert.equal(pending.last_error_code, 'HANDLER_REJECTED');
  assert.ok(+pending.next_attempt_at - +pending.last_attempt_at >= 1000);
  assert.equal((await jobFor(e)).status, 'PENDING');
  await retryNow(e);
  await new OutboxWorker(
    db,
    options,
    new Map([['test.fail.v1', async () => ok(undefined)]]),
  ).processDue();
  assert.equal((await jobFor(e)).status, 'SUCCEEDED');
  assert.equal(await db.jobAttempt.count({ where: { job_id: (await jobFor(e)).id } }), 2);
});

test('DEAD after configured max attempts does not crash or prevent the next event', async () => {
  const bad = await event('test.unknown.v1');
  const good = await event();
  await new OutboxWorker(db, { ...options, maxAttempts: 1, batchSize: 2 }).processDue();
  assert.equal((await db.outboxEvent.findUnique({ where: { id: bad.id } })).status, 'DEAD');
  assert.equal((await jobFor(bad)).status, 'FAILED');
  assert.equal((await db.outboxEvent.findUnique({ where: { id: good.id } })).status, 'DELIVERED');
  assert.equal(await db.auditEvent.count({ where: { event_key: `worker:dead:${bad.id}` } }), 1);
});

test('SIGKILL after claim preserves unfinished work; restarted worker reclaims lease and fences the old owner', async (t) => {
  const e = await event();
  const child = fork(new URL('../fixtures/crash-worker.mjs', import.meta.url), [], {
    env: { ...process.env, WORKER_TEST_DATABASE_URL: url },
    stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
  });
  t.after(() => {
    if (child.exitCode === null) child.kill('SIGKILL');
  });
  const [claim] = await once(child, 'message', { signal: AbortSignal.timeout(10000) });
  assert.equal(claim.event.id, e.id);
  assert.equal((await jobFor(e)).status, 'RUNNING');
  const exited = once(child, 'exit');
  child.kill('SIGKILL');
  await exited;
  assert.equal((await jobFor(e)).attempts, 1);
  await db.$executeRaw`UPDATE job_records SET locked_until=started_at+interval '1 millisecond' WHERE id=${claim.job.id}::uuid`;
  await db.outboxEvent.update({ where: { id: e.id }, data: { locked_until: new Date(0) } });
  const restarted = new OutboxWorker(db, options);
  await restarted.processDue();
  assert.equal((await jobFor(e)).status, 'SUCCEEDED');
  assert.equal((await jobFor(e)).attempts, 2);
  await restarted.deliver(claim);
  assert.equal(await db.auditEvent.count({ where: { event_key: `worker:observed:${e.id}` } }), 1);
  const attempts = await db.jobAttempt.findMany({
    where: { job_id: claim.job.id },
    orderBy: { attempt_no: 'asc' },
  });
  assert.deepEqual(
    attempts.map((a) => [a.result, a.error]),
    [
      ['FAILED', 'LEASE_EXPIRED'],
      ['SUCCEEDED', null],
    ],
  );
});

async function externalJob(provider = 'synthetic') {
  const job = await db.jobRecord.create({
    data: {
      type: 'meet.create.v1',
      payload: {},
      source_operation_id: randomUUID(),
      deduplication_key: randomUUID(),
      retry_policy: 'RECONCILE_BEFORE_RETRY',
      max_attempts: 3,
    },
  });
  await db.$transaction(async (tx) => {
    const now = await dbNow(tx);
    await tx.jobRecord.update({
      where: { id: job.id },
      data: {
        status: 'RUNNING',
        attempts: 1,
        started_at: now,
        locked_by: 'synthetic',
        locked_until: new Date(+now + 30000),
      },
    });
    await tx.jobAttempt.create({
      data: { job_id: job.id, attempt_no: 1, started_at: now, result: 'UNKNOWN', finished_at: now },
    });
    await tx.jobRecord.update({
      where: { id: job.id },
      data: { status: 'RECONCILIATION_REQUIRED', locked_by: null, locked_until: null },
    });
  });
  const recovery = await db.recoveryState.create({
    data: {
      job_id: job.id,
      attempt_no: 1,
      operation_key: randomUUID(),
      provider,
      provider_request_id: randomUUID(),
    },
  });
  return { job, recovery };
}

test('unknown external outcome cannot retry; CONFIRMED needs evidence and settles without creating another resource', async () => {
  const { job, recovery } = await externalJob();
  await assert.rejects(db.jobRecord.update({ where: { id: job.id }, data: { status: 'PENDING' } }));
  let checks = 0;
  const providers = new Map([
    [
      'synthetic',
      {
        check: async (state) => {
          checks++;
          assert.equal(state.operation_key, recovery.operation_key);
          return {
            status: 'CONFIRMED',
            resourceId: 'existing-meet',
            evidenceRef: 'synthetic-proof',
          };
        },
      },
    ],
  ]);
  await Promise.all([
    new RecoveryWorker(db, options, providers).processDue(),
    new RecoveryWorker(db, options, providers).processDue(),
  ]);
  assert.equal(checks, 1);
  assert.equal(
    (await db.recoveryState.findUnique({ where: { id: recovery.id } })).status,
    'CONFIRMED',
  );
  assert.equal((await db.jobRecord.findUnique({ where: { id: job.id } })).status, 'SUCCEEDED');
});

test('verified FAILED permits retry; missing evidence keeps the original operation blocked', async () => {
  const { job, recovery } = await externalJob();
  await new RecoveryWorker(
    db,
    options,
    new Map([['synthetic', { check: async () => ({ status: 'FAILED', evidenceRef: '' }) }]]),
  ).processDue();
  assert.equal(
    (await db.jobRecord.findUnique({ where: { id: job.id } })).status,
    'RECONCILIATION_REQUIRED',
  );
  await db.recoveryState.update({
    where: { id: recovery.id },
    data: { next_check_at: new Date(0) },
  });
  await new RecoveryWorker(
    db,
    options,
    new Map([
      ['synthetic', { check: async () => ({ status: 'FAILED', evidenceRef: 'verified-absent' }) }],
    ]),
  ).processDue();
  assert.equal(
    (await db.recoveryState.findUnique({ where: { id: recovery.id } })).status,
    'FAILED',
  );
  assert.equal((await db.jobRecord.findUnique({ where: { id: job.id } })).status, 'PENDING');
});

test('unconfigured provider escalates after N checks with one AuditEvent and no blind retry', async () => {
  const { job, recovery } = await externalJob('unconfigured-s3');
  const recoveryOptions = { ...options, recoveryMaxAttempts: 2 };
  await new RecoveryWorker(db, recoveryOptions).processDue();
  await db.recoveryState.update({
    where: { id: recovery.id },
    data: { next_check_at: new Date(0) },
  });
  await new RecoveryWorker(db, recoveryOptions).processDue();
  await new RecoveryWorker(db, recoveryOptions).processDue();
  const state = await db.recoveryState.findUnique({ where: { id: recovery.id } });
  assert.equal(state.status, 'NEEDS_MANUAL');
  assert.equal(state.check_attempts, 2);
  assert.equal(
    (await db.jobRecord.findUnique({ where: { id: job.id } })).status,
    'RECONCILIATION_REQUIRED',
  );
  assert.equal(
    await db.auditEvent.count({ where: { event_key: `worker:recovery-manual:${recovery.id}` } }),
    1,
  );
});

test('provider timeout is bounded and never treated as verified failure', async () => {
  const { recovery } = await externalJob();
  await new RecoveryWorker(
    db,
    { ...options, providerTimeoutMs: 10 },
    new Map([
      [
        'synthetic',
        {
          check: async () => new Promise(() => {}),
        },
      ],
    ]),
  ).processDue();
  const state = await db.recoveryState.findUnique({ where: { id: recovery.id } });
  assert.equal(state.status, 'PENDING');
  assert.equal(state.locked_by, null);
});

test('24-hour outcome and star handlers create one task on replay and reject an early deadline', async () => {
  for (const star of [false, true]) {
    const account = await db.authAccount.create({
      data: { kind: 'TEACHER', login_id: randomUUID() },
    });
    const teacher = await db.teacherAccount.create({
      data: { account_id: account.id, full_name: 'Synthetic worker teacher' },
    });
    const assignment = await db.teachingAssignment.create({
      data: {
        enrollment_id: finance.enrollment.id,
        teacher_id: teacher.id,
        valid_from: new Date('2026-10-01'),
        basis: 'Synthetic worker assignment',
        assigned_by_id: staff.id,
        source_operation_id: randomUUID(),
      },
    });
    const lesson = await db.lessonOccurrence.create({
      data: {
        enrollment_id: finance.enrollment.id,
        teaching_assignment_id: assignment.id,
        scheduled_teacher_id: teacher.id,
        original_scheduled_at: new Date('2026-10-02T12:00:00Z'),
        scheduled_at: new Date('2026-10-02T12:00:00Z'),
        scheduled_end_at: new Date('2026-10-02T13:00:00Z'),
        status: star ? 'STAR_PENDING' : 'SCHEDULED',
        source_operation_id: randomUUID(),
      },
    });
    const key = `${star ? 'star-follow-up' : 'outcome-deadline'}:${lesson.id}:1`;
    const e = await event(star ? 'schedule.star-follow-up.v1' : 'schedule.outcome-overdue.v1', {
      aggregate_id: lesson.id,
      event_key: key,
    });
    const handler = star ? StarPendingHandler : LessonOutcomeTimeoutHandler;
    if (!star) {
      const early = await db.$transaction((tx) => handler(tx, e, new Date('2026-10-03T12:59:59Z')));
      assert.equal(early.error.code, 'LESSON_DEADLINE_NOT_REACHED');
      assert.equal(await db.crmTask.count({ where: { idempotency_key: key } }), 0);
    }
    await new OutboxWorker(db, options).processDue();
    await db.$transaction(async (tx) => assert.ok((await handler(tx, e, await dbNow(tx))).ok));
    assert.equal((await db.outboxEvent.findUnique({ where: { id: e.id } })).status, 'DELIVERED');
    assert.equal(await db.crmTask.count({ where: { idempotency_key: key } }), 1);
  }
});

test('file revocation and entitlement logs are append-only and deduplicated', async () => {
  const now = new Date('2026-10-02T12:00:00Z');
  const object = await db.s3Object.create({
    data: {
      bucket: 'synthetic-worker',
      key: randomUUID(),
      size: 1n,
      content_type: 'text/plain',
      status: 'VERIFIED',
      uploaded_at: now,
      verified_at: now,
      uploaded_by: staff.account_id,
      source_operation_id: randomUUID(),
    },
  });
  const permission = await db.filePermission.create({
    data: {
      s3_object_id: object.id,
      subject_id: staff.account_id,
      subject_type: 'STAFF',
      granted_by: staff.account_id,
      granted_at: now,
      source_operation_id: randomUUID(),
    },
  });
  await db.filePermission.update({
    where: { id: permission.id },
    data: { revoked_at: now, revoked_by: staff.account_id },
  });
  const grant = await db.entitlementGrant.create({
    data: {
      subscription_id: finance.subscription.id,
      payment_distribution_id: finance.distribution.id,
      quantity: 2,
      basis: 'CONFIRMED_PAYMENT',
      granted_at: now,
      authorized_by_id: staff.id,
      source_operation_id: randomUUID(),
    },
  });
  for (let i = 0; i < 2; i++) {
    await event('file.access-revoked.v1', { aggregate_id: permission.id });
    await event('entitlement.granted.v1', { aggregate_id: grant.id });
    await new OutboxWorker(db, { ...options, batchSize: 2 }).processDue();
  }
  assert.equal(
    await db.fileAuditLog.count({ where: { permission_id: permission.id, action: 'REVOKE' } }),
    1,
  );
  assert.equal(
    await db.auditEvent.count({ where: { event_key: `worker:entitlement-granted:${grant.id}` } }),
    1,
  );
});

test('payment without a CRM student is logged without creating an orphan task', async () => {
  const e = await event('finance.payment.confirmed.v1', { aggregate_id: finance.payment.id });
  await new OutboxWorker(db, options).processDue();
  assert.equal((await db.outboxEvent.findUnique({ where: { id: e.id } })).status, 'DELIVERED');
  assert.equal(
    await db.auditEvent.count({
      where: { event_key: `worker:payment-unassigned:${finance.payment.id}` },
    }),
    1,
  );
});
