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
    ['teacher', 'seed-teacher-001'],
    ['teacher2', 'seed-teacher-002'],
    ['director', 'seed-director-001'],
    ['manager', 'seed-manager-001'],
  ]) {
    const accountId = qaId(label + '/auth');
    actors[name] = await client.$transaction(async (tx) =>
      store.issue(tx, accountId, (await tx.$queryRaw`SELECT clock_timestamp() AS now`)[0].now),
    );
  }
});
after(async () => {
  await app?.close();
  await client.$disconnect();
  await pool.end();
});

async function get(path, actor) {
  const session = actor ? actors[actor] : undefined;
  const r = await fetch(base + '/api/v1/teacher/' + path, {
    headers: session
      ? {
          cookie: `__Host-school_session=${session.token}; __Host-school_csrf=${session.csrfToken}`,
        }
      : {},
  });
  return { status: r.status, body: await r.json() };
}

test('teacher reads own profile; other roles and anonymous callers are denied', async () => {
  const me = await get('me', 'teacher');
  assert.equal(me.status, 200, JSON.stringify(me.body));
  assert.equal(me.body.role, 'TEACHER');
  assert.equal(me.body.teacherId, QA.teachers[0]);
  assert.equal(me.body.actorContext.teacherProfileId, QA.teachers[0]);
  assert.ok(me.body.activeStudentCount >= 1);
  assert.equal((await get('me', 'teacher2')).body.teacherId, QA.teachers[1]);
  for (const actor of ['director', 'manager']) {
    const denied = await get('today', actor);
    assert.equal(denied.status, 403, actor);
    assert.equal(denied.body.code, 'FORBIDDEN_ROLE');
  }
  assert.equal((await get('today')).status, 401);
});

test('today returns only the own lessons of the requested school-timezone day', async () => {
  const conducted = await get('today?date=2026-10-02', 'teacher');
  assert.equal(conducted.status, 200, JSON.stringify(conducted.body));
  assert.equal(conducted.body.date, '2026-10-02');
  assert.equal(conducted.body.timezone, 'Europe/Chisinau');
  assert.equal(conducted.body.lessons.length, 1);
  const lesson = conducted.body.lessons[0];
  assert.equal(lesson.lessonId, qaId('lesson-conducted'));
  assert.equal(lesson.status, 'CONDUCTED');
  assert.equal(lesson.outcomeRecorded, true);
  assert.equal(lesson.studentId, QA.students[0]);
  assert.ok(lesson.studentName && lesson.subjectCode && lesson.subjectName);
  assert.equal(+new Date(lesson.startsAt) - +new Date(lesson.joinOpensAt), 10 * 60_000);
  assert.ok(['PRESENT', 'MISSING'].includes(lesson.meetLinkState));
  assert.equal('meetUrl' in lesson || 'google_meet_link' in lesson, false);

  const scheduled = await get('today?date=2026-11-06', 'teacher');
  assert.equal(scheduled.body.lessons.length, 1);
  assert.equal(scheduled.body.lessons[0].status, 'SCHEDULED');
  assert.equal(scheduled.body.lessons[0].outcomeRecorded, false);

  assert.equal((await get('today?date=2026-10-03', 'teacher')).body.lessons.length, 0);
  // Another teacher never sees these lessons.
  assert.equal((await get('today?date=2026-10-02', 'teacher2')).body.lessons.length, 0);
  assert.equal((await get('today?date=2026-11-06', 'teacher2')).body.lessons.length, 0);
});

test('a lesson near local midnight belongs to the school-timezone day, not the UTC day', async () => {
  // 22:30Z on 2026-10-04 is 01:30 on 2026-10-05 in Europe/Chisinau (UTC+3).
  const lesson = await client.lessonOccurrence.findUniqueOrThrow({
    where: { id: qaId('lesson-scheduled') },
  });
  const id = qaId('teacher-midnight-lesson');
  await client.lessonOccurrence.create({
    data: {
      id,
      enrollment_id: lesson.enrollment_id,
      teaching_assignment_id: lesson.teaching_assignment_id,
      scheduled_teacher_id: lesson.scheduled_teacher_id,
      original_scheduled_at: new Date('2026-10-04T22:30:00Z'),
      scheduled_at: new Date('2026-10-04T22:30:00Z'),
      scheduled_end_at: new Date('2026-10-04T23:30:00Z'),
      source_operation_id: qaId('teacher-midnight-op'),
    },
  });
  const local = await get('today?date=2026-10-05', 'teacher');
  assert.deepEqual(
    local.body.lessons.map((l) => l.lessonId),
    [id],
  );
  assert.equal((await get('today?date=2026-10-04', 'teacher')).body.lessons.length, 0);
});

