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
  state.seedPeriod = await client.financialPeriod.findFirstOrThrow({ where: { closed_at: null } });
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
const summary = (query = '') => send('GET', `director/payroll/summary${query}`, 'director');
const unresolved = (query = '') => send('GET', `director/finance/unresolved${query}`, 'director');

test('only the director reads payroll; an empty school owes nothing', async () => {
  for (const actor of ['manager', 'teacher']) {
    for (const path of [
      'payroll/summary',
      `payroll/teachers/${QA.teachers[0]}`,
      'finance/unresolved',
      'periods',
    ])
      assert.equal(
        (await send('GET', 'director/' + path, actor)).status,
        403,
        `${path} as ${actor}`,
      );
    assert.equal((await send('POST', 'director/periods', actor, {})).status, 403);
  }
  assert.equal((await fetch(base + '/api/v1/director/payroll/summary')).status, 401);
  const empty = await summary();
  assert.equal(empty.status, 200, JSON.stringify(empty.body));
  assert.deepEqual(empty.body.totals, []);
  assert.deepEqual(empty.body.teachers, []);
  assert.equal((await summary('?periodId=nope')).status, 422);
  assert.equal((await summary(`?periodId=${randomUUID()}`)).status, 404);
  assert.equal(
    (await send('GET', `director/payroll/teachers/${randomUUID()}`, 'director')).status,
    404,
  );
  const open = await unresolved();
  assert.equal(open.status, 200, JSON.stringify(open.body));
  assert.equal(open.body.counts.UNACCRUED_LESSON, 1, 'the conducted QA lesson has no accrual yet');
  assert.equal(open.body.items[0].kind, 'UNACCRUED_LESSON');
  assert.equal(open.body.items[0].id, qaId('lesson-conducted'));
  assert.ok(open.body.items[0].teacherName && open.body.items[0].studentName);
});

test('accrual and payout move the owed amount; open payouts are listed as blockers', async () => {
  const accrued = await send('POST', 'accruals', 'director', {
    outcomeId: qaId('outcome-001'),
    basis: 'Payroll overview test accrual',
  });
  assert.equal(accrued.status, 200, JSON.stringify(accrued.body));
  state.obligation = accrued.body.obligationId;
  assert.equal((await unresolved()).body.counts.UNACCRUED_LESSON, 0);

  const after1 = await summary();
  assert.deepEqual(after1.body.totals, [
    { currency: 'MDL', accrued: '200.0000', paid: '0.0000', outstanding: '200.0000' },
  ]);
  assert.equal(after1.body.teachers[0].teacherId, QA.teachers[0]);
  assert.equal(after1.body.teachers[0].openAttempts, 0);

  const attempt = await send('POST', 'payouts/attempt', 'director', {
    obligationId: state.obligation,
    amount: '80.0000',
    provider: 'qa-bank',
    providerRequestId: 'qa-request-1',
  });
  assert.equal(attempt.status, 200, JSON.stringify(attempt.body));
  const waiting = await unresolved();
  assert.equal(waiting.body.counts.OPEN_PAYOUT_ATTEMPT, 1);
  const item = waiting.body.items.find((i) => i.kind === 'OPEN_PAYOUT_ATTEMPT');
  assert.equal(item.id, attempt.body.id);
  assert.equal(item.amount, '80.0000');
  assert.equal((await summary()).body.teachers[0].openAttempts, 1);
  const blocked = (await send('GET', 'director/periods', 'director')).body.items.find(
    (p) => p.id === state.seedPeriod.id,
  );
  assert.ok(blocked.blockers >= 1);
  assert.equal(blocked.readyToClose, false);

  const confirmed = await send('POST', `payouts/${attempt.body.id}/confirm`, 'director', {
    providerConfirmationId: 'qa-confirmation-1',
  });
  assert.equal(confirmed.status, 200, JSON.stringify(confirmed.body));
  const paid = await summary();
  assert.deepEqual(paid.body.totals, [
    { currency: 'MDL', accrued: '200.0000', paid: '80.0000', outstanding: '120.0000' },
  ]);
  assert.equal(paid.body.teachers[0].openAttempts, 0);
  assert.equal((await unresolved()).body.counts.OPEN_PAYOUT_ATTEMPT, 0);
  const scoped = await summary(`?periodId=${state.seedPeriod.id}`);
  assert.equal(scoped.body.totals[0].accrued, '200.0000');

  const card = await send('GET', `director/payroll/teachers/${QA.teachers[0]}`, 'director');
  assert.equal(card.status, 200, JSON.stringify(card.body));
  assert.equal(card.body.obligations.length, 1);
  const o = card.body.obligations[0];
  assert.equal(o.obligationId, state.obligation);
  assert.equal(o.lessonId, qaId('lesson-conducted'));
  assert.equal(o.paid, '80.0000');
  assert.equal(o.outstanding, '120.0000');
  assert.equal(o.exception, false);
  assert.equal(o.openAttempts, 0);
  assert.equal(card.body.totals[0].outstanding, '120.0000');
});

