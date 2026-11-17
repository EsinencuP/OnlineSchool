import 'reflect-metadata';
import { http as fetch } from '../../../../tests/support/http.mjs';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
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
const iso = (ms) => new Date(ms).toISOString();

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
  const paid = await client.subscription.findUniqueOrThrow({ where: { id: QA.subscription } });
  state.paid = paid;
  // A second subscription with nothing confirmed yet: the partial-payment case.
  state.open = await client.subscription.create({
    data: {
      source_operation_id: randomUUID(),
      enrollment_id: paid.enrollment_id,
      sale_condition_id: paid.sale_condition_id,
      lesson_count: 2,
      full_price: paid.full_price,
      initial_discount_amount: paid.initial_discount_amount,
      original_paid_unit_price: paid.original_paid_unit_price,
      currency: paid.currency,
      valid_from: paid.valid_from,
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
const ask = (body, studentId = QA.students[0]) =>
  send('POST', `manager/students/${studentId}/requests`, 'manager', body);
const temp = (extra = {}) => ({
  kind: 'TEMPORARY_ACCESS',
  subscriptionId: state.open.id,
  reason: 'Family pays the rest on the 25th',
  ...extra,
});
const refund = (extra = {}) => ({
  kind: 'REFUND',
  subscriptionId: state.paid.id,
  reason: 'Family moves abroad, asks for unused lessons',
  ...extra,
});
const inbox = (kind) => send('GET', `director/decisions${kind ? `?kind=${kind}` : ''}`, 'director');

test('only a manager asks; the subscription must belong to the student and fit the kind', async () => {
  for (const actor of ['director', 'teacher']) {
    assert.equal((await send('GET', 'manager/requests', actor)).status, 403);
    assert.equal(
      (await send('POST', `manager/students/${QA.students[0]}/requests`, actor, temp())).status,
      403,
    );
  }
  assert.equal((await fetch(base + '/api/v1/manager/requests')).status, 401);
  const foreign = await ask(temp(), QA.students[2]);
  assert.equal(foreign.status, 404);
  assert.equal(foreign.body.code, 'STUDENT_NOT_FOUND');
  const other = await ask(temp({ subscriptionId: randomUUID() }));
  assert.equal(other.body.code, 'SUBSCRIPTION_NOT_FOUND');
  assert.equal(
    (await ask(temp({ subscriptionId: state.paid.id }))).body.code,
    'FULLY_PAID_USES_NORMAL_ACCESS',
  );
  assert.equal(
    (await ask(refund({ subscriptionId: state.open.id }))).body.code,
    'NOTHING_TO_REFUND',
  );
  assert.equal((await ask(refund({ proposedLessons: 2 }))).status, 422);
  assert.equal(
    (await ask(temp({ proposedUntil: iso(Date.now() - DAY) }))).body.code,
    'INVALID_ACCESS_EXPIRY',
  );
  assert.equal((await ask({ ...temp(), kind: 'GIFT' })).status, 422);
  assert.equal((await ask({ ...temp(), reason: 'no' })).status, 422);
  assert.equal((await ask({ ...temp(), extra: 1 })).status, 422);
});

test('requests reach the director inbox with facts and leave it when withdrawn', async () => {
  const t = await ask(temp({ proposedLessons: 2, proposedUntil: iso(Date.now() + 7 * DAY) }));
  assert.equal(t.status, 201, JSON.stringify(t.body));
  assert.equal(t.body.status, 'PENDING');
  assert.equal(t.body.proposedLessons, 2);
  state.temp = t.body;
  assert.equal((await ask(temp())).body.code, 'REQUEST_ALREADY_PENDING');
  const r = await ask(refund());
  assert.equal(r.status, 201, JSON.stringify(r.body));
  state.refund = r.body;

  const list = await inbox();
  assert.equal(list.status, 200, JSON.stringify(list.body));
  const kinds = list.body.items.map((i) => i.kind).sort();
  assert.deepEqual(kinds, ['REFUND_REQUEST', 'TEMPORARY_ACCESS']);
  const t1 = list.body.items.find((i) => i.kind === 'TEMPORARY_ACCESS');
  assert.equal(t1.id, state.temp.requestId);
  assert.equal(t1.amount, '100.0000', 'shortfall to the full price');
  assert.equal(t1.ready, true);
  assert.equal(t1.studentId, QA.students[0]);
  assert.ok(t1.requestedBy);
  const r1 = list.body.items.find((i) => i.kind === 'REFUND_REQUEST');
  assert.equal(r1.amount, '100.0000', 'confirmed amount paid');

  const detail = await send(
    'GET',
    `director/decisions/TEMPORARY_ACCESS/${state.temp.requestId}`,
    'director',
  );
  assert.equal(detail.status, 200, JSON.stringify(detail.body));
  assert.equal(detail.body.facts.confirmedPaid, '0.0000');
  assert.equal(detail.body.facts.shortfall, '100.0000');
  assert.equal(detail.body.facts.proposedLessons, 2);
  assert.deepEqual(
    detail.body.commands.map((c) => c.operationId),
    ['directorApproveRequest', 'directorDeclineRequest'],
  );
  const summary = await send('GET', 'director/decisions/summary', 'director');
  assert.equal(summary.body.temporaryAccess, 1);
  assert.equal(summary.body.refundRequest, 1);
  assert.equal(summary.body.total, 2);

  const mine = await send('GET', 'manager/requests?status=PENDING', 'manager');
  assert.equal(mine.body.items.length, 2);
  assert.equal(
    (await send('GET', `manager/requests?studentId=${QA.students[2]}`, 'manager')).status,
    404,
  );

  const path = `manager/requests/${state.refund.requestId}/withdraw`;
  assert.equal(
    (await send('POST', `manager/requests/${randomUUID()}/withdraw`, 'manager', {})).status,
    404,
  );
  const withdrawn = await send('POST', path, 'manager', { note: 'Family changed their mind' });
  assert.equal(withdrawn.status, 200, JSON.stringify(withdrawn.body));
  assert.equal(withdrawn.body.status, 'WITHDRAWN');
  assert.equal((await send('POST', path, 'manager', {})).body.code, 'REQUEST_NOT_PENDING');
  assert.deepEqual((await inbox('REFUND_REQUEST')).body.items, []);
  const late = await send(
    'POST',
    `director/requests/${state.refund.requestId}/approve`,
    'director',
    {},
  );
  assert.equal(late.status, 409);
  assert.equal(late.body.code, 'REQUEST_NOT_PENDING');
});

test('the director grants limited temporary access, declines, or accepts a refund for calculation', async () => {
  const approve = (id, actor, body = {}) =>
    send('POST', `director/requests/${id}/approve`, actor, body);
  for (const actor of ['manager', 'teacher'])
    assert.equal((await approve(state.temp.requestId, actor)).status, 403);
  assert.equal((await approve(randomUUID(), 'director')).status, 404);
  assert.equal((await approve('nope', 'director')).status, 404);

  const granted = await approve(state.temp.requestId, 'director', {
    maxLessons: 1,
    expiresAt: iso(Date.now() + 3 * DAY),
    note: 'One lesson until the 25th',
  });
  assert.equal(granted.status, 200, JSON.stringify(granted.body));
  assert.equal(granted.body.kind, 'TEMPORARY_ACCESS');
  assert.equal(granted.body.outcome, 'APPROVED');
  const permissionId = granted.body.result.permissionId;
  assert.ok(permissionId);
  const permission = await client.temporaryAccessPermission.findUniqueOrThrow({
    where: { id: permissionId },
  });
  assert.equal(permission.max_lessons, 1, 'the director limit wins over the proposal');
  assert.equal(permission.subscription_id, state.open.id);
  assert.equal(permission.reason, 'One lesson until the 25th');
  assert.equal(
    await client.entitlementGrant.count({ where: { subscription_id: state.open.id } }),
    0,
    'temporary access creates no paid rights',
  );
  assert.equal((await approve(state.temp.requestId, 'director')).body.code, 'REQUEST_NOT_PENDING');
  assert.deepEqual((await inbox('TEMPORARY_ACCESS')).body.items, []);
  const seen = await send('GET', 'manager/requests?status=APPROVED', 'manager');
  assert.equal(seen.body.items[0].permissionId, permissionId);
  assert.equal(seen.body.items[0].decisionNote, 'One lesson until the 25th');

  // Without a proposal the director must give both limits.
  const bare = await ask(temp());
  assert.equal(bare.status, 201, JSON.stringify(bare.body));
  const missing = await approve(bare.body.requestId, 'director');
  assert.equal(missing.status, 422);
  assert.equal(missing.body.code, 'LIMIT_AND_EXPIRY_REQUIRED');
  const declined = await send(
    'POST',
    `director/requests/${bare.body.requestId}/decline`,
    'director',
    {
      reason: 'Pay the instalment first',
    },
  );
  assert.equal(declined.status, 200, JSON.stringify(declined.body));
  assert.equal(declined.body.outcome, 'DECLINED');
  assert.equal(
    (
      await send('POST', `director/requests/${bare.body.requestId}/decline`, 'director', {
        reason: 'again please',
      })
    ).status,
    409,
  );
  assert.equal(
    (await send('POST', `director/requests/${randomUUID()}/decline`, 'director', { reason: 'x' }))
      .status,
    422,
  );
  const sees = await send('GET', 'manager/requests?status=DECLINED', 'manager');
  assert.equal(sees.body.items[0].decisionNote, 'Pay the instalment first');

  // A refund request is accepted for calculation: nothing is posted or refunded.
  const ledgerBefore = await client.ledgerEntry.count();
  const again = await ask(refund());
  assert.equal(again.status, 201, 'a withdrawn request does not block a new one');
  assert.equal(
    (await approve(again.body.requestId, 'director', { maxLessons: 1 })).status,
    422,
    'limits belong to temporary access only',
  );
  const accepted = await approve(again.body.requestId, 'director', {
    note: 'Prepare the calculation',
  });
  assert.equal(accepted.status, 200, JSON.stringify(accepted.body));
  assert.equal(accepted.body.kind, 'REFUND_REQUEST');
  assert.equal(accepted.body.result.status, 'APPROVED');
  assert.equal(await client.ledgerEntry.count(), ledgerBefore);
  assert.equal(await client.refundRecord.count(), 0);

  // Decided requests are immutable.
  await assert.rejects(
    client.$executeRaw`UPDATE manager_requests SET reason='tampered text' WHERE id=${again.body.requestId}::uuid`,
  );
  const empty = await send('GET', 'director/decisions/summary', 'director');
  assert.equal(empty.body.total, 0);
});