test('invalid or unknown query input is rejected', async () => {
  for (const query of ['date=2026-13-45', 'date=not-a-date', 'date=2026-10-02&extra=1']) {
    const r = await get('today?' + query, 'teacher');
    assert.equal(r.status, 422, query + JSON.stringify(r.body));
  }
});

async function send(method, path, actor, body) {
  const session = actors[actor];
  const r = await fetch(base + '/api/v1/' + path, {
    method,
    headers: {
      'content-type': 'application/json',
      'idempotency-key': randomUUID(),
      'x-csrf-token': session.csrfToken,
      cookie: `__Host-school_session=${session.token}; __Host-school_csrf=${session.csrfToken}`,
    },
    body: JSON.stringify(body),
  });
  return { status: r.status, body: await r.json() };
}
async function post(path, actor, body) {
  const session = actors[actor];
  const r = await fetch(base + '/api/v1/' + path, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'idempotency-key': randomUUID(),
      'x-csrf-token': session.csrfToken,
      cookie: `__Host-school_session=${session.token}; __Host-school_csrf=${session.csrfToken}`,
    },
    body: JSON.stringify(body),
  });
  return { status: r.status, body: await r.json() };
}

test('journal lists ended own lessons newest first with derived states and stable paging', async () => {
  const all = await get('journal', 'teacher');
  assert.equal(all.status, 200, JSON.stringify(all.body));
  const byId = Object.fromEntries(all.body.items.map((i) => [i.lessonId, i]));
  assert.equal(byId[qaId('lesson-scheduled')].state, 'AWAITING_REPORT');
  assert.equal(byId[qaId('lesson-scheduled')].overdue, true);
  assert.equal(byId[qaId('lesson-cancelled')].state, 'CANCELLED');
  assert.equal(byId[qaId('lesson-conducted')].state, 'CONDUCTED');
  assert.equal(byId[qaId('lesson-conducted')].overdue, false);
  const starts = all.body.items.map((i) => i.startsAt);
  assert.deepEqual(starts, [...starts].sort().reverse());
  assert.equal(all.body.nextCursor, null);

  // Keyset paging: one item per page returns every lesson exactly once.
  const seen = [];
  let cursor;
  for (let n = 0; n < 10; n++) {
    const page = await get('journal?limit=1' + (cursor ? '&cursor=' + cursor : ''), 'teacher');
    assert.equal(page.status, 200, JSON.stringify(page.body));
    seen.push(...page.body.items.map((i) => i.lessonId));
    cursor = page.body.nextCursor;
    if (!cursor) break;
  }
  assert.deepEqual(
    seen,
    all.body.items.map((i) => i.lessonId),
  );

  const filtered = await get('journal?state=CONDUCTED', 'teacher');
  assert.deepEqual(
    filtered.body.items.map((i) => i.lessonId),
    [qaId('lesson-conducted')],
  );
  assert.equal((await get('journal', 'teacher2')).body.items.length, 0);
  for (const query of ['state=NOPE', 'limit=0', 'limit=51', 'cursor=@@@', 'x=1'])
    assert.equal((await get('journal?' + query, 'teacher')).status, 422, query);
  assert.equal((await get('journal', 'manager')).status, 403);
});

test('lesson card is limited to own lessons and exposes the confirmed outcome without pay data', async () => {
  const card = await get('lessons/' + qaId('lesson-conducted'), 'teacher');
  assert.equal(card.status, 200, JSON.stringify(card.body));
  assert.equal(card.body.state, 'CONDUCTED');
  assert.equal(card.body.canReport, false);
  assert.ok(card.body.confirmedOutcome.durationMin > 0);
  assert.equal(JSON.stringify(card.body).includes('rate'), false);
  assert.equal((await get('lessons/' + qaId('lesson-conducted'), 'teacher2')).status, 404);
  assert.equal((await get('lessons/' + randomUUID(), 'teacher')).status, 404);
  assert.equal((await get('lessons/not-a-uuid', 'teacher')).status, 422);
});

