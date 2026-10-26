import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { before, after, test } from 'node:test';
import pg from '../../../../packages/db/node_modules/pg/lib/index.js';
import { NestFactory } from '@nestjs/core';
import { createDirectClient } from '@online-school/db';
import { AppModule } from '../../dist/app.module.js';
import { SessionStore } from '../../dist/core/session/session.store.js';
import { ScheduleEvents } from '../../dist/modules/schedule/schedule-events.service.js';
import { ScheduleDeadlines } from '../../dist/modules/schedule/deadline.module.js';
import { QA, qaId, seedQA } from '../../../../packages/db/dist-tools/seed.js';
const url = process.env.SCHEDULE_TEST_DATABASE_URL;
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
    ['other', 'seed-manager-002'],
    ['teacher', 'seed-teacher-002'],
    ['foreign', 'seed-teacher-001'],
  ]) {
    const accountId = qaId(label + '/auth');
    actors[name] = {
      ...(await client.$transaction(async (tx) =>
        store.issue(tx, accountId, (await tx.$queryRaw`SELECT clock_timestamp() AS now`)[0].now),
      )),
      accountId,
    };
  }
  await client.assignedManager.create({
    data: {
      manager_id: QA.managers[0],
      student_id: QA.students[0],
      assigned_at: new Date('2026-10-01Z'),
    },
  });
  await client.teacherEngagement.create({
    data: {
      teacher_id: QA.teachers[1],
      starts_at: new Date('2025-01-01Z'),
      basis: 'Synthetic verified teacher service',
      recorded_by_id: QA.director,
      source_operation_id: randomUUID(),
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
  { actor = 'manager', body = {}, method = 'POST', key = randomUUID() } = {},
) {
  const session = actors[actor];
  const r = await fetch(base + '/api/v1/' + path, {
    method,
    headers: {
      'content-type': 'application/json',
      'idempotency-key': key,
      'x-csrf-token': session.csrfToken,
      cookie: `__Host-school_session=${session.token}; __Host-school_csrf=${session.csrfToken}`,
    },
    body: JSON.stringify(body),
  });
  return { status: r.status, body: await r.json(), key };
}
function good(r) {
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.body;
}
const ms = () => client.$queryRaw`SELECT clock_timestamp() AS now`.then((r) => +r[0].now);
async function historical(status = 'STAR_PENDING', hours = 2) {
  const now = await ms(),
    start = new Date(now - (hours + 1) * 3600000),
    end = new Date(now - hours * 3600000);
  return client.lessonOccurrence.create({
    data: {
      enrollment_id: state.enrollment.id,
      teaching_assignment_id: state.assignment.id,
      scheduled_teacher_id: QA.teachers[1],
      original_scheduled_at: start,
      scheduled_at: start,
      scheduled_end_at: end,
      status,
      source_operation_id: randomUUID(),
    },
  });
}
test('manager creates scoped subject/enrollment/assignment without granting account or paid rights', async () => {
  state.subject = good(
    await call('subjects', {
      body: { code: 'SYN-' + randomUUID(), name: 'Synthetic schedule subject' },
    }),
  );
  state.enrollment = good(
    await call('enrollments', { body: { studentId: QA.students[0], subjectId: state.subject.id } }),
  );
  assert.equal(
    (
      await call('enrollments', {
        actor: 'other',
        body: { studentId: QA.students[0], subjectId: state.subject.id },
      })
    ).status,
    403,
  );
  // Import a prior enrollment period for subsequent historical fact tests.
  await client.studentSubjectEnrollment.update({
    where: { id: state.enrollment.id },
    data: { valid_from: new Date('2026-10-01Z') },
  });
  state.assignment = good(
    await call('teaching-assignments', {
      body: {
        enrollmentId: state.enrollment.id,
        teacherId: QA.teachers[1],
        validFrom: '2026-10-01T00:00:00Z',
        validTo: '2026-12-01T00:00:00Z',
        basis: 'Synthetic assigned teaching period',
      },
    }),
  );
  assert.equal(
    await client.subscription.count({ where: { enrollment_id: state.enrollment.id } }),
    0,
  );
});
test('free availability is owned by teacher; concurrent overlapping bookings return exactly one 409', async () => {
  state.availability = good(
    await call('teacher-availability', {
      actor: 'teacher',
      body: {
        startsAt: '2026-10-27T00:00:00Z',
        endsAt: '2026-11-12T00:00:00Z',
        timezone: 'Europe/Chisinau',
      },
    }),
  );
  const body = {
    teachingAssignmentId: state.assignment.id,
    startsAt: '2026-10-28T09:00:00Z',
    endsAt: '2026-10-28T10:00:00Z',
    basis: 'Synthetic concurrent booking',
  };
  const result = await Promise.all([
    call('lessons', { body }),
    call('lessons', {
      body: { ...body, startsAt: '2026-10-28T09:30:00Z', endsAt: '2026-10-28T10:30:00Z' },
    }),
  ]);
  assert.equal(result.filter((r) => r.status === 200).length, 1, JSON.stringify(result));
  assert.equal(result.filter((r) => r.status === 409).length, 1, JSON.stringify(result));
  assert.ok(result.find((r) => r.status === 409).body.details);
  state.single = result.find((r) => r.status === 200).body;
  assert.equal(state.single.status, 'STAR_PENDING');
});
test('recurring generation uses stable calendar-day identity even with a different idempotency key', async () => {
  state.slot = good(
    await call('recurring-slots', {
      body: {
        teachingAssignmentId: state.assignment.id,
        rule: 'FREQ=WEEKLY;BYDAY=TU;BYHOUR=14;BYMINUTE=0',
        timezone: 'Europe/Chisinau',
        activeFrom: '2026-10-27T00:00:00Z',
        activeUntil: '2026-11-11T00:00:00Z',
        durationMin: 60,
        basis: 'Synthetic finite reserved series',
      },
    }),
  );
  assert.equal(state.slot.occurrences.length, 3);
  const first = state.slot.occurrences.map((o) => o.id).sort();
  const repeated = good(await call(`recurring-slots/${state.slot.id}/generate`));
  assert.deepEqual(repeated.occurrences.map((o) => o.id).sort(), first);
  assert.equal(
    await client.lessonOccurrence.count({ where: { recurring_slot_id: state.slot.id } }),
    3,
  );
});
test('rescheduling keeps lesson ID, original date and audit history; replay cannot regenerate the old date', async () => {
  const old = state.slot.occurrences[0];
  const moved = good(
    await call(`lessons/${old.id}/reschedule`, {
      method: 'PATCH',
      body: {
        startsAt: '2026-10-29T12:00:00Z',
        endsAt: '2026-10-29T13:00:00Z',
        reason: 'Synthetic authorized reschedule',
      },
    }),
  );
  assert.equal(moved.id, old.id);
  assert.equal(moved.original_scheduled_at, old.original_scheduled_at);
  assert.equal(moved.occurrence_date, old.occurrence_date);
  assert.equal(moved.version, 2);
  const again = good(await call(`recurring-slots/${state.slot.id}/generate`));
  assert.equal(again.occurrences.find((l) => l.id === old.id).scheduled_at, moved.scheduled_at);
  assert.ok(
    (await client.lessonChangeEvent.count({ where: { lesson_occurrence_id: old.id } })) >= 2,
  );
});
test('manager changes only future template instances, preserves same-day IDs and individual past exceptions', async () => {
  const patched = good(
    await call(`recurring-slots/${state.slot.id}`, {
      method: 'PATCH',
      body: {
        rule: 'FREQ=WEEKLY;BYDAY=TU;BYHOUR=16;BYMINUTE=0',
        effectiveFrom: '2026-10-30T00:00:00Z',
        reason: 'Synthetic future template revision',
      },
    }),
  );
  assert.equal(patched.occurrences.length, 2);
  assert.equal(patched.version, 2);
  const ids = state.slot.occurrences
    .slice(1)
    .map((l) => l.id)
    .sort();
  assert.deepEqual(patched.occurrences.map((l) => l.id).sort(), ids);
  assert.equal(
    (
      await client.lessonOccurrence.findUniqueOrThrow({
        where: { id: state.slot.occurrences[0].id },
      })
    ).scheduled_at.toISOString(),
    '2026-10-29T12:00:00.000Z',
  );
  assert.equal(await client.slotChangeEvent.count({ where: { slot_id: state.slot.id } }), 2);
});
test('teacher cannot mutate occupied availability/lessons; change request only creates internal manager task', async () => {
  assert.equal(
    (
      await call('teacher-availability', {
        actor: 'teacher',
        body: { availabilityId: state.availability.id, cancel: true },
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await call(`lessons/${state.single.id}`, {
        actor: 'teacher',
        method: 'DELETE',
        body: { reason: 'Forbidden direct teacher cancellation' },
      })
    ).status,
    403,
  );
  const before = await client.lessonOccurrence.findUniqueOrThrow({
    where: { id: state.single.id },
  });
  const requested = good(
    await call('schedule-requests', {
      actor: 'teacher',
      body: {
        lessonId: state.single.id,
        reason: 'Synthetic manager-assisted rescheduling request',
      },
    }),
  );
  assert.deepEqual(
    await client.lessonOccurrence.findUniqueOrThrow({ where: { id: state.single.id } }),
    before,
  );
  assert.equal(
    await client.crmTask.count({ where: { idempotency_key: `schedule-request:${requested.id}` } }),
    1,
  );
  assert.equal(
    (
      await call(`lessons/${state.single.id}/confirm-outcome`, {
        actor: 'foreign',
        body: { reportId: randomUUID(), basis: 'Forbidden foreign confirmation' },
      })
    ).status,
    403,
  );
});
test('teacher report is not conduction; manager confirms genuine historical teacher and immutable rate without spending rights', async () => {
  const l = await historical();
  state.actualLesson = l;
  assert.equal(
    (
      await call(`lessons/${l.id}/outcome`, {
        actor: 'foreign',
        body: { result: 'NOT_CONDUCTED', note: 'Forbidden report by another teacher' },
      })
    ).status,
    403,
  );
  const report = good(
    await call(`lessons/${l.id}/outcome`, {
      actor: 'teacher',
      body: {
        result: 'CONDUCTED',
        actualStartedAt: l.scheduled_at.toISOString(),
        durationMin: 60,
        note: 'Synthetic actual lesson teacher report',
      },
    }),
  );
  assert.equal(
    await client.lessonActualOutcome.count({ where: { lesson_occurrence_id: l.id } }),
    0,
  );
  assert.equal(
    (
      await call(`lessons/${l.id}/confirm-outcome`, {
        actor: 'other',
        body: { reportId: report.id, basis: 'Forbidden unrelated manager' },
      })
    ).status,
    403,
  );
  const confirmed = good(
    await call(`lessons/${l.id}/confirm-outcome`, {
      body: { reportId: report.id, basis: 'Manager verified actual time and teacher' },
    }),
  );
  assert.equal(confirmed.lesson.status, 'CONDUCTED');
  assert.equal(confirmed.outcome.actual_teacher_id, QA.teachers[1]);
  assert.equal(confirmed.outcome.rate_snapshot, '200');
  state.outcome = confirmed.outcome;
  assert.equal(
    await client.entitlementConsumption.count({ where: { lesson_occurrence_id: l.id } }),
    0,
  );
  assert.equal(
    await client.teacherAccrual.count({
      where: { lesson_actual_outcome_id: confirmed.outcome.id },
    }),
    0,
  );
  assert.equal(
    await client.crmTask.count({ where: { idempotency_key: `unpaid-conducted:${l.id}` } }),
    1,
  );
});
test('manager may correct historical calendar time with an event while actual teacher/time/rate stay immutable', async () => {
  const l = state.actualLesson;
  await client.teacherAvailability.create({
    data: {
      teacher_id: QA.teachers[1],
      starts_at: new Date(+l.scheduled_at - 3600000),
      ends_at: new Date(+l.scheduled_end_at + 3600000),
      timezone: 'UTC',
      source_operation_id: randomUUID(),
    },
  });
  const corrected = good(
    await call(`lessons/${l.id}/reschedule`, {
      method: 'PATCH',
      body: {
        startsAt: new Date(+l.scheduled_at - 60000).toISOString(),
        endsAt: new Date(+l.scheduled_end_at - 60000).toISOString(),
        reason: 'Manager corrected historical organizational time',
      },
    }),
  );
  assert.equal(corrected.id, l.id);
  assert.equal(corrected.original_scheduled_at, l.original_scheduled_at.toISOString());
  assert.deepEqual(
    await client.lessonActualOutcome
      .findUniqueOrThrow({ where: { id: state.outcome.id } })
      .then((r) => JSON.parse(JSON.stringify(r))),
    state.outcome,
  );
});
test('actual start uses server clock and requires paid rights or separate director admission', async () => {
  const now = await ms(),
    start = new Date(now - 60000),
    end = new Date(now + 3600000);
  const l = await client.lessonOccurrence.create({
    data: {
      enrollment_id: state.enrollment.id,
      teaching_assignment_id: state.assignment.id,
      scheduled_teacher_id: QA.teachers[1],
      original_scheduled_at: start,
      scheduled_at: start,
      scheduled_end_at: end,
      status: 'STAR_PENDING',
      source_operation_id: randomUUID(),
    },
  });
  assert.equal((await call(`lessons/${l.id}/start`, { actor: 'teacher' })).status, 403);
  const sub = good(
    await call('subscriptions', {
      body: { enrollmentId: state.enrollment.id, saleConditionId: qaId('sale-001') },
    }),
  );
  const payment = good(
    await call('payments/register', {
      body: { studentId: QA.students[0], amount: '100', currency: 'MDL' },
    }),
  );
  good(await call(`payments/${payment.id}/confirm`, { actor: 'director' }));
  const distribution = good(
    await call(`payments/${payment.id}/distribute`, {
      body: { subscriptionId: sub.id, amount: '100' },
    }),
  );
  good(await call(`distributions/${distribution.id}/approve`, { actor: 'director' }));
  good(
    await call('entitlements/grant', {
      body: { subscriptionId: sub.id, distributionId: distribution.id },
    }),
  );
  const started = good(await call(`lessons/${l.id}/start`, { actor: 'teacher' }));
  assert.ok(+new Date(started.actual_start_at) >= now);
  assert.equal(started.rate_at_start_snapshot, '200');
  assert.equal(
    await client.entitlementConsumption.count({ where: { lesson_occurrence_id: l.id } }),
    0,
  );
});
test('assignment revocation and replacement preserve historical actual teacher and rate', async () => {
  good(
    await call(`teaching-assignments/${state.assignment.id}`, {
      method: 'DELETE',
      body: { reason: 'Synthetic authorized teacher replacement' },
    }),
  );
  good(
    await call('teaching-assignments', {
      body: {
        enrollmentId: state.enrollment.id,
        teacherId: QA.teachers[0],
        validFrom: new Date(await ms()).toISOString(),
        basis: 'Synthetic replacement assignment',
      },
    }),
  );
  assert.deepEqual(
    await client.lessonActualOutcome
      .findUniqueOrThrow({ where: { id: state.outcome.id } })
      .then((r) => JSON.parse(JSON.stringify(r))),
    state.outcome,
  );
  assert.equal(
    await client.crmTask.count({
      where: { idempotency_key: `assignment-revoked:${state.assignment.id}` },
    }),
    1,
  );
});
test('24h and missed-star worker creates tasks once, keeps slot occupied, never auto-conducts or spends', async () => {
  const l = await historical('STAR_PENDING', 26);
  const ctx = {
    actor: { accountId: actors.manager.accountId },
    requestId: randomUUID(),
    operationId: randomUUID(),
  };
  await client.$transaction((tx) => app.get(ScheduleEvents).jobs({ ...ctx, tx }, l));
  const { WorkerModule } = await import('../../../worker/dist/worker.module.js');
  const worker = await NestFactory.createApplicationContext(WorkerModule, {
    logger: false,
    abortOnError: false,
  });
  try {
    for (
      let i = 0;
      i < 35 &&
      (await client.crmTask.count({
        where: {
          idempotency_key: { in: [`outcome-deadline:${l.id}:1`, `star-follow-up:${l.id}:1`] },
        },
      })) < 2;
      i++
    )
      await delay(200);
  } finally {
    await worker.close();
  }
  assert.equal(
    await client.crmTask.count({
      where: {
        idempotency_key: { in: [`outcome-deadline:${l.id}:1`, `star-follow-up:${l.id}:1`] },
      },
    }),
    2,
  );
  assert.equal((await app.get(ScheduleDeadlines).processDue()).ok, true);
  assert.equal(
    (await client.lessonOccurrence.findUniqueOrThrow({ where: { id: l.id } })).status,
    'STAR_PENDING',
  );
  assert.equal(
    await client.lessonActualOutcome.count({ where: { lesson_occurrence_id: l.id } }),
    0,
  );
  assert.equal(
    await client.entitlementConsumption.count({ where: { lesson_occurrence_id: l.id } }),
    0,
  );
});
test('confirmed non-conducted star stays held, has one decision/task and no financial fact', async () => {
  const l = await historical('STAR_PENDING', 6);
  const report = good(
    await call(`lessons/${l.id}/outcome`, {
      actor: 'teacher',
      body: { result: 'NOT_CONDUCTED', note: 'Synthetic unpaid lesson did not happen' },
    }),
  );
  const result = good(
    await call(`lessons/${l.id}/confirm-outcome`, {
      body: { reportId: report.id, basis: 'Manager verified no conducted lesson' },
    }),
  );
  assert.equal(result.lesson.status, 'STAR_PENDING');
  assert.equal(result.outcome, null);
  assert.equal(
    (
      await call(`lessons/${l.id}/confirm-outcome`, {
        body: { reportId: report.id, basis: 'Duplicate independent decision' },
      })
    ).status,
    409,
  );
  assert.equal(
    await client.crmTask.count({ where: { idempotency_key: `star-follow-up:${l.id}:1` } }),
    1,
  );
  assert.equal(
    await client.entitlementConsumption.count({ where: { lesson_occurrence_id: l.id } }),
    0,
  );
});
test('manager cancellation is explicit and recurring generation never resurrects it', async () => {
  const id = state.slot.occurrences[1].id;
  const cancelled = good(
    await call(`lessons/${id}`, {
      method: 'DELETE',
      body: { reason: 'Synthetic authorized future cancellation' },
    }),
  );
  assert.equal(cancelled.status, 'CANCELLED');
  const again = good(await call(`recurring-slots/${state.slot.id}/generate`));
  assert.equal(again.occurrences.find((l) => l.id === id).status, 'CANCELLED');
  assert.equal(
    await client.entitlementConsumption.count({ where: { lesson_occurrence_id: id } }),
    0,
  );
});
