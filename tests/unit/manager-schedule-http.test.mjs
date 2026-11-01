import { afterAll, afterEach, beforeAll, beforeEach, expect, test } from '@jest/globals';
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { managerScheduleFixture } from '../support/manager-schedule-fixture.mjs';
let fx, f, own, foreign, ready;
const capturedSql = new Set();
afterEach(() => {
  for (const q of f.state.queries) capturedSql.add(q.text);
});
beforeAll(async () => {
  fx = await managerScheduleFixture();
  f = fx.f;
});
afterAll(async () => {
  await writeFile(join(tmpdir(), 'online-school-mgr06-sql.json'), JSON.stringify([...capturedSql]));
  await f?.app.close();
});
beforeEach(async () => {
  await f.reset();
  own = f.addStudent();
  foreign = f.addStudent(1);
  ready = fx.readyFor(own);
});
const create = (extra = {}, student = own, index = 0, key = randomUUID()) =>
  f.api('post', `/api/v1/manager/students/${student.id}/lessons`, index, {
    key,
    body: {
      teacherId: ready.teacherId,
      subscriptionId: ready.subscriptionId,
      startsAt: '2026-11-02T10:00:00Z',
      durationMinutes: 60,
      ...extra,
    },
  });
const action = (id, type, body, key = randomUUID(), index = 0) =>
  f.api('post', `/api/v1/manager/lessons/${id}/${type}`, index, { key, body });
const list = (query = 'from=2026-10-31T10:00:00Z&to=2026-11-20T10:00:00Z', index = 0) =>
  f.api('get', `/api/v1/manager/schedule?${query}`, index);
test('creates a paid scheduled lesson and lists only own portfolio, preserving a stable ID on reschedule', async () => {
  const r = await create();
  expect(r.status).toBe(201);
  expect(r.body).toMatchObject({
    studentId: own.id,
    status: 'SCHEDULED',
    subscriptionId: ready.subscriptionId,
    chargedLessons: 0,
    meetLink: 'https://meet.google.com/abc-defg-hij',
  });
  expect((await list()).body.map((l) => l.lessonId)).toEqual([r.body.lessonId]);
  const moved = await action(r.body.lessonId, 'reschedule', {
    newStartsAt: '2026-11-03T10:00:00Z',
    reason: 'Family request',
  });
  expect(moved.status).toBe(200);
  expect(moved.body.lessonId).toBe(r.body.lessonId);
  expect(moved.body.startsAt).toBe('2026-11-03T10:00:00.000Z');
  expect(f.state.lessons.get(r.body.lessonId).original_scheduled_at.toISOString()).toBe(
    '2026-11-02T10:00:00.000Z',
  );
  expect(f.state.entries.size).toBe(0);
});
test('chargeable late cancellation consumes one paid right and publishes without creating a conducted outcome', async () => {
  const r = await create({ startsAt: '2026-10-31T12:00:00Z' });
  expect(r.status).toBe(201);
  const c = await action(r.body.lessonId, 'cancel', {
    reason: 'Late student cancellation',
    chargeable: true,
  });
  expect(c.status).toBe(200);
  expect(c.body).toMatchObject({ status: 'CANCELLED', chargedLessons: 1 });
  expect(f.state.consumptions.size).toBe(1);
  expect([...f.state.consumptions.values()][0].basis).toBe('APPROVED_CANCELLATION');
  expect(f.state.entries.size).toBe(1);
});