test('existing report/confirm commands move a lesson through the journal states', async () => {
  const id = qaId('lesson-scheduled');
  const before = await get('lessons/' + id, 'teacher');
  assert.equal(before.body.state, 'AWAITING_REPORT');
  assert.equal(before.body.canReport, true);
  assert.deepEqual(before.body.reports, []);

  const reported = await post(`lessons/${id}/outcome`, 'teacher', {
    result: 'NOT_CONDUCTED',
    note: 'Student did not connect',
    studentNoShow: true,
  });
  assert.equal(reported.status, 200, JSON.stringify(reported.body));
  const waiting = await get('lessons/' + id, 'teacher');
  assert.equal(waiting.body.state, 'AWAITING_CONFIRMATION');
  assert.equal(waiting.body.latestReportResult, 'NOT_CONDUCTED');
  assert.equal(waiting.body.reports.length, 1);
  assert.equal(waiting.body.reports[0].current, true);
  assert.equal(waiting.body.reports[0].studentNoShow, true);
  assert.equal((await get('journal?state=AWAITING_CONFIRMATION', 'teacher')).body.items.length, 1);

  const confirmed = await post(`lessons/${id}/confirm-outcome`, 'director', {
    reportId: waiting.body.reports[0].reportId,
    basis: 'Confirmed no-show',
  });
  assert.equal(confirmed.status, 200, JSON.stringify(confirmed.body));
  const done = await get('lessons/' + id, 'teacher');
  assert.equal(done.body.state, 'CANCELLED');
  assert.equal(done.body.canReport, false);
  const pending = await get('journal?state=AWAITING_REPORT', 'teacher');
  assert.equal(
    pending.body.items.some((item) => item.lessonId === id),
    false,
  );
});

const DAY = 86_400_000;
const dayStart = (offsetDays) => {
  const d = new Date(Date.now() + offsetDays * DAY);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};
const iso = (ms) => new Date(ms).toISOString();

test('availability read side follows the existing create/cancel commands and flags occupied windows', async () => {
  const base0 = +dayStart(10);
  const open = await post('teacher-availability', 'teacher', {
    startsAt: iso(base0),
    endsAt: iso(base0 + 8 * 3_600_000),
    timezone: 'Europe/Chisinau',
  });
  assert.equal(open.status, 200, JSON.stringify(open.body));
  const second = await post('teacher-availability', 'teacher', {
    startsAt: iso(base0 + DAY),
    endsAt: iso(base0 + DAY + 4 * 3_600_000),
    timezone: 'Europe/Chisinau',
  });
  assert.equal(second.status, 200, JSON.stringify(second.body));
  const cancelled = await post('teacher-availability', 'teacher', {
    availabilityId: second.body.id,
    cancel: true,
  });
  assert.equal(cancelled.status, 200, JSON.stringify(cancelled.body));

  const listed = await get('availability', 'teacher');
  assert.equal(listed.status, 200, JSON.stringify(listed.body));
  const window = listed.body.windows.find((w) => w.availabilityId === open.body.id);
  assert.equal(window.occupied, false);
  assert.equal(window.lessonCount, 0);
  assert.equal(window.cancelledAt, null);
  assert.equal(
    listed.body.windows.some((w) => w.availabilityId === second.body.id),
    false,
  );
  const withCancelled = await get('availability?includeCancelled=true', 'teacher');
  assert.ok(
    withCancelled.body.windows.find((w) => w.availabilityId === second.body.id).cancelledAt,
  );
  assert.equal((await get('availability', 'teacher2')).body.windows.length, 0);

  // Booking a lesson inside the window (existing director command) makes it occupied.
  const lesson = await post('lessons', 'director', {
    teachingAssignmentId: qaId('teaching-001'),
    startsAt: iso(base0 + 3_600_000),
    endsAt: iso(base0 + 2 * 3_600_000),
    basis: 'Synthetic availability booking',
  });
  assert.equal(lesson.status, 200, JSON.stringify(lesson.body));
  const occupied = (await get('availability', 'teacher')).body.windows.find(
    (w) => w.availabilityId === open.body.id,
  );
  assert.equal(occupied.occupied, true);
  assert.equal(occupied.lessonCount, 1);
  const edit = await post('teacher-availability', 'teacher', {
    availabilityId: open.body.id,
    cancel: true,
  });
  assert.equal(edit.status, 409);
  assert.equal(edit.body.code, 'OCCUPIED_AVAILABILITY_REQUIRES_MANAGER');

  // A narrow range that misses the window returns nothing.
  const narrow = await get(
    `availability?from=${iso(base0 + 30 * DAY)}&to=${iso(base0 + 31 * DAY)}`,
    'teacher',
  );
  assert.equal(narrow.body.windows.length, 0);
  state.lessonId = lesson.body.id;
});

