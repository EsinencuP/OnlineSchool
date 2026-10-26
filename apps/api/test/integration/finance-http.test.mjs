import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { after, before, test } from 'node:test';
import pg from '../../../../packages/db/node_modules/pg/lib/index.js';
import { NestFactory } from '@nestjs/core';
import { createDirectClient } from '@online-school/db';
import { AppModule } from '../../dist/app.module.js';
import { SessionStore } from '../../dist/core/session/session.store.js';
import { TeacherRateService } from '../../dist/modules/finance/teacher-rate.service.js';
import { AuditService } from '../../dist/core/audit/audit.service.js';
import { domainError, fail } from '../../dist/core/errors/domain-error.js';
import { TemporaryAccessExpiry } from '../../dist/modules/finance/expiry.module.js';
import { QA, qaId, seedQA } from '../../../../packages/db/dist-tools/seed.js';
import {
  insert,
  lessonFixture,
} from '../../../../packages/db/test/integration/finance-fixtures.mjs';

const url = process.env.FINANCE_TEST_DATABASE_URL;
assert.ok(url, 'FINANCE_TEST_DATABASE_URL required');
const target = new URL(url);
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(target.hostname));
assert.match(target.pathname, /^\/online_school_test[a-z0-9_]*$/);
const client = createDirectClient({ DIRECT_URL: url }).value;
const pool = new pg.Pool({ connectionString: url });
let app, base, store, runtimeUrl;
const actors = {},
  state = {};
