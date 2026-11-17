import 'reflect-metadata';
import { http as fetch } from '../../../../tests/support/http.mjs';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';
import { before, after, test } from '../../../../tests/support/test-harness.mjs';
import pg from '../../../../packages/db/node_modules/pg/lib/index.js';
import { NestFactory } from '@nestjs/core';
import { createDirectClient } from '@online-school/db';
import { AppModule } from '../../dist/app.module.js';
import { SessionStore } from '../../dist/core/session/session.store.js';
import { QA, qaId, seedQA } from '../../../../packages/db/dist-tools/seed.js';

const url = process.env.TEACHER_TEST_DATABASE_URL;
assert.ok(url);
const target = new URL(url);
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(target.hostname));
assert.match(target.pathname, /^\/online_school_test[a-z0-9_]*$/);
const client = createDirectClient({ DIRECT_URL: url }).value,
  pool = new pg.Pool({ connectionString: url });
const actors = {},
  state = {};
let app, base;
const DAY = 86_400_000;

before(async () => {
  assert.equal((await seedQA(client)).ok, true);
  await pool.query(
    "DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='task09_runtime') THEN CREATE ROLE task09_runtime LOGIN INHERIT; END IF; END $$",
  );
  await pool.query('GRANT online_school_runtime TO task09_runtime');
  const runtime = new URL(url);
  runtime.username = 'task09_runtime';
  runtime.password = '';
  process.env.DATABASE_URL = runtime.toString();
  process.env.CSRF_SIGNING_SECRET = randomBytes(48).toString('base64url');
  app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
  await app.listen(0, '127.0.0.1');
  base = await app.getUrl();
  const store = app.get(SessionStore);
  for (const [name, label] of [
    ['director', 'seed-director-001'],
    ['manager', 'seed-manager-001'],
    ['teacher', 'seed-teacher-001'],
  ]) {
    const accountId = qaId(label + '/auth');
    actors[name] = await client.$transaction(async (tx) =>
      store.issue(tx, accountId, (await tx.$queryRaw`SELECT clock_timestamp() AS now`)[0].now),
    );
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

const headers = (actor) => {
  const s = actors[actor];
  return { cookie: `__Host-school_session=${s.token}; __Host-school_csrf=${s.csrfToken}` };
};
async function send(method, path, actor, body) {
  const read = method === 'GET';
  const r = await fetch(base + '/api/v1/' + path, {
    method,
    headers: {
      ...headers(actor),
      ...(read
        ? {}
        : {
            'content-type': 'application/json',
            'idempotency-key': randomUUID(),
            'x-csrf-token': actors[actor].csrfToken,
          }),
    },
    ...(read ? {} : { body: JSON.stringify(body ?? {}) }),
  });
  return { status: r.status, body: await r.json() };
}
const decisions = (query = '', actor = 'director') =>
  send('GET', 'director/decisions' + query, actor);
const kinds = (r) => r.body.items.map((i) => `${i.kind}`);

test('only the director may use the cabinet; the profile carries counters', async () => {
  for (const actor of ['manager', 'teacher']) {
    for (const path of ['me', 'decisions', 'decisions/summary']) {
      const r = await send('GET', 'director/' + path, actor);
      assert.equal(r.status, 403, `${path} as ${actor}`);
      assert.equal(r.body.code, 'FORBIDDEN_ROLE');
    }
  }
  assert.equal((await fetch(base + '/api/v1/director/me')).status, 401);
  const me = await send('GET', 'director/me', 'director');
  assert.equal(me.status, 200, JSON.stringify(me.body));
  assert.equal(me.body.role, 'DIRECTOR');
  assert.equal(me.body.actorContext.role, 'DIRECTOR');
  assert.deepEqual(me.body.pending, {
    payment: 0,
    distribution: 0,
    scheduleException: 0,
    dispute: 0,
    temporaryAccess: 0,
    refundRequest: 0,
    total: 0,
  });
});

test('a manager payment request and its allocation reach the director queue and leave it once decided', async () => {
  const plan = await client.saleCondition.findFirstOrThrow({ orderBy: { created_at: 'asc' } });
  const enrollment = (
    await client.teachingAssignment.findFirstOrThrow({ where: { teacher_id: QA.teachers[0] } })
  ).enrollment_id;
  const created = await send('POST', `manager/students/${QA.students[0]}/payments`, 'manager', {
    amount: plan.price.toFixed(4),
    currency: plan.currency,
    method: 'CASH',
    purpose: 'RENEWAL',
    receivedAt: new Date(Date.now() - DAY).toISOString(),
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  state.payment = created.body.id;
  // Registered but not yet submitted: nothing to decide.
  assert.equal((await decisions()).body.items.length, 0);

  const submitted = await send('POST', `manager/payments/${state.payment}/confirm`, 'manager', {});
  assert.equal(submitted.status, 200, JSON.stringify(submitted.body));
  const queue = await decisions();
  assert.deepEqual(kinds(queue), ['PAYMENT']);
  const payment = queue.body.items[0];
  assert.equal(payment.id, state.payment);
  assert.equal(payment.ready, true);
  assert.equal(payment.amount, plan.price.toFixed(4));
  assert.equal(payment.studentId, QA.students[0]);
  assert.ok(payment.requestedBy && payment.studentName);

  const prepared = await send(
    'POST',
    `manager/payments/${state.payment}/prepare-subscription`,
    'manager',
    {
      enrollmentId: enrollment,
      planId: plan.id,
      amount: plan.price.toFixed(4),
    },
  );
  assert.equal(prepared.status, 201, JSON.stringify(prepared.body));
  const both = await decisions();
  assert.deepEqual(kinds(both).sort(), ['DISTRIBUTION', 'PAYMENT']);
  const distribution = both.body.items.find((i) => i.kind === 'DISTRIBUTION');
  assert.equal(distribution.ready, false);
  assert.equal(distribution.blockedBy, 'PAYMENT_NOT_CONFIRMED');

  const detail = await send('GET', `director/decisions/PAYMENT/${state.payment}`, 'director');
  assert.equal(detail.status, 200, JSON.stringify(detail.body));
  assert.equal(detail.body.facts.method, 'CASH');
  assert.equal(detail.body.facts.proposedDistributions, 1);
  assert.equal(detail.body.commands[0].operationId, 'confirmPayment');
  const summary = await send('GET', 'director/decisions/summary', 'director');
  assert.deepEqual(summary.body, {
    payment: 1,
    distribution: 1,
    scheduleException: 0,
    dispute: 0,
    temporaryAccess: 0,
    refundRequest: 0,
    total: 2,
  });

  // Deciding with the existing commands removes the items from the queue.
  const confirmed = await send(
    'POST',
    `director/payments/${state.payment}/confirm`,
    'director',
    {},
  );
  assert.equal(confirmed.status, 200, JSON.stringify(confirmed.body));
  assert.equal(confirmed.body.kind, 'PAYMENT');
  assert.equal(confirmed.body.outcome, 'CONFIRMED');
  assert.equal(confirmed.body.id, state.payment);
  const afterConfirm = await decisions();
  assert.deepEqual(kinds(afterConfirm), ['DISTRIBUTION']);
  assert.equal(afterConfirm.body.items[0].ready, true);
  const approved = await send(
    'POST',
    `director/distributions/${distribution.id}/approve`,
    'director',
    {},
  );
  assert.equal(approved.status, 200, JSON.stringify(approved.body));
  assert.equal(approved.body.outcome, 'APPROVED');
  assert.equal((await decisions()).body.items.length, 0);
  assert.equal(
    (await send('GET', `director/decisions/PAYMENT/${state.payment}`, 'director')).status,
    404,
  );
});

test('schedule exceptions and escalated disputes are listed with their readiness', async () => {
  const day = new Date(Date.now() + 10 * DAY);
  day.setUTCHours(0, 0, 0, 0);
  const iso = (ms) => new Date(ms).toISOString();
  const availability = await send('POST', 'teacher-availability', 'teacher', {
    startsAt: iso(+day),
    endsAt: iso(+day + 8 * 3_600_000),
    timezone: 'Europe/Chisinau',
  });
  assert.equal(availability.status, 200, JSON.stringify(availability.body));
  const lesson = await send('POST', 'lessons', 'director', {
    teachingAssignmentId: qaId('teaching-001'),
    startsAt: iso(+day + 3_600_000),
    endsAt: iso(+day + 2 * 3_600_000),
    basis: 'Director queue schedule target',
  });
  assert.equal(lesson.status, 200, JSON.stringify(lesson.body));
  const row = await client.lessonOccurrence.findUniqueOrThrow({ where: { id: lesson.body.id } });
  const payload = {
    action: 'RESCHEDULE',
    initiator: 'STUDENT',
    reason: 'Third change this month',
    startsAt: iso(+day + 5 * 3_600_000),
    oldStartsAt: row.scheduled_at.toISOString(),
  };
  const approval = await client.scheduleChangeApproval.create({
    data: {
      lesson_id: row.id,
      lesson_version: row.version,
      request_hash: createHash('sha256').update(JSON.stringify(payload)).digest('hex'),
      payload,
      requested_by_id: QA.managers[0],
      source_operation_id: randomUUID(),
    },
  });
  // The deduction/30-day guard is bypassed for this fixture only (superuser, replica role).
  const dispute = { id: randomUUID() };
  const db = await pool.connect();
  try {
    await db.query('SET session_replication_role = replica');
    await db.query(
      `INSERT INTO crm_tasks (id, student_id, assigned_manager_id, type, status, title, due_at, lesson_id, escalated_at, decision, payload, version)
       VALUES ($1, $2, $3, 'ATTENDANCE_DISPUTE', 'IN_PROGRESS', 'Disputed charge', now(), $4, now() - interval '1 second', $5::jsonb, $6::jsonb, 1)`,
      [
        dispute.id,
        QA.students[0],
        QA.managers[0],
        qaId('lesson-conducted'),
        JSON.stringify({
          kind: 'DISPUTE',
          decision: 'ACCEPT',
          mode: 'MANUAL_REVIEW',
          reason: 'Partial refund asked',
        }),
        JSON.stringify({ description: 'The lesson was charged twice by mistake' }),
      ],
    );
  } finally {
    await db.query('RESET session_replication_role');
    db.release();
  }

  const queue = await decisions();
  assert.deepEqual(kinds(queue).sort(), ['DISPUTE', 'SCHEDULE_EXCEPTION']);
  const schedule = queue.body.items.find((i) => i.kind === 'SCHEDULE_EXCEPTION');
  assert.equal(schedule.id, approval.id);
  assert.equal(schedule.ready, true);
  const disputeItem = queue.body.items.find((i) => i.kind === 'DISPUTE');
  assert.equal(disputeItem.ready, false);
  assert.equal(disputeItem.blockedBy, 'MANUAL_FINANCE_REVIEW');
  assert.equal((await decisions('?kind=DISPUTE')).body.items.length, 1);

  const detail = await send(
    'GET',
    `director/decisions/SCHEDULE_EXCEPTION/${approval.id}`,
    'director',
  );
  assert.equal(detail.status, 200, JSON.stringify(detail.body));
  assert.equal(detail.body.facts.action, 'RESCHEDULE');
  assert.equal(detail.body.facts.reason, 'Third change this month');
  assert.equal(detail.body.commands[0].operationId, 'approveScheduleChange');
  const disputeDetail = await send('GET', `director/decisions/DISPUTE/${dispute.id}`, 'director');
  assert.equal(disputeDetail.body.facts.mode, 'MANUAL_REVIEW');

  // A changed lesson makes the approval stale and not executable.
  await client.$executeRaw`UPDATE lesson_occurrences SET version = version + 1 WHERE id = ${row.id}::uuid`;
  const stale = (await decisions('?kind=SCHEDULE_EXCEPTION')).body.items[0];
  assert.equal(stale.ready, false);
  assert.equal(stale.blockedBy, 'STALE');
  const refused = await send(
    'POST',
    `director/schedule-exceptions/${approval.id}/approve`,
    'director',
    {},
  );
  assert.equal(refused.status >= 400 && refused.status < 500, true, JSON.stringify(refused.body));
  assert.equal((await decisions('?kind=SCHEDULE_EXCEPTION')).body.items.length, 1);

  // A fresh request for the current lesson version is approved through the facade and leaves the queue.
  const current = await client.lessonOccurrence.findUniqueOrThrow({ where: { id: row.id } });
  const fresh = { ...payload, reason: 'Fresh request' };
  const freshApproval = await client.scheduleChangeApproval.create({
    data: {
      lesson_id: current.id,
      lesson_version: current.version,
      request_hash: createHash('sha256').update(JSON.stringify(fresh)).digest('hex'),
      payload: fresh,
      requested_by_id: QA.managers[0],
      source_operation_id: randomUUID(),
    },
  });
  assert.equal((await decisions('?kind=SCHEDULE_EXCEPTION')).body.items.length, 2);
  const manager = await send(
    'POST',
    `director/schedule-exceptions/${freshApproval.id}/approve`,
    'manager',
    {},
  );
  assert.equal(manager.status, 403);
  const decided = await send(
    'POST',
    `director/schedule-exceptions/${freshApproval.id}/approve`,
    'director',
    {},
  );
  assert.equal(decided.status, 200, JSON.stringify(decided.body));
  assert.equal(decided.body.kind, 'SCHEDULE_EXCEPTION');
  assert.equal(decided.body.outcome, 'APPROVED');
  const left = (await decisions('?kind=SCHEDULE_EXCEPTION')).body.items;
  assert.deepEqual(
    left.map((i) => i.id),
    [approval.id],
  );

  // A manual-review dispute cannot be executed by the director command.
  const manual = await send('POST', `director/disputes/${dispute.id}/approve`, 'director', {
    version: 1,
  });
  assert.equal(manual.status, 409, JSON.stringify(manual.body));
  assert.equal(manual.body.code, 'DISPUTE_SOURCE_UNAVAILABLE');
  assert.equal(
    (await send('POST', `director/disputes/${dispute.id}/approve`, 'director', {})).status,
    422,
  );
  assert.equal(
    (await send('POST', `director/disputes/${randomUUID()}/approve`, 'director', { version: 1 }))
      .status,
    404,
  );
});

test('paging is stable oldest first; input is validated', async () => {
  const all = await decisions('?limit=50');
  const times = all.body.items.map((i) => i.requestedAt);
  assert.deepEqual(times, [...times].sort());
  assert.equal(all.body.items.length, 2);
  const first = await decisions('?limit=1');
  assert.ok(first.body.nextCursor);
  const second = await decisions('?limit=1&cursor=' + first.body.nextCursor);
  assert.deepEqual(
    [...first.body.items, ...second.body.items].map((i) => i.id),
    all.body.items.map((i) => i.id),
  );
  assert.equal(second.body.nextCursor, null);
  for (const query of ['?kind=NOPE', '?limit=0', '?cursor=@@@', '?x=1'])
    assert.equal((await decisions(query)).status, 422, query);
  assert.equal(
    (await send('GET', 'director/decisions/NOPE/' + randomUUID(), 'director')).status,
    404,
  );
  assert.equal(
    (await send('GET', 'director/decisions/PAYMENT/not-a-uuid', 'director')).status,
    404,
  );
  const counts = (await send('GET', 'director/decisions/summary', 'director')).body;
  assert.equal(counts.total, all.body.items.length);
  assert.equal((await send('GET', 'director/me', 'director')).body.pending.total, counts.total);
});

test('a pending payment can be rejected with a reason and then leaves the queue', async () => {
  const created = await send('POST', `manager/students/${QA.students[0]}/payments`, 'manager', {
    amount: '100.0000',
    currency: 'MDL',
    method: 'CARD',
    purpose: 'OTHER',
    receivedAt: new Date(Date.now() - DAY).toISOString(),
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const submitted = await send(
    'POST',
    `manager/payments/${created.body.id}/confirm`,
    'manager',
    {},
  );
  assert.equal(submitted.status, 200, JSON.stringify(submitted.body));
  assert.ok((await decisions('?kind=PAYMENT')).body.items.some((i) => i.id === created.body.id));

  const reject = (body, actor = 'director') =>
    send('POST', `director/payments/${created.body.id}/reject`, actor, body);
  assert.equal((await reject({ reason: 'x' })).status, 422);
  assert.equal((await reject({ reason: 'Wrong amount on the receipt', extra: 1 })).status, 422);
  assert.equal((await reject({ reason: 'Wrong amount on the receipt' }, 'manager')).status, 403);
  const rejected = await reject({ reason: 'Wrong amount on the receipt' });
  assert.equal(rejected.status, 200, JSON.stringify(rejected.body));
  assert.equal(rejected.body.outcome, 'REJECTED');
  assert.equal(
    (await decisions('?kind=PAYMENT')).body.items.some((i) => i.id === created.body.id),
    false,
  );
  const stored = await client.paymentReceipt.findUniqueOrThrow({ where: { id: created.body.id } });
  assert.ok(stored.rejected_at);
  assert.equal(stored.rejection_reason, 'Wrong amount on the receipt');
  // A rejected receipt cannot be confirmed afterwards.
  const late = await send('POST', `director/payments/${created.body.id}/confirm`, 'director', {});
  assert.equal(late.status, 409, JSON.stringify(late.body));
  assert.equal((await reject({ reason: 'Rejecting twice should fail' })).status, 409);
});