test('availability query rejects invalid ranges and unknown input', async () => {
  const from = iso(Date.now() + DAY);
  for (const query of [
    `from=${from}&to=${iso(Date.now())}`,
    `from=${from}&to=${iso(Date.now() + 400 * DAY)}`,
    'from=not-a-date',
    'includeCancelled=maybe',
    'x=1',
  ])
    assert.equal((await get('availability?' + query, 'teacher')).status, 422, query);
  assert.equal((await get('availability', 'manager')).status, 403);
});

test('schedule requests created by the existing command are tracked newest first with paging', async () => {
  const first = await post('schedule-requests', 'teacher', {
    lessonId: state.lessonId,
    reason: 'Need to move this lesson',
    requestedStartAt: iso(+dayStart(12) + 3_600_000),
    requestedEndAt: iso(+dayStart(12) + 2 * 3_600_000),
  });
  assert.equal(first.status, 200, JSON.stringify(first.body));
  const second = await post('schedule-requests', 'teacher', {
    slotId: qaId('recurring-slot-001'),
    reason: 'Series conflicts with an exam',
  });
  assert.equal(second.status, 200, JSON.stringify(second.body));

  const all = await get('schedule-requests', 'teacher');
  assert.equal(all.status, 200, JSON.stringify(all.body));
  assert.deepEqual(
    all.body.items.map((i) => i.requestId),
    [second.body.id, first.body.id],
  );
  const lessonRequest = all.body.items[1];
  assert.equal(lessonRequest.status, 'PENDING');
  assert.equal(lessonRequest.lessonId, state.lessonId);
  assert.ok(lessonRequest.lessonStartsAt && lessonRequest.studentName && lessonRequest.subjectName);
  assert.equal(all.body.items[0].slotId, qaId('recurring-slot-001'));
  assert.equal(all.body.items[0].lessonStartsAt, null);

  const page1 = await get('schedule-requests?limit=1', 'teacher');
  assert.equal(page1.body.items.length, 1);
  assert.ok(page1.body.nextCursor);
  const page2 = await get('schedule-requests?limit=1&cursor=' + page1.body.nextCursor, 'teacher');
  assert.equal(page2.body.items[0].requestId, first.body.id);
  assert.equal(page2.body.nextCursor, null);

  assert.equal((await get('schedule-requests?status=RESOLVED', 'teacher')).body.items.length, 0);
  assert.equal((await get('schedule-requests?status=PENDING', 'teacher')).body.items.length, 2);
  assert.equal((await get('schedule-requests', 'teacher2')).body.items.length, 0);
  for (const query of ['status=NOPE', 'limit=0', 'cursor=@@@', 'x=1'])
    assert.equal((await get('schedule-requests?' + query, 'teacher')).status, 422, query);
  assert.equal((await get('schedule-requests', 'director')).status, 403);
});