test('teacher filter never exposes another portfolio', async () => {
  const r = await create(),
    other = fx.readyFor(foreign);
  const x = await create(
    { teacherId: other.teacherId, subscriptionId: other.subscriptionId },
    foreign,
    1,
  );
  expect(x.status).toBe(201);
  expect((await list()).body.map((l) => l.lessonId)).toEqual([r.body.lessonId]);
  expect(
    (await list(`from=2026-11-01T00:00:00Z&to=2026-11-10T00:00:00Z&teacherId=${other.teacherId}`))
      .body,
  ).toEqual([]);
  expect(
    (await list(`from=2026-11-01T00:00:00Z&to=2026-11-10T00:00:00Z&studentId=${foreign.id}`))
      .status,
  ).toBe(404);
  expect(
    (await action(x.body.lessonId, 'cancel', { reason: 'foreign', chargeable: false })).body.code,
  ).toBe('LESSON_NOT_FOUND');
  expect(
    (await action(randomUUID(), 'cancel', { reason: 'absent', chargeable: false })).body.code,
  ).toBe('LESSON_NOT_FOUND');
});
test('range up to31 days is accepted and longer or missing timezone is rejected', async () => {
  expect((await list('from=2026-11-01T00:00:00Z&to=2026-12-02T00:00:00Z')).status).toBe(200);
  expect((await list('from=2026-11-01T00:00:00Z&to=2026-12-02T00:00:01Z')).body.code).toBe(
    'RANGE_TOO_LARGE',
  );
  expect((await list('from=2026-11-01&to=2026-11-02')).status).toBe(422);
});
test.each(['FROZEN', 'EXPIRED'])('creation rejects %s subscription', async (status) => {
  f.state.roots.get(ready.subscriptionId).status = status;
  expect((await create()).body.code).toBe('SUBSCRIPTION_NOT_ACTIVE');
  expect(f.state.lessons.size).toBe(0);
});
test('empty paid rights, unpaid purchase, wrong teacher and inactive availability are rejected', async () => {
  f.state.grants.get(ready.grantId).quantity = 0;
  expect((await create()).body.code).toBe('NO_LESSONS_REMAINING');
  f.state.grants.get(ready.grantId).quantity = 8;
  f.state.rightsUnpaid = true;
  expect((await create()).body.code).toBe('NO_LESSONS_REMAINING');
  f.state.rightsUnpaid = false;
  expect((await create({ teacherId: randomUUID() })).body.code).toBe('TEACHER_NOT_ASSIGNED');
  f.state.availability = [];
  expect((await create()).body.code).toBe('TEACHER_NOT_AVAILABLE');
});
test('multiple study directions require an explicit subscription selection', async () => {
  fx.readyFor(own);
  expect((await create({ subscriptionId: undefined })).body.code).toBe('SUBSCRIPTION_REQUIRED');
});
test.each(['2026-10-31T10:59:59Z', '2026-10-31T10:00:00Z'])(
  'minimum60-minute lead rejects %s',
  async (startsAt) => {
    expect((await create({ startsAt })).body.code).toBe('LEAD_TIME_VIOLATION');
  },
);
test.each([30, 45, 60, 90])(
  'lead boundary and supported duration %i are accepted',
  async (durationMinutes) => {
    expect((await create({ startsAt: '2026-10-31T11:00:00Z', durationMinutes })).status).toBe(201);
  },
);
test('EXCLUDE23P01 and preflight collisions return safe SLOT_CONFLICT', async () => {
  f.state.failExclusion = true;
  const x = await create();
  expect(x.status).toBe(409);
  expect(x.body.code).toBe('SLOT_CONFLICT');
  expect(JSON.stringify(x.body)).not.toMatch(/private|student|constraint/);
  f.state.failExclusion = false;
  const concurrent = await Promise.all([create(), create()]);
  expect(concurrent.map((r) => r.status).sort()).toEqual([201, 409]);
  expect(concurrent.find((r) => r.status === 409).body.code).toBe('SLOT_CONFLICT');
  expect(f.state.lessons.size).toBe(1);
});
test('registration and reschedule replay do not duplicate lessons, events or notifications', async () => {
  const key = randomUUID(),
    r = await create({}, own, 0, key),
    again = await create({}, own, 0, key);
  expect(again.body).toEqual(r.body);
  expect(f.state.lessons.size).toBe(1);
  expect((await create({ durationMinutes: 90 }, own, 0, key)).body.code).toBe(
    'IDEMPOTENCY_KEY_REUSED',
  );
  const moveKey = randomUUID(),
    body = { newStartsAt: '2026-11-04T10:00:00Z', reason: 'planned change' };
  const moved = await action(r.body.lessonId, 'reschedule', body, moveKey);
  expect((await action(r.body.lessonId, 'reschedule', body, moveKey)).body).toEqual(moved.body);
  expect(f.state.audit.filter((a) => a.action === 'LESSON_RESCHEDULED')).toHaveLength(1);
});
test('late reschedule requests a specific director decision; flag alone does not change the lesson', async () => {
  const r = await create({ startsAt: '2026-10-31T12:00:00Z' }),
    id = r.body.lessonId;
  const body = { newStartsAt: '2026-11-02T12:00:00Z', reason: 'Emergency', overrideLateRule: true };
  expect((await action(id, 'reschedule', { ...body, overrideLateRule: false })).body.code).toBe(
    'LATE_RULE_OVERRIDE_REQUIRED',
  );
  const pending = await action(id, 'reschedule', body);
  expect(pending.status).toBe(200);
  expect(pending.body.requiresApproval).toBe(true);
  expect(pending.body.startsAt).toBe(r.body.startsAt);
  const request = pending.body.pendingChangeId,
    path = `/api/v1/schedule-change-approvals/${request}/approve`;
  expect((await f.api('post', path, 0, { key: randomUUID(), body: {} })).status).toBe(403);
  expect((await f.api('post', path, 4, { key: randomUUID(), body: {} })).status).toBe(200);
  const changed = await action(id, 'reschedule', body);
  expect(changed.status).toBe(200);
  expect(changed.body.startsAt).toBe(body.newStartsAt.replace('Z', '.000Z'));
  expect(changed.body.requiresApproval).toBe(false);
  expect(f.state.approvals.get(request).consumed_at).not.toBeNull();
  const audit = f.state.audit.find((a) => a.action === 'LESSON_RESCHEDULED');
  expect(audit.metadata).toMatchObject({
    overrideLateRule: true,
    reason: 'Emergency',
    oldStartsAt: r.body.startsAt,
  });
});
test('third student reschedule requests approval; teacher changes do not consume that limit', async () => {
  const r = await create(),
    id = r.body.lessonId;
  for (const day of [3, 4])
    expect(
      (
        await action(id, 'reschedule', {
          newStartsAt: `2026-11-0${day}T10:00:00Z`,
          reason: 'timely request',
        })
      ).body.requiresApproval,
    ).toBe(false);
  const third = await action(id, 'reschedule', {
    newStartsAt: '2026-11-05T10:00:00Z',
    reason: 'third request',
  });
  expect(third.body.requiresApproval).toBe(true);
  expect(f.state.lessons.get(id).student_reschedule_count).toBe(2);
  const teacher = await action(id, 'reschedule', {
    newStartsAt: '2026-11-06T10:00:00Z',
    reason: 'teacher request',
    initiator: 'TEACHER',
  });
  expect(teacher.status).toBe(200);
  expect(teacher.body.requiresApproval).toBe(false);
  expect(f.state.lessons.get(id).student_reschedule_count).toBe(2);
  expect(
    (
      await f.api(
        'post',
        `/api/v1/schedule-change-approvals/${third.body.pendingChangeId}/approve`,
        4,
        { key: randomUUID(), body: {} },
      )
    ).body.code,
  ).toBe('CHANGE_REQUEST_STALE');
});
test('a director decision for one payload cannot authorize another requested time', async () => {
  const r = await create({ startsAt: '2026-10-31T12:00:00Z' }),
    id = r.body.lessonId,
    body = { newStartsAt: '2026-11-02T12:00:00Z', reason: 'Emergency', overrideLateRule: true };
  const pending = await action(id, 'reschedule', body);
  await f.api(
    'post',
    `/api/v1/schedule-change-approvals/${pending.body.pendingChangeId}/approve`,
    4,
    { key: randomUUID(), body: {} },
  );
  const other = await action(id, 'reschedule', { ...body, newStartsAt: '2026-11-03T12:00:00Z' });
  expect(other.body.requiresApproval).toBe(true);
  expect(other.body.pendingChangeId).not.toBe(pending.body.pendingChangeId);
  expect(other.body.startsAt).toBe(r.body.startsAt);
});
test('free late cancellation requires director approval while timely cancellation has no Ledger write', async () => {
  const r = await create({ startsAt: '2026-10-31T12:00:00Z' }),
    id = r.body.lessonId,
    body = { reason: 'Emergency', chargeable: false, overrideLateRule: true };
  const p = await action(id, 'cancel', body);
  expect(p.body.requiresApproval).toBe(true);
  expect(f.state.lessons.get(id).status).toBe('SCHEDULED');
  await f.api('post', `/api/v1/schedule-change-approvals/${p.body.pendingChangeId}/approve`, 4, {
    key: randomUUID(),
    body: {},
  });
  expect((await action(id, 'cancel', body)).body.status).toBe('CANCELLED');
  expect(f.state.entries.size).toBe(0);
  const next = await create();
  expect(
    (
      await action(next.body.lessonId, 'cancel', {
        reason: 'timely cancellation',
        chargeable: false,
      })
    ).status,
  ).toBe(200);
  expect(f.state.entries.size).toBe(0);
});
test.each(['ledger', 'closed', 'unbalanced', 'audit', 'outbox'])(
  '%s failure rolls back cancellation and paid deduction together',
  async (failure) => {
    const r = await create({ startsAt: '2026-10-31T12:00:00Z' }),
      id = r.body.lessonId;
    if (failure === 'ledger') f.state.failLedger = true;
    if (failure === 'closed') f.state.closedPeriod = true;
    if (failure === 'unbalanced') f.state.unbalanced = true;
    if (failure === 'audit') f.state.failAudit = 'ledger.published';
    if (failure === 'outbox') f.state.failOutbox = true;
    const result = await action(id, 'cancel', { reason: 'late cancellation', chargeable: true });
    expect(result.status).toBe(503);
    expect(f.state.lessons.get(id).status).toBe('SCHEDULED');
    expect(f.state.consumptions.size).toBe(0);
    expect(f.state.entries.size).toBe(0);
  },
);
test('chargeable cancellation replay deducts once and never marks a lesson conducted', async () => {
  const r = await create({ startsAt: '2026-10-31T12:00:00Z' }),
    key = randomUUID(),
    body = { reason: 'late cancellation', chargeable: true };
  const c = await action(r.body.lessonId, 'cancel', body, key);
  expect((await action(r.body.lessonId, 'cancel', body, key)).body).toEqual(c.body);
  expect((await action(r.body.lessonId, 'cancel', body)).body.code).toBe('LESSON_IMMUTABLE_STATE');
  expect(f.state.consumptions.size).toBe(1);
  expect(f.state.entries.size).toBe(1);
  expect(f.client.lessonActualOutcome.findUnique).toHaveBeenCalled();
});
test.each(['CONDUCTED', 'DISPUTED', 'CANCELLED', 'PAST', 'REPORT', 'STARTED'])(
  '%s lesson is immutable to manager',
  async (state) => {
    const r = await create(),
      id = r.body.lessonId,
      row = f.state.lessons.get(id);
    if (['CONDUCTED', 'DISPUTED', 'CANCELLED'].includes(state)) row.status = state;
    if (state === 'PAST') row.scheduled_at = new Date('2026-10-30');
    if (state === 'REPORT') f.state.reports.add(id);
    if (state === 'STARTED') row.actual_start_at = f.state.now;
    const changed = await action(id, 'reschedule', {
      newStartsAt: '2026-11-03T10:00:00Z',
      reason: 'request',
    });
    expect(changed.body.code).toBe('LESSON_IMMUTABLE_STATE');
    expect((await action(id, 'cancel', { reason: 'request', chargeable: false })).body.code).toBe(
      'LESSON_IMMUTABLE_STATE',
    );
  },
);
test.each([
  'http://meet.google.com/abc-defg-hij',
  'https://evil.invalid/abc-defg-hij',
  'https://meet.google.com/abc-defg-hij?x=1',
  'https://meet.google.com.evil.invalid/abc-defg-hij',
])('invalid Meet link %s is rejected', async (url) => {
  const r = await create();
  const x = await f.api('put', `/api/v1/manager/lessons/${r.body.lessonId}/meet-link`, 0, {
    key: randomUUID(),
    body: { url },
  });
  expect(x.status).toBe(422);
  expect(x.body.code).toBe('INVALID_MEET_LINK');
});
test('Meet override is per lesson, clear suppresses fallback, and command results/events never store its code', async () => {
  const r = await create(),
    next = await create({ startsAt: '2026-11-03T10:00:00Z' }),
    url = 'https://meet.google.com/xyz-uvwx-rst',
    key = randomUUID();
  const path = `/api/v1/manager/lessons/${r.body.lessonId}/meet-link`;
  const set = await f.api('put', path, 0, { key, body: { url } });
  expect(set.body.meetLink).toBe(url);
  expect((await f.api('put', path, 0, { key, body: { url } })).body.meetLink).toBe(url);
  expect((await list()).body.find((l) => l.lessonId === next.body.lessonId).meetLink).toBe(
    'https://meet.google.com/abc-defg-hij',
  );
  expect(JSON.stringify([...f.state.idem.values()])).not.toContain('xyz-uvwx-rst');
  expect(JSON.stringify(f.state.audit)).not.toContain('xyz-uvwx-rst');
  expect(JSON.stringify(f.state.outbox)).not.toContain('xyz-uvwx-rst');
  expect(JSON.stringify(f.state.changeEvents)).not.toContain('xyz-uvwx-rst');
  const cleared = await f.api('delete', path, 0, { key: randomUUID(), body: {} });
  expect(cleared.body.meetLink).toBeNull();
  expect((await list()).body.find((l) => l.lessonId === r.body.lessonId).meetLink).toBeNull();
});
test('MGR04 freeze cancels conflicting lessons in the same transaction without charging or spending student transfer count', async () => {
  const r = await create(),
    id = r.body.lessonId;
  const frozen = await f.api(
    'post',
    `/api/v1/manager/subscriptions/${ready.subscriptionId}/freeze`,
    0,
    {
      key: randomUUID(),
      body: {
        startsOn: '2026-11-01',
        endsOn: '2026-11-10',
        reason: 'ILLNESS',
        cancelConflictingLessons: true,
      },
    },
  );
  expect(frozen.status).toBe(200);
  expect(f.state.lessons.get(id).status).toBe('CANCELLED');
  expect(f.state.entries.size).toBe(0);
  expect(f.state.lessons.get(id).student_reschedule_count).toBe(0);
});
const routes = [
  ['get', '/schedule?from=2026-11-01T00:00:00Z&to=2026-11-02T00:00:00Z', undefined],
  ['post', '/students/STUDENT/lessons', {}],
  [
    'post',
    '/lessons/LESSON/reschedule',
    { newStartsAt: '2026-11-03T10:00:00Z', reason: 'request' },
  ],
  ['post', '/lessons/LESSON/cancel', { reason: 'request', chargeable: false }],
  ['put', '/lessons/LESSON/meet-link', { url: 'https://meet.google.com/abc-defg-hij' }],
  ['delete', '/lessons/LESSON/meet-link', {}],
];
test.each(routes.flatMap((r, i) => [null, 2, 3, 4, 5].map((index) => [i, index, r])))(
  'role matrix route%i actor%p',
  async (_i, index, [verb, path, body]) => {
    const r = await create();
    path = path.replace('STUDENT', own.id).replace('LESSON', r.body.lessonId);
    expect(
      (await f.api(verb, '/api/v1/manager' + path, index, { key: randomUUID(), body })).status,
    ).toBe(index === null ? 401 : 403);
  },
);
test.each(routes.slice(1))('%s %s requires CSRF and idempotency key', async (verb, path, body) => {
  const r = await create();
  path = '/api/v1/manager' + path.replace('STUDENT', own.id).replace('LESSON', r.body.lessonId);
  expect((await f.api(verb, path, 0, { key: randomUUID(), csrf: false, body })).status).toBe(403);
  expect((await f.api(verb, path, 0, { body })).body.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
});
test('cached replay rechecks transferred portfolio before projecting Meet link', async () => {
  const key = randomUUID();
  await create({}, own, 0, key);
  f.state.students.get(own.id).managerId = f.accounts[1].staffId;
  const replay = await create({}, own, 0, key);
  expect(replay.status).toBe(404);
  expect(JSON.stringify(replay.body)).not.toContain('abc-defg-hij');
  expect(f.state.lessons.size).toBe(1);
});

test('a deferred EXCLUDE conflict at transaction commit is also mapped to SLOT_CONFLICT', async () => {
  f.state.failExclusionOnCommit = true;
  const r = await create();
  expect(r.status).toBe(409);
  expect(r.body.code).toBe('SLOT_CONFLICT');
  expect(f.state.lessons.size).toBe(0);
  expect(f.state.jobs).toHaveLength(0);
});
test('three-attempt serialization limit preserves one booking and one notification', async () => {
  f.state.failCommit = 2;
  const r = await create();
  expect(r.status).toBe(201);
  expect(f.state.lessons.size).toBe(1);
  expect(f.state.audit.filter((a) => a.action === 'LESSON_CREATED')).toHaveLength(1);
  f.state.failCommit = 4;
  expect((await create({ startsAt: '2026-11-03T10:00:00Z' })).status).toBe(503);
  expect(f.state.failCommit).toBe(1);
  expect(f.state.lessons.size).toBe(1);
});
test('failed reschedule keeps the director decision unused and the old slot intact', async () => {
  const r = await create({ startsAt: '2026-10-31T12:00:00Z' }),
    body = { newStartsAt: '2026-11-02T12:00:00Z', reason: 'Emergency', overrideLateRule: true };
  const p = await action(r.body.lessonId, 'reschedule', body);
  await f.api('post', `/api/v1/schedule-change-approvals/${p.body.pendingChangeId}/approve`, 4, {
    key: randomUUID(),
    body: {},
  });
  f.state.failExclusion = true;
  expect((await action(r.body.lessonId, 'reschedule', body)).body.code).toBe('SLOT_CONFLICT');
  expect(f.state.approvals.get(p.body.pendingChangeId).consumed_at).toBeNull();
  expect(f.state.lessons.get(r.body.lessonId).scheduled_at.toISOString()).toBe(r.body.startsAt);
});
test('freeze failure rolls back every cancelled lesson and its notifications', async () => {
  const r = await create();
  f.state.failAudit = 'manager.subscription.frozen';
  // Fail the final lifecycle Outbox, after the cancellation port has written the lesson.
  const original = f.client.outboxEvent.create.getMockImplementation();
  f.client.outboxEvent.create.mockImplementation(async (input) => {
    if (input.data.topic === 'manager.subscription.frozen.v1')
      throw Error('fixture outbox failure');
    return original(input);
  });
  try {
    const result = await f.api(
      'post',
      `/api/v1/manager/subscriptions/${ready.subscriptionId}/freeze`,
      0,
      {
        key: randomUUID(),
        body: {
          startsOn: '2026-11-01',
          endsOn: '2026-11-10',
          reason: 'ILLNESS',
          cancelConflictingLessons: true,
        },
      },
    );
    expect(result.status).toBe(503);
    expect(f.state.lessons.get(r.body.lessonId).status).toBe('SCHEDULED');
    expect(f.state.roots.get(ready.subscriptionId).status).toBe('ACTIVE');
    expect(f.state.freezes.size).toBe(0);
  } finally {
    f.client.outboxEvent.create.mockImplementation(original);
  }
});
test('STAR_PENDING reservations are cancelled by freeze without creating money or paid rights', async () => {
  const r = await create();
  f.state.lessons.get(r.body.lessonId).status = 'STAR_PENDING';
  const result = await f.api(
    'post',
    `/api/v1/manager/subscriptions/${ready.subscriptionId}/freeze`,
    0,
    {
      key: randomUUID(),
      body: {
        startsOn: '2026-11-01',
        endsOn: '2026-11-10',
        reason: 'ILLNESS',
        cancelConflictingLessons: true,
      },
    },
  );
  expect(result.status).toBe(200);
  expect(f.state.lessons.get(r.body.lessonId).status).toBe('CANCELLED');
  expect(f.state.entries.size).toBe(0);
});
test.each(['reschedule', 'cancel'])('blank %s reason is rejected after trimming', async (type) => {
  const r = await create();
  expect(
    (
      await action(r.body.lessonId, type, {
        reason: '   ',
        ...(type === 'reschedule'
          ? { newStartsAt: '2026-11-03T10:00:00Z' }
          : { chargeable: false }),
      })
    ).status,
  ).toBe(422);
});

test('director can review the exact immutable proposal while manager cannot impersonate that role', async () => {
  const r = await create({ startsAt: '2026-10-31T12:00:00Z' }),
    body = { newStartsAt: '2026-11-03T12:00:00Z', reason: 'Emergency', overrideLateRule: true };
  const p = await action(r.body.lessonId, 'reschedule', body),
    path = `/api/v1/schedule-change-approvals/${p.body.pendingChangeId}`;
  expect((await f.api('get', path, 0)).status).toBe(403);
  const reviewed = await f.api('get', path, 4);
  expect(reviewed.status).toBe(200);
  expect(reviewed.body).toMatchObject({
    lessonId: r.body.lessonId,
    studentId: own.id,
    action: 'RESCHEDULE',
    oldStartsAt: r.body.startsAt,
    newStartsAt: '2026-11-03T12:00:00.000Z',
    reason: 'Emergency',
    status: 'PENDING',
  });
  expect((await f.api('get', `/api/v1/schedule-change-approvals/${randomUUID()}`, 4)).status).toBe(
    404,
  );
});
test('exactly24 hours is timely and unknown legacy transfer history requires an individual decision', async () => {
  const r = await create({ startsAt: '2026-11-01T10:00:00Z' }),
    body = { newStartsAt: '2026-11-02T10:00:00Z', reason: 'timely request' };
  const moved = await action(r.body.lessonId, 'reschedule', body);
  expect(moved.status).toBe(200);
  expect(moved.body.requiresApproval).toBe(false);
  f.state.lessons.get(r.body.lessonId).reschedule_history_verified = false;
  const legacy = await action(r.body.lessonId, 'reschedule', {
    ...body,
    newStartsAt: '2026-11-03T10:00:00Z',
  });
  expect(legacy.body.requiresApproval).toBe(true);
  expect(legacy.body.startsAt).toBe(moved.body.startsAt);
});
test.each([
  ['post', '/api/v1/lessons'],
  ['patch', '/api/v1/lessons/LESSON/reschedule'],
  ['delete', '/api/v1/lessons/LESSON'],
])('manager cannot bypass new policies through legacy %s %s', async (verb, path) => {
  const r = await create();
  expect(
    (await f.api(verb, path.replace('LESSON', r.body.lessonId), 0, { key: randomUUID(), body: {} }))
      .status,
  ).toBe(403);
});
test('a no-op does not spend a student transfer or recreate deadline jobs', async () => {
  const r = await create(),
    before = f.state.jobs.length;
  expect(
    (
      await action(r.body.lessonId, 'reschedule', {
        newStartsAt: r.body.startsAt,
        reason: 'same slot',
      })
    ).body.code,
  ).toBe('NO_SCHEDULE_CHANGE');
  expect(f.state.lessons.get(r.body.lessonId).student_reschedule_count).toBe(0);
  expect(f.state.jobs).toHaveLength(before);
});