before(async () => {
  assert.equal((await seedQA(client)).ok, true);
  const role = await client.role.findUniqueOrThrow({ where: { code: 'DIRECTOR' } });
  await client.roleAssignment.create({
    data: {
      account_id: qaId('seed-director-001/auth'),
      role_id: role.id,
      valid_from: new Date('2000-01-01Z'),
      valid_to: new Date('2026-10-01Z'),
    },
  });
  await pool.query(
    "DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='task08_runtime') THEN CREATE ROLE task08_runtime LOGIN INHERIT; END IF; END $$",
  );
  await pool.query('GRANT online_school_runtime TO task08_runtime');
  const parsed = new URL(url);
  parsed.username = 'task08_runtime';
  parsed.password = '';
  runtimeUrl = parsed.toString();
  process.env.DATABASE_URL = runtimeUrl;
  process.env.CSRF_SIGNING_SECRET = randomBytes(48).toString('base64url');
  app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
  await app.listen(0, '127.0.0.1');
  base = await app.getUrl();
  store = app.get(SessionStore);
  for (const [name, label] of [
    ['director', 'seed-director-001'],
    ['manager', 'seed-manager-001'],
    ['other', 'seed-manager-002'],
    ['teacher', 'seed-teacher-001'],
    ['teacher2', 'seed-teacher-002'],
  ]) {
    const accountId = qaId(`${label}/auth`);
    const session = await client.$transaction(async (tx) =>
      store.issue(tx, accountId, (await tx.$queryRaw`SELECT clock_timestamp() AS now`)[0].now),
    );
    actors[name] = { ...session, accountId };
  }
  await client.assignedManager.create({
    data: {
      manager_id: QA.managers[0],
      student_id: QA.students[0],
      assigned_at: new Date('2026-10-01Z'),
    },
  });
});
after(async () => {
  await app?.close();
  await client.$disconnect();
  await pool.end();
});
async function call(
  path,
  { actor = 'director', body = {}, method = 'POST', key = randomUUID() } = {},
) {
  const session = actors[actor];
  const headers = { 'content-type': 'application/json', 'idempotency-key': key };
  if (session) {
    headers.cookie = `__Host-school_session=${session.token}; __Host-school_csrf=${session.csrfToken}`;
    headers['x-csrf-token'] = session.csrfToken;
  }
  const result = await fetch(base + '/api/v1/' + path, {
    method,
    headers,
    ...(method === 'GET' ? {} : { body: JSON.stringify(body) }),
  });
  const data = await result.json();
  return { status: result.status, body: data, key, headers: result.headers };
}
const good = (response) => {
  assert.equal(response.status, 200, JSON.stringify(response.body));
  return response.body;
};
async function subscription() {
  return good(
    await call('subscriptions', {
      actor: 'manager',
      body: { enrollmentId: qaId('enrollment-1'), saleConditionId: qaId('sale-001') },
    }),
  );
}
async function receipt(amount = '100', student = QA.students[0]) {
  return good(
    await call('payments/register', {
      actor: 'manager',
      body: {
        studentId: student,
        amount,
        currency: 'MDL',
        provider: 'synthetic',
        externalReference: randomUUID(),
      },
    }),
  );
}
async function allocation(payment, sub, amount) {
  const proposed = good(
    await call(`payments/${payment.id}/distribute`, {
      actor: 'manager',
      body: { subscriptionId: sub.id, amount },
    }),
  );
  return good(await call(`distributions/${proposed.id}/approve`));
}
test('manager registers/proposes but cannot confirm; director confirmation is atomic, cached and creates CRM task', async () => {
  state.sub = await subscription();
  state.payment = await receipt();
  assert.equal(
    (await call(`payments/${state.payment.id}/confirm`, { actor: 'manager' })).status,
    403,
  );
  const confirmed = await call(`payments/${state.payment.id}/confirm`);
  good(confirmed);
  const replay = await call(`payments/${state.payment.id}/confirm`, { key: confirmed.key });
  assert.deepEqual(good(replay), confirmed.body);
  assert.equal(
    await client.auditEvent.count({
      where: { source_operation_id: confirmed.key, action: 'payment.confirm', result: 'SUCCESS' },
    }),
    1,
  );
  const task = await client.crmTask.findUnique({
    where: { idempotency_key: `payment-confirmed:${state.payment.id}` },
  });
  assert.ok(task);
  assert.equal(task.assigned_manager_id, QA.managers[0]);
  const doc = await client.ledgerDocument.findUniqueOrThrow({
    where: { payment_id: state.payment.id },
  });
  const entry = await client.ledgerEntry.findUniqueOrThrow({ where: { document_id: doc.id } });
  assert.ok(entry.published_at);
  assert.deepEqual(entry.balance_snapshot, { MDL: { debit: '100.0000', credit: '100.0000' } });
  state.distribution = await allocation(state.payment, state.sub, '100');
  assert.equal(
    (await call(`distributions/${state.distribution.id}/approve`, { actor: 'manager' })).status,
    403,
  );
});
test('full confirmed allocation grants once; money numbers and unrelated managers are rejected', async () => {
  assert.equal(
    (
      await call('payments/register', {
        actor: 'other',
        body: { studentId: QA.students[0], amount: '1', currency: 'MDL' },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await call('payments/register', {
        actor: 'manager',
        body: { studentId: QA.students[0], amount: 0.1, currency: 'MDL' },
      })
    ).status,
    422,
  );
  state.grant = good(
    await call('entitlements/grant', {
      actor: 'manager',
      body: { subscriptionId: state.sub.id, distributionId: state.distribution.id },
    }),
  );
  assert.equal(state.grant.quantity, 2);
  assert.equal(
    (
      await call('entitlements/grant', {
        actor: 'manager',
        body: { subscriptionId: state.sub.id, distributionId: state.distribution.id },
      })
    ).status,
    409,
  );
});
test('concurrent duplicate consumption is rejected by unique constraint and emits no second money effect', async () => {
  const lesson = await lessonFixture(
    pool,
    { enrollment: { id: state.sub.enrollment_id } },
    QA.director,
  );
  state.lesson = lesson;
  const body = { grantId: state.grant.id, studentId: QA.students[0], lessonId: lesson.lesson.id };
  const results = await Promise.all([
    call('entitlements/consume', { actor: 'manager', body }),
    call('entitlements/consume', { actor: 'manager', body }),
  ]);
  assert.equal(results.filter((r) => r.status === 200).length, 1, JSON.stringify(results));
  assert.equal(results.filter((r) => r.status === 409).length, 1, JSON.stringify(results));
  state.consumption = results.find((r) => r.status === 200).body;
  assert.equal(
    await client.entitlementConsumption.count({
      where: { lesson_occurrence_id: lesson.lesson.id, cancelled_at: null },
    }),
    1,
  );
  assert.equal(
    await client.ledgerDocument.count({ where: { consumption_id: state.consumption.id } }),
    1,
  );
  assert.equal(state.consumption.remaining_count, 1);
});
test('two different lessons cannot spend the last unit; non-conducted lessons are refused', async () => {
  const one = await lessonFixture(
      pool,
      { enrollment: { id: state.sub.enrollment_id } },
      QA.director,
    ),
    two = await lessonFixture(pool, { enrollment: { id: state.sub.enrollment_id } }, QA.director);
  const result = await Promise.all(
    [one, two].map((l) =>
      call('entitlements/consume', {
        actor: 'manager',
        body: { grantId: state.grant.id, studentId: QA.students[0], lessonId: l.lesson.id },
      }),
    ),
  );
  assert.equal(result.filter((r) => r.status === 200).length, 1, JSON.stringify(result));
  assert.equal(result.filter((r) => r.status === 422).length, 1, JSON.stringify(result));
  assert.equal(
    (
      await call('entitlements/consume', {
        actor: 'manager',
        body: { grantId: state.grant.id, studentId: QA.students[0], lessonId: QA.lessons[0] },
      })
    ).body.code,
    'CONFIRMED_LESSON_REQUIRED',
  );
});
test('director correction cancels a consumption and posts a separate revenue reversal; manager cannot adjust', async () => {
  const body = {
    grantId: state.grant.id,
    originalConsumptionId: state.consumption.id,
    kind: 'CONSUMPTION_CANCELLATION',
    reason: 'Synthetic approved correction',
  };
  assert.equal((await call('entitlements/adjust', { actor: 'manager', body })).status, 403);
  const adjusted = good(await call('entitlements/adjust', { body }));
  assert.equal(adjusted.remaining_count, 1);
  assert.ok(
    (await client.entitlementConsumption.findUniqueOrThrow({ where: { id: state.consumption.id } }))
      .cancelled_at,
  );
  assert.equal(
    await client.ledgerEntry.count({
      where: { reverses_entry_id: state.consumption.ledgerEntryId },
    }),
    1,
  );
});
test('every partial installment needs director permission; expiry worker creates exactly one internal CRM task', async () => {
  const sub = await subscription(),
    payment = await receipt('30');
  good(await call(`payments/${payment.id}/confirm`));
  const distribution = await allocation(payment, sub, '30');
  assert.equal(
    (
      await call('entitlements/grant', {
        actor: 'manager',
        body: { subscriptionId: sub.id, distributionId: distribution.id },
      })
    ).body.code,
    'FULL_CONFIRMED_PAYMENT_REQUIRED',
  );
  const expires = new Date(
    +(await client.$queryRaw`SELECT clock_timestamp() AS now`)[0].now + 1000,
  ).toISOString();
  const body = {
    subscriptionId: sub.id,
    grantedLessonsCount: 1,
    expiresAt: expires,
    basis: 'Separate limited director decision',
  };
  assert.equal((await call('temporary-access', { actor: 'manager', body })).status, 403);
  const permission = good(await call('temporary-access', { body }));
  assert.equal(await client.entitlementGrant.count({ where: { subscription_id: sub.id } }), 0);
  await delay(1500);
  const handler = app.get(TemporaryAccessExpiry);
  const results = await Promise.all([handler.processDue(), handler.processDue()]);
  assert.ok(
    results.every((r) => r.ok),
    JSON.stringify(results),
  );
  for (
    let i = 0;
    i < 10 &&
    !(await client.crmTask.count({
      where: { idempotency_key: `temporary-access-expired:${permission.id}` },
    }));
    i++
  ) {
    await delay(200);
    assert.equal((await handler.processDue()).ok, true);
  }
  assert.equal(
    await client.crmTask.count({
      where: { idempotency_key: `temporary-access-expired:${permission.id}` },
    }),
    1,
  );
  assert.equal((await handler.processDue()).value, 0);
  const job = await client.jobRecord.findUniqueOrThrow({
    where: { deduplication_key: `temporary-access-expire:${permission.id}` },
  });
  assert.equal(job.status, 'SUCCEEDED');
  assert.equal(
    await client.jobAttempt.count({ where: { job_id: job.id, result: 'SUCCEEDED' } }),
    1,
  );
  const rest = await receipt('70');
  good(await call(`payments/${rest.id}/confirm`));
  const final = await allocation(rest, sub, '70');
  const grant = good(
    await call('entitlements/grant', {
      actor: 'manager',
      body: { subscriptionId: sub.id, distributionId: final.id },
    }),
  );
  assert.equal(grant.quantity, 2);
});
test('unbalanced and cross-currency-offset entries return 422, and canonical manual publication works', async () => {
  const r = await client.paymentReceipt.create({
    data: {
      amount: '10',
      currency: 'MDL',
      registered_by_manager_id: QA.managers[0],
      registered_at: new Date('2026-10-01Z'),
      confirmed_by_director_id: QA.director,
      confirmed_by_director_at: new Date('2026-10-01Z'),
      confirmation_operation_id: randomUUID(),
      source_operation_id: randomUUID(),
    },
  });
  const doc = await client.ledgerDocument.create({
    data: {
      payment_id: r.id,
      basis: 'Synthetic imported confirmed receipt',
      source_operation_id: randomUUID(),
    },
  });
  const bad = [
    { accountType: 'CASH', direction: 'DEBIT', amount: '10', currency: 'MDL' },
    { accountType: 'UNALLOCATED_FUNDS', direction: 'CREDIT', amount: '9', currency: 'MDL' },
  ];
  assert.equal(
    (await call('ledger/entries', { body: { documentId: doc.id, lines: bad } })).status,
    422,
  );
  bad[1] = { ...bad[1], amount: '10', currency: 'EUR' };
  assert.equal(
    (await call('ledger/entries', { body: { documentId: doc.id, lines: bad } })).body.code,
    'LEDGER_UNBALANCED',
  );
  assert.equal(
    (await call('ledger/entries', { actor: 'manager', body: { documentId: doc.id } })).status,
    403,
  );
  const entry = good(await call('ledger/entries', { body: { documentId: doc.id } }));
  assert.ok(entry.published_at);
});
test('closed published history is corrected by reversal plus canonical replacement in current period', async () => {
  const old = await client.financialPeriod.create({
    data: {
      starts_at: new Date('2026-08-01Z'),
      ends_at: new Date('2026-09-01Z'),
      source_operation_id: randomUUID(),
    },
  });
  const r = await client.paymentReceipt.create({
    data: {
      amount: '7',
      currency: 'MDL',
      registered_by_manager_id: QA.managers[0],
      registered_at: new Date('2026-08-01Z'),
      confirmed_by_director_id: QA.director,
      confirmed_by_director_at: new Date('2026-08-01Z'),
      confirmation_operation_id: randomUUID(),
      source_operation_id: randomUUID(),
    },
  });
  const doc = await client.ledgerDocument.create({
    data: {
      payment_id: r.id,
      basis: 'Synthetic historical classification error',
      source_operation_id: randomUUID(),
    },
  });
  const entry = await client.ledgerEntry.create({
    data: {
      document_id: doc.id,
      financial_period_id: old.id,
      currency: 'MDL',
      effective_at: new Date('2026-08-05Z'),
      source_operation_id: randomUUID(),
    },
  });
  for (const [position, direction, account_type] of [
    [1, 'DEBIT', 'CASH'],
    [2, 'CREDIT', 'CUSTOMER_ADVANCE'],
  ])
    await client.ledgerLine.create({
      data: { entry_id: entry.id, position, direction, account_type, amount: '7', currency: 'MDL' },
    });
  await client.ledgerEntry.update({
    where: { id: entry.id },
    data: {
      balanced_at: new Date(),
      published_at: new Date(),
      published_by_id: QA.director,
      publication_operation_id: randomUUID(),
      balance_snapshot: { MDL: { debit: '7.0000', credit: '7.0000' } },
    },
  });
  assert.equal((await call(`periods/${old.id}/close`, { actor: 'manager' })).status, 403);
  good(await call(`periods/${old.id}/close`));
  const original = await client.ledgerEntry.findUniqueOrThrow({ where: { id: entry.id } });
  const corrected = good(
    await call('ledger/adjustments', {
      body: { entryId: entry.id, reason: 'Director corrected historical classification' },
    }),
  );
  assert.ok(corrected.reversalEntryId);
  assert.deepEqual(
    await client.ledgerEntry.findUniqueOrThrow({ where: { id: entry.id } }),
    original,
  );
  assert.equal(
    (
      await call('ledger/adjustments', {
        body: { entryId: entry.id, reason: 'Duplicate correction attempt' },
      })
    ).status,
    409,
  );
});
test('accrual reuses the actual-start snapshot; payout is a separate confirmed fact; teacher sees only own payroll', async () => {
  // A separate subject has no historical paid subscription.
  const subject = await insert(
    pool,
    'subjects',
    { code: randomUUID(), name: 'Synthetic unpaid subject' },
    false,
  );
  const enrollment = await insert(pool, 'student_subject_enrollments', {
    student_id: QA.students[0],
    subject_id: subject.id,
    valid_from: '2026-10-01Z',
  });
  const unpaid = await lessonFixture(pool, { enrollment }, QA.director);
  state.payrollLesson = unpaid;
  assert.equal(
    (
      await call('accruals', {
        actor: 'manager',
        body: { outcomeId: state.payrollLesson.outcome.id, basis: 'Synthetic unpaid review' },
      })
    ).body.code,
    'UNPAID_LESSON_REQUIRES_DIRECTOR_DECISION',
  );
  const accrual = good(
    await call('accruals', {
      body: {
        outcomeId: state.payrollLesson.outcome.id,
        basis: 'Director approved historical performed work',
        exceptionAmount: '200',
      },
    }),
  );
  assert.equal(accrual.rate_snapshot, '200');
  assert.ok(accrual.obligationId);
  const attempt = good(
    await call('payouts/attempt', {
      actor: 'manager',
      body: {
        obligationId: accrual.obligationId,
        amount: '200',
        provider: 'synthetic-manual',
        providerRequestId: randomUUID(),
      },
    }),
  );
  assert.equal(await client.confirmedPayout.count({ where: { attempt_id: attempt.id } }), 0);
  assert.equal(
    (
      await call('payouts/attempt', {
        actor: 'manager',
        body: {
          obligationId: accrual.obligationId,
          amount: '1',
          provider: 'synthetic-manual',
          providerRequestId: randomUUID(),
        },
      })
    ).status,
    409,
  );
  const paid = good(
    await call(`payouts/${attempt.id}/confirm`, {
      actor: 'manager',
      body: { providerConfirmationId: randomUUID() },
    }),
  );
  assert.equal(paid.amount, '200');
  assert.equal(
    (
      await call(`payouts/${attempt.id}/confirm`, {
        actor: 'manager',
        body: { providerConfirmationId: randomUUID() },
      })
    ).status,
    409,
  );
  const own = await call(`teacher/${QA.teachers[0]}/payroll`, { actor: 'teacher', method: 'GET' });
  good(own);
  assert.equal(
    (await call(`teacher/${QA.teachers[1]}/payroll`, { actor: 'teacher', method: 'GET' })).status,
    403,
  );
  assert.ok(!JSON.stringify(own.body).includes('full_price'));
  good(await call('periods', { actor: 'manager', method: 'GET' }));
});
test('rehire after seven months excludes prior credits; promises are explicit and start snapshots do not drift', async () => {
  const teacher = state.lesson.teacher.id;
  const previous = await client.teacherEngagement.create({
    data: {
      teacher_id: teacher,
      starts_at: new Date('2024-01-01Z'),
      ends_at: new Date('2025-01-01Z'),
      basis: 'Synthetic previous employment',
      recorded_by_id: QA.director,
      source_operation_id: randomUUID(),
    },
  });
  for (let i = 0; i < 12; i++)
    await client.teacherTenureCredit.create({
      data: {
        engagement_id: previous.id,
        starts_on: new Date(Date.UTC(2024, i, 1)),
        ends_on: new Date(Date.UTC(2024, i + 1, 1)),
        basis: 'Verified full eligible month',
        recorded_by_id: QA.director,
        source_operation_id: randomUUID(),
      },
    });
  await client.teacherEngagement.create({
    data: {
      teacher_id: teacher,
      starts_at: new Date('2025-08-01Z'),
      basis: 'Synthetic rehire after seven months',
      recorded_by_id: QA.director,
      source_operation_id: randomUUID(),
    },
  });
  const rates = app.get(TeacherRateService),
    before = await client.$transaction((tx) => rates.quote(tx, teacher, new Date('2026-10-01Z')));
  assert.equal(before.context.eligibleMonths, 0);
  assert.equal(before.rate.toString(), '200');
  await client.teacherRatePromise.create({
    data: {
      teacher_id: teacher,
      valid_from: new Date('2026-10-01Z'),
      minimum_rate: '230',
      additive_rate: '0',
      currency: 'MDL',
      basis: 'Explicit individually promised minimum',
      recorded_by_id: QA.director,
      source_operation_id: randomUUID(),
    },
  });
  const promised = await client.$transaction((tx) =>
    rates.quote(tx, teacher, new Date('2026-10-02Z')),
  );
  assert.equal(promised.rate.toString(), '230');
  assert.equal(promised.basis, 'INDIVIDUAL_PROMISE');
  const start = new Date('2026-10-27T12:00:00Z');
  const next = await insert(pool, 'lesson_occurrences', {
    enrollment_id: state.sub.enrollment_id,
    teaching_assignment_id: state.lesson.assignment.id,
    scheduled_teacher_id: teacher,
    original_scheduled_at: start,
    scheduled_at: start,
    scheduled_end_at: new Date(+start + 3600000),
    status: 'SCHEDULED',
  });
  const actor = {
    accountId: actors.director.accountId,
    sessionId: actors.director.id,
    roles: ['DIRECTOR'],
    role: 'DIRECTOR',
    kind: 'STAFF',
    mfaCompleted: true,
    lastActiveAt: new Date(),
    expiresAt: new Date(Date.now() + 60000),
  };
  const snapshot = await client.$transaction((tx) =>
    rates.snapshotAtStart(
      { tx, actor, operationId: randomUUID(), requestId: randomUUID() },
      next.id,
      teacher,
      start,
    ),
  );
  assert.equal(snapshot.rate_at_start_snapshot.toString(), '230');
  assert.equal(snapshot.rate_context_snapshot.promiseId, promised.context.promiseId);
  await assert.rejects(
    client.lessonOccurrence.update({
      where: { id: next.id },
      data: { rate_context_snapshot: { eligibleMonths: 99 } },
    }),
  );
  const old = await client.lessonOccurrence.findUniqueOrThrow({
    where: { id: state.lesson.lesson.id },
  });
  assert.equal(old.rate_at_start_snapshot.toString(), '200');
});
test('unknown payout reserves the obligation until reconciliation and cannot be blindly confirmed', async () => {
  const fixture = await lessonFixture(
    pool,
    { enrollment: { id: state.sub.enrollment_id } },
    QA.director,
  );
  const accrued = good(
    await call('accruals', {
      body: {
        outcomeId: fixture.outcome.id,
        basis: 'Synthetic manual decision',
        exceptionAmount: '200',
      },
    }),
  );
  const pending = good(
    await call('payouts/attempt', {
      actor: 'manager',
      body: {
        obligationId: accrued.obligationId,
        amount: '200',
        provider: 'synthetic',
        providerRequestId: randomUUID(),
      },
    }),
  );
  await client.payoutAttempt.update({ where: { id: pending.id }, data: { status: 'UNKNOWN' } });
  assert.equal(
    (
      await call('payouts/attempt', {
        actor: 'manager',
        body: {
          obligationId: accrued.obligationId,
          amount: '200',
          provider: 'synthetic',
          providerRequestId: randomUUID(),
        },
      })
    ).body.code,
    'PAYOUT_RECONCILIATION_REQUIRED',
  );
  assert.equal(
    (
      await call(`payouts/${pending.id}/confirm`, {
        actor: 'manager',
        body: { providerConfirmationId: randomUUID() },
      })
    ).status,
    409,
  );
  assert.equal(await client.confirmedPayout.count({ where: { attempt_id: pending.id } }), 0);
});
test('failure of mandatory audit rolls back confirmation, posting, task and idempotency result', async () => {
  const payment = await receipt('5'),
    key = randomUUID(),
    audit = app.get(AuditService),
    original = audit.record;
  audit.record = async () => fail(domainError('AUDIT_UNAVAILABLE', 503));
  try {
    assert.equal((await call(`payments/${payment.id}/confirm`, { key })).status, 503);
  } finally {
    audit.record = original;
  }
  assert.equal(
    (await client.paymentReceipt.findUniqueOrThrow({ where: { id: payment.id } }))
      .confirmed_by_director_at,
    null,
  );
  assert.equal(await client.ledgerDocument.count({ where: { payment_id: payment.id } }), 0);
  assert.equal(
    await client.crmTask.count({ where: { idempotency_key: `payment-confirmed:${payment.id}` } }),
    0,
  );
  assert.equal(await client.idempotencyRecord.count({ where: { key } }), 0);
  assert.equal(await client.outboxEvent.count({ where: { source_operation_id: key } }), 0);
  good(await call(`payments/${payment.id}/confirm`, { key }));
});
test('worker lifecycle processes due permissions without an HTTP request or manual handler invocation', async () => {
  const sub = await subscription();
  const expires = new Date(
    +(await client.$queryRaw`SELECT clock_timestamp() AS now`)[0].now + 1000,
  ).toISOString();
  const permission = good(
    await call('temporary-access', {
      body: {
        subscriptionId: sub.id,
        grantedLessonsCount: 1,
        expiresAt: expires,
        basis: 'Synthetic worker scheduling decision',
      },
    }),
  );
  const { WorkerModule } = await import('../../../worker/dist/worker.module.js');
  const worker = await NestFactory.createApplicationContext(WorkerModule, {
    logger: false,
    abortOnError: false,
  });
  try {
    for (
      let i = 0;
      i < 30 &&
      !(await client.crmTask.count({
        where: { idempotency_key: `temporary-access-expired:${permission.id}` },
      }));
      i++
    )
      await delay(200);
    assert.equal(
      await client.crmTask.count({
        where: { idempotency_key: `temporary-access-expired:${permission.id}` },
      }),
      1,
    );
  } finally {
    await worker.close();
  }
});
test('cache replay does not bypass a revoked manager assignment', async () => {
  const request = await call('payments/register', {
    actor: 'manager',
    body: { studentId: QA.students[0], amount: '1', currency: 'MDL' },
  });
  good(request);
  await client.$executeRaw`UPDATE assigned_managers SET ended_at=clock_timestamp() WHERE manager_id=${QA.managers[0]}::uuid AND student_id=${QA.students[0]}::uuid AND ended_at IS NULL`;
  assert.equal(
    (
      await call('payments/register', {
        actor: 'manager',
        key: request.key,
        body: { studentId: QA.students[0], amount: '1', currency: 'MDL' },
      })
    ).status,
    403,
  );
});