test('payroll statement follows accrual and payout of a confirmed lesson (read-only)', async () => {
  const outcome = await client.lessonActualOutcome.findUniqueOrThrow({
    where: { lesson_occurrence_id: qaId('lesson-conducted') },
  });
  const pending = await get('payroll?month=2026-10', 'teacher');
  assert.equal(pending.status, 200, JSON.stringify(pending.body));
  assert.equal(pending.body.month, '2026-10');
  const line = pending.body.lines.find((l) => l.outcomeId === outcome.id);
  assert.equal(line.status, 'PENDING_ACCRUAL');
  assert.equal(line.rate, '200.0000');
  assert.equal(line.paid, '0.0000');
  assert.equal(pending.body.totals[0].pendingAccrual, '200.0000');
  assert.equal(pending.body.totals[0].accrued, '0.0000');

  const accrual = await post('accruals', 'director', {
    outcomeId: outcome.id,
    basis: 'Confirmed lesson of October',
  });
  assert.equal(accrual.status, 200, JSON.stringify(accrual.body));
  const accrued = await get('payroll?month=2026-10', 'teacher');
  const accruedLine = accrued.body.lines.find((l) => l.outcomeId === outcome.id);
  assert.equal(accruedLine.status, 'ACCRUED');
  assert.equal(accruedLine.amount, '200.0000');
  assert.ok(accruedLine.accruedAt);
  assert.equal(accrued.body.totals[0].outstanding, '200.0000');
  assert.equal(accrued.body.totals[0].pendingAccrual, '0.0000');

  const attempt = await post('payouts/attempt', 'director', {
    obligationId: accrual.body.obligationId,
    amount: '200',
    provider: 'synthetic-manual',
    providerRequestId: randomUUID(),
  });
  assert.equal(attempt.status, 200, JSON.stringify(attempt.body));
  // An attempt is not a payment: the teacher still sees it as accrued.
  assert.equal(
    (await get('payroll?month=2026-10', 'teacher')).body.lines.find(
      (l) => l.outcomeId === outcome.id,
    ).status,
    'ACCRUED',
  );
  const confirmed = await post(`payouts/${attempt.body.id}/confirm`, 'director', {
    providerConfirmationId: randomUUID(),
  });
  assert.equal(confirmed.status, 200, JSON.stringify(confirmed.body));
  const paid = await get('payroll?month=2026-10', 'teacher');
  const paidLine = paid.body.lines.find((l) => l.outcomeId === outcome.id);
  assert.equal(paidLine.status, 'PAID');
  assert.equal(paidLine.paid, '200.0000');
  assert.ok(paidLine.lastPaidAt);
  assert.equal(paid.body.totals[0].outstanding, '0.0000');

  assert.deepEqual((await get('payroll?month=2026-10', 'teacher2')).body.lines, []);
  assert.deepEqual((await get('payroll?month=2025-01', 'teacher')).body.totals, []);
  for (const query of ['month=2026-13', 'month=abc', 'month=2026-1', 'x=1'])
    assert.equal((await get('payroll?' + query, 'teacher')).status, 422, query);
  assert.equal((await get('payroll', 'director')).status, 403);
  assert.equal((await get('payroll', 'manager')).status, 403);
});

test('profile: own data, no credential material, phone is the only editable field', async () => {
  const before = await get('profile', 'teacher');
  assert.equal(before.status, 200, JSON.stringify(before.body));
  assert.equal(before.body.teacherId, QA.teachers[0]);
  assert.ok(before.body.fullName);
  assert.equal(JSON.stringify(before.body).includes('public_key'), false);
  for (const key of before.body.passkeys)
    assert.deepEqual(Object.keys(key).sort(), ['backedUp', 'createdAt', 'id', 'lastUsedAt']);

  const patch = (body, actor = 'teacher') => send('PATCH', 'teacher/profile', actor, body);
  for (const bad of [
    {},
    { phone: '12345' },
    { phone: '+0123456789' },
    { phone: '+37360000000', email: 'x@y.z' },
    { phone: 5 },
  ])
    assert.equal((await patch(bad)).status, 422, JSON.stringify(bad));
  assert.equal((await patch({ phone: '+37360000000' }, 'director')).status, 403);
  const changed = await patch({ phone: '+37360123456' });
  assert.equal(changed.status, 200, JSON.stringify(changed.body));
  assert.equal((await get('profile', 'teacher')).body.phone, '+37360123456');
  assert.equal((await get('profile', 'teacher2')).body.phone === '+37360123456', false);
  assert.equal((await patch({ phone: null })).status, 200);
  assert.equal((await get('profile', 'teacher')).body.phone, null);
  assert.equal((await get('profile', 'manager')).status, 403);
});