test('periods are opened and closed by the director only when nothing blocks them', async () => {
  const create = (startsAt, endsAt, actor = 'director') =>
    send('POST', 'director/periods', actor, { startsAt, endsAt });
  const made = await create('2026-01-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z');
  assert.equal(made.status, 201, JSON.stringify(made.body));
  assert.equal(made.body.finished, true);
  assert.equal(made.body.closedAt, null);
  assert.equal(made.body.readyToClose, true);
  state.past = made.body;
  assert.equal(
    (await create('2026-01-15T00:00:00.000Z', '2026-02-10T00:00:00.000Z')).body.code,
    'PERIOD_OVERLAP',
  );
  assert.equal(
    (await create('2026-03-01T00:00:00.000Z', '2026-03-01T06:00:00.000Z')).body.code,
    'INVALID_PERIOD',
  );
  assert.equal(
    (await create('2026-03-01T00:00:00.000Z', '2026-06-01T00:00:00.000Z')).body.code,
    'INVALID_PERIOD',
  );
  assert.equal((await create('soon', 'later')).status, 422);
  assert.equal(
    (await create('2026-03-01T00:00:00.000Z', '2026-04-01T00:00:00.000Z', 'manager')).status,
    403,
  );

  const list = await send('GET', 'director/periods', 'director');
  assert.equal(list.status, 200, JSON.stringify(list.body));
  const row = list.body.items.find((p) => p.id === state.past.id);
  assert.deepEqual(
    { blockers: row.blockers, readyToClose: row.readyToClose, finished: row.finished },
    { blockers: 0, readyToClose: true, finished: true },
  );

  const close = (id, actor = 'director') => send('POST', `director/periods/${id}/close`, actor, {});
  assert.equal((await close(state.past.id, 'manager')).status, 403);
  assert.equal((await close(randomUUID())).status, 404);
  assert.equal((await close(state.seedPeriod.id)).body.code, 'PERIOD_NOT_FINISHED');

  // A finished period with an unresolved fact cannot be closed; the registry names the fact.
  const blocked = await create('2026-03-01T00:00:00.000Z', '2026-04-01T00:00:00.000Z');
  assert.equal(blocked.status, 201, JSON.stringify(blocked.body));
  const model = await client.lessonOccurrence.findUniqueOrThrow({
    where: { id: qaId('lesson-cancelled') },
  });
  const { id: _id, source_operation_id: _op, ...copy } = model;
  const disputed = await client.lessonOccurrence.create({
    data: {
      ...copy,
      source_operation_id: randomUUID(),
      status: 'DISPUTED',
      original_scheduled_at: new Date('2026-03-10T12:00:00Z'),
      occurrence_date: new Date('2026-03-10T00:00:00Z'),
      scheduled_at: new Date('2026-03-10T12:00:00Z'),
      scheduled_end_at: new Date('2026-03-10T13:00:00Z'),
    },
  });
  const registry = await unresolved(`?periodId=${blocked.body.id}`);
  assert.equal(registry.status, 200, JSON.stringify(registry.body));
  assert.equal(registry.body.counts.DISPUTED_LESSON, 1);
  assert.equal(registry.body.items[0].id, disputed.id);
  const row2 = (await send('GET', 'director/periods', 'director')).body.items.find(
    (p) => p.id === blocked.body.id,
  );
  assert.deepEqual(
    { blockers: row2.blockers, readyToClose: row2.readyToClose },
    { blockers: 1, readyToClose: false },
  );
  assert.equal((await close(blocked.body.id)).body.code, 'PERIOD_HAS_UNRESOLVED_FACTS');
  const closed = await close(state.past.id);
  assert.equal(closed.status, 200, JSON.stringify(closed.body));
  assert.ok(closed.body.closedAt);
  assert.equal(closed.body.readyToClose, false);
  assert.equal((await close(state.past.id)).body.code, 'PERIOD_ALREADY_CLOSED');
  assert.equal(
    (await create('2026-01-10T00:00:00.000Z', '2026-01-20T00:00:00.000Z')).body.code,
    'PERIOD_OVERLAP',
  );
  const after = (await send('GET', 'director/periods', 'director')).body.items.find(
    (p) => p.id === state.past.id,
  );
  assert.equal(after.closedAt, closed.body.closedAt);
  assert.equal(after.blockers, 0);
});
