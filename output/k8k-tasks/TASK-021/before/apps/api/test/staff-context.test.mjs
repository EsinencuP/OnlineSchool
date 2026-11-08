// TASK-018: in-memory Prisma and principal fixture only. No env files/providers/DB.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test, before, after, beforeEach } from 'node:test';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import request from 'supertest';
import { Prisma } from '@online-school/db';
import { PlatformModule } from '../dist/modules/platform/platform.module.js';
import { ManagerModule } from '../dist/modules/manager/manager.module.js';
import { StaffActorContextService } from '../dist/core/actor/actor-context.service.js';
import { DatabaseService } from '../dist/core/database/database.module.js';
import { SessionStore } from '../dist/core/session/session.store.js';
import { OutcomesService } from '../dist/modules/schedule/outcomes.service.js';
import { ManagerPaymentWorkflow } from '../dist/modules/finance/manager-payments/workflow.service.js';
import { PaymentsService } from '../dist/modules/finance/payments.service.js';
import { PolicyService } from '../dist/core/policy/policy.service.js';
import { ScheduleAccess } from '../dist/modules/schedule/schedule-access.service.js';
import { domainError } from '../dist/core/errors/domain-error.js';
const requireApi = createRequire(new URL('../package.json', import.meta.url));
const { Test } = requireApi('@nestjs/testing');
const now = new Date('2026-11-04T12:00:00Z');
const updated = new Date('2026-11-03T12:00:00Z');
const actors = Object.fromEntries(
  ['TEACHER', 'DIRECTOR', 'MANAGER', 'TECH_OPERATOR'].map((role) => [
    role,
    {
      accountId: randomUUID(),
      sessionId: randomUUID(),
      role,
      roles: [role],
      kind: role === 'TEACHER' ? 'TEACHER' : 'STAFF',
      mfaCompleted: true,
      lastActiveAt: now,
      expiresAt: new Date('2026-11-05T12:00:00Z'),
    },
  ]),
);
const profiles = Object.fromEntries(
  Object.entries(actors).map(([role, actor]) => [
    role,
    {
      id: randomUUID(),
      account_id: actor.accountId,
      full_name: `Synthetic ${role}`,
      updated_at: updated,
      deactivated_at: null,
    },
  ]),
);
const ownStudent = randomUUID(),
  foreignStudent = randomUUID(),
  foreignTeacher = randomUUID();
const lesson = {
  id: randomUUID(),
  scheduled_teacher_id: profiles.TEACHER.id,
  enrollment_id: randomUUID(),
  kind: 'TRIAL',
  status: 'SCHEDULED',
  scheduled_at: new Date(+now - 60000),
  scheduled_end_at: new Date(+now + 60000),
  trial_started_at: null,
  actual_start_at: null,
  updated_at: updated,
  enrollment_ref: {
    student_id: ownStudent,
    student_ref: { full_name: 'Synthetic child', display_name: null },
    subject_ref: { name: 'Synthetic subject' },
  },
  scheduled_teacher_ref: { full_name: profiles.TEACHER.full_name },
  google_meet_link: null,
};
const foreignLesson = {
  ...lesson,
  id: randomUUID(),
  scheduled_teacher_id: foreignTeacher,
  enrollment_ref: {
    ...lesson.enrollment_ref,
    student_id: foreignStudent,
    student_ref: { full_name: 'Foreign private child' },
  },
};
const receipt = {
  id: randomUUID(),
  student_id: ownStudent,
  amount: new Prisma.Decimal('123.4500'),
  currency: 'MDL',
  method: 'CASH',
  purpose: 'SUBSCRIPTION',
  updated_at: updated,
  created_at: updated,
  registered_at: updated,
  received_at: updated,
  rejected_at: null,
  confirmed_by_director_at: null,
  approval_requested_at: null,
  t03_ledgerdocument_payment_id: null,
  external_reference: null,
  rejection_reason: null,
};
const foreignReceipt = { ...receipt, id: randomUUID(), student_id: foreignStudent };
let app,
  db,
  readonly = false,
  portfolio = true,
  closed = false,
  paid = true,
  revoked = false,
  fullPage = false;
const writes = [],
  reads = [];
const findProfile = (kind, { where }) =>
  Object.entries(profiles)
    .filter(([role]) => (kind === 'TEACHER' ? role === 'TEACHER' : role !== 'TEACHER'))
    .map(([, p]) => p)
    .find(
      (p) =>
        p.account_id === where.account_id &&
        (!where.id || where.id === p.id) &&
        (where.deactivated_at !== null || !p.deactivated_at),
    ) ?? null;
const findReceipt = ({ where }) =>
  [receipt, foreignReceipt].find(
    (p) => p.id === where.id && (!where.student_id || where.student_id === p.student_id),
  ) ?? null;
before(async () => {
  db = {
    authAccount: {
      findUnique: async ({ where }) =>
        Object.values(actors).some((a) => a.accountId === where.id)
          ? { id: where.id, disabled_at: null, updated_at: updated }
          : null,
    },
    teacherAccount: { findFirst: async (q) => findProfile('TEACHER', q) },
    staffAccount: { findFirst: async (q) => findProfile('STAFF', q) },
    student: {
      findUnique: async ({ where }) =>
        [ownStudent, foreignStudent].includes(where.id) ? { id: where.id } : null,
      findFirst: async ({ where }) =>
        portfolio && where.AND[0].id === ownStudent ? { id: ownStudent } : null,
      count: async () => 1,
    },
    assignedManager: {
      findFirst: async ({ where }) =>
        portfolio && where.student_id === ownStudent && where.manager_id === profiles.MANAGER.id
          ? { id: randomUUID() }
          : null,
    },
    studentSubjectEnrollment: { findUniqueOrThrow: async () => ({ status: 'ACTIVE' }) },
    lessonOccurrence: {
      findFirst: async ({ where }) =>
        [lesson, foreignLesson].find(
          (row) =>
            row.id === where.id &&
            (!where.scheduled_teacher_id ||
              row.scheduled_teacher_id === where.scheduled_teacher_id),
        ) ?? null,
      findUnique: async ({ where }) =>
        [lesson, foreignLesson].find((l) => l.id === where.id) ?? null,
      findMany: async (q) => {
        reads.push(q);
        const rows = fullPage
          ? Array.from({ length: 101 }, (_, i) => ({ ...lesson, id: `synthetic-${i}` }))
          : [lesson, foreignLesson];
        return rows
          .filter(
            (l) =>
              !q.where.scheduled_teacher_id ||
              l.scheduled_teacher_id === q.where.scheduled_teacher_id,
          )
          .slice(0, q.take);
      },
      update: async ({ data }) => {
        assert(!readonly);
        writes.push('lesson');
        return { ...lesson, ...data };
      },
    },
    teachingAssignment: {
      findMany: async (q) => {
        reads.push(q);
        return [
          {
            teacher_id: profiles.TEACHER.id,
            updated_at: updated,
            enrollment_ref: lesson.enrollment_ref,
          },
          {
            teacher_id: foreignTeacher,
            updated_at: updated,
            enrollment_ref: foreignLesson.enrollment_ref,
          },
        ].filter(
          (r) =>
            (!q.where.teacher_id || r.teacher_id === q.where.teacher_id) &&
            (!q.where.enrollment_ref ||
              r.enrollment_ref.student_id === q.where.enrollment_ref.student_id),
        );
      },
    },
    homeworkAssignment: {
      findFirst: async ({ where }) =>
        where.id === ownStudent && where.issued_by === profiles.TEACHER.id
          ? {
              id: ownStudent,
              title: 'Own synthetic assignment',
              subject_ref: { name: 'Synthetic subject' },
              due_at: null,
            }
          : null,
      findMany: async (q) => {
        reads.push(q);
        return [];
      },
    },
    crmTask: {
      findFirst: async ({ where }) =>
        where.id === ownStudent && where.status.in.includes('OPEN')
          ? {
              id: ownStudent,
              title: 'Synthetic task',
              status: 'OPEN',
              assigned_to: null,
              due_at: now,
            }
          : null,
      findMany: async (q) => {
        reads.push(q);
        return [];
      },
    },
    paymentReceipt: {
      findUnique: async (q) => findReceipt(q),
      findFirst: async (q) => findReceipt(q),
      update: async ({ data }) => {
        assert(!readonly);
        writes.push('payment');
        Object.assign(receipt, data);
        return receipt;
      },
    },
    auditEvent: { create: async () => ({ id: randomUUID() }) },
    outboxEvent: {
      create: async () => {
        assert(!readonly);
        writes.push('outbox');
        return {};
      },
    },
    $executeRaw: async (sql) => {
      assert.match(sql.join(''), /READ ONLY/);
      readonly = true;
      return 0;
    },
    $queryRaw: async (sql) => {
      const text = sql.join('');
      if (readonly) assert.doesNotMatch(text, /FOR UPDATE|INSERT|UPDATE\s+\w+\s+SET/i);
      if (text.includes('clock_timestamp')) return [{ now }];
      if (text.includes('financial_periods'))
        return [{ id: randomUUID(), closed_at: closed ? now : null }];
      if (text.includes('SELECT EXISTS')) return [{ ok: paid }];
      return [];
    },
    $transaction: async (fn) => {
      const previous = readonly;
      readonly = false;
      try {
        return await fn(db);
      } finally {
        readonly = previous;
      }
    },
  };
  const module = await Test.createTestingModule({ imports: [PlatformModule, ManagerModule] })
    .overrideProvider(DatabaseService)
    .useValue({ client: db })
    .overrideProvider(SessionStore)
    .useValue({
      resolve: async (token) => {
        const actor = actors[token];
        return actor && !revoked
          ? { ok: true, value: actor }
          : { ok: false, error: domainError('UNAUTHENTICATED', 401) };
      },
    })
    .compile();
  app = module.createNestApplication();
  app.useLogger(false);
  await app.init();
});
after(async () => app?.close());
beforeEach(() => {
  writes.length = 0;
  reads.length = 0;
  portfolio = true;
  closed = false;
  paid = true;
  revoked = false;
  fullPage = false;
  receipt.approval_requested_at = null;
  receipt.confirmed_by_director_at = null;
  receipt.rejected_at = null;
  lesson.kind = 'TRIAL';
  lesson.status = 'SCHEDULED';
  for (const p of Object.values(profiles)) p.deactivated_at = null;
  for (const a of Object.values(actors)) a.mfaCompleted = true;
});
const get = (role, path) =>
  request(app.getHttpServer())
    .get(`/api/v1/${path}`)
    .set('Cookie', `__Host-school_session=${role}`);
const context = (role) => ({
  actor: actors[role],
  tx: db,
  requestId: randomUUID(),
  operationId: randomUUID(),
});

test('staff detail scopes IDs before projection and retains guards on direct links', async () => {
  const path = (section, id) => `platform/workspace/${section}/${id}`;
  const own = await get('TEACHER', path('lessons', lesson.id));
  assert.equal(own.status, 200);
  assert.equal(own.body.item.id, lesson.id);
  assert.equal(own.body.actorContext.accountId, actors.TEACHER.accountId);
  assert.equal(own.body.item.meetUrl, undefined);
  assert.match(own.headers['cache-control'], /no-store/);
  for (const [section, id] of [
    ['lessons', foreignLesson.id],
    ['students', foreignStudent],
    ['homework', foreignStudent],
    ['tasks', ownStudent],
  ]) {
    const denied = await get('TEACHER', path(section, id));
    assert.equal(denied.status, 404);
    assert.match(denied.headers['cache-control'], /no-store/);
    assert(!JSON.stringify(denied.body).includes('Foreign private child'));
  }
  assert.deepEqual((await get('TEACHER', path('students', ownStudent))).body.item.subjects, [
    'Synthetic subject',
  ]);
  assert.equal((await get('TEACHER', path('homework', ownStudent))).status, 200);
  assert.equal((await get('DIRECTOR', path('lessons', foreignLesson.id))).status, 200);
  assert.equal((await get('DIRECTOR', path('tasks', ownStudent))).status, 200);
  assert.equal((await get('DIRECTOR', path('homework', ownStudent))).status, 404);
  assert.equal((await get('TECH_OPERATOR', path('lessons', lesson.id))).status, 403);
  assert.equal((await get('TEACHER', path('other', ownStudent))).status, 400);
  assert.equal((await get('TEACHER', path('lessons', 'bad-id'))).status, 400);
  actors.DIRECTOR.mfaCompleted = false;
  assert.equal((await get('DIRECTOR', path('tasks', ownStudent))).body.code, 'MFA_REQUIRED');
  revoked = true;
  assert.equal((await get('TEACHER', path('lessons', lesson.id))).status, 401);
  assert.deepEqual(writes, []);
});

test('teacher context uses own profile, ignores identity override, director never impersonates teacher', async () => {
  const t = await get(
    'TEACHER',
    `platform/actor-context?teacherProfileId=${foreignTeacher}&accountId=${actors.DIRECTOR.accountId}`,
  );
  assert.equal(t.status, 200);
  assert.equal(t.body.accountId, actors.TEACHER.accountId);
  assert.equal(t.body.teacherProfileId, profiles.TEACHER.id);
  assert.equal(t.body.staffProfileId, null);
  assert.notEqual(t.body.accountId, t.body.teacherProfileId);
  assert.equal(t.body.asOf, now.toISOString());
  assert.equal(t.body.profileUpdatedAt, updated.toISOString());
  assert.equal(t.body.accountUpdatedAt, updated.toISOString());
  assert(t.headers['cache-control'].includes('no-store'));
  const d = await get('DIRECTOR', `platform/actor-context?teacherProfileId=${profiles.TEACHER.id}`);
  assert.equal(d.status, 200);
  assert.equal(d.body.teacherProfileId, null);
  assert.equal(d.body.staffProfileId, profiles.DIRECTOR.id);
  assert(!JSON.stringify(d.body).includes(profiles.TEACHER.id));
  const o = await get('TECH_OPERATOR', 'platform/actor-context');
  assert.equal(o.status, 200);
  assert.equal(o.body.teacherProfileId, null);
});
test('profile deactivation, MFA and revoked session override previous allowed; no-store also on errors', async () => {
  const path = `platform/lessons/${lesson.id}/start-eligibility`;
  assert.equal((await get('TEACHER', path)).body.allowed, true);
  profiles.TEACHER.deactivated_at = now;
  const inactive = await get('TEACHER', path);
  assert.equal(inactive.status, 403);
  assert(!inactive.body.allowed);
  const inactivePolicy = await app
    .get(OutcomesService)
    .startEligibility(context('TEACHER'), lesson.id);
  assert.equal(inactivePolicy.allowed, false);
  assert.equal(inactivePolicy.objectId, null);
  assert(inactive.headers['cache-control'].includes('no-store'));
  profiles.TEACHER.deactivated_at = null;
  actors.TEACHER.mfaCompleted = false;
  assert.equal((await get('TEACHER', path)).body.code, 'MFA_REQUIRED');
  actors.TEACHER.mfaCompleted = true;
  revoked = true;
  assert.equal((await get('TEACHER', path)).status, 401);
  assert.deepEqual(writes, []);
});
test('teacher start metadata is own-only, foreign/missing neutral and bad UUID invalid', async () => {
  const own = await get('TEACHER', `platform/lessons/${lesson.id}/start-eligibility`);
  assert.equal(own.status, 200);
  assert.equal(own.body.allowed, true);
  assert.equal(own.body.revision, null);
  const foreign = await get('TEACHER', `platform/lessons/${foreignLesson.id}/start-eligibility`);
  const missing = await get('TEACHER', `platform/lessons/${randomUUID()}/start-eligibility`);
  assert.deepEqual(foreign.body, missing.body);
  assert.equal(foreign.body.reason, 'UNAVAILABLE');
  assert.equal(foreign.body.objectId, null);
  assert.equal(foreign.body.sourceUpdatedAt, null);
  assert.equal((await get('TEACHER', 'platform/lessons/invalid/start-eligibility')).status, 400);
  assert.equal(
    (await get('DIRECTOR', `platform/lessons/${lesson.id}/start-eligibility`)).status,
    403,
  );
  assert.deepEqual(writes, []);
});
test('workspace preserves own scope, director scope, unknown total and bounded coverage', async () => {
  const t = await get('TEACHER', `platform/workspace?teacherId=${foreignTeacher}`);
  assert.equal(t.status, 200);
  assert.equal(t.body.lessons.length, 1);
  assert.equal(t.body.students.length, 1);
  assert(!JSON.stringify(t.body).includes('Foreign private child'));
  assert.equal(t.body.coverage.lessons.scope, 'OWN_TEACHER');
  assert.equal(t.body.coverage.lessons.pageInfo.total, null);
  assert.equal(t.body.coverage.homework.pageInfo.total, null);
  assert.equal(t.body.coverage.homework.sourceUpdatedAt, null);
  assert.equal(t.body.coverage.tasks.scope, 'NOT_APPLICABLE');
  const d = await get('DIRECTOR', 'platform/workspace');
  assert.equal(d.body.lessons.length, 2);
  assert.equal(d.body.actorContext.teacherProfileId, null);
  assert.equal(d.body.coverage.lessons.scope, 'SCHOOL');
  fullPage = true;
  const limited = await get('TEACHER', 'platform/workspace');
  assert.equal(limited.body.lessons.length, 100);
  assert.equal(limited.body.coverage.lessons.pageInfo.hasMore, true);
  assert.equal(limited.body.coverage.lessons.pageInfo.returned, 100);
  assert.equal(limited.body.coverage.lessons.pageInfo.total, null);
  assert.deepEqual(writes, []);
});
test('manager own approval request is distinct from director confirmation and foreign objects remain neutral', async () => {
  const me = await get('MANAGER', 'manager/me');
  assert.equal(me.status, 200);
  assert(me.body.capabilities.includes('PAYMENTS_REQUEST_APPROVAL'));
  assert(!me.body.capabilities.includes('PAYMENTS_CONFIRM'));
  assert.equal(me.body.actorContext.staffProfileId, profiles.MANAGER.id);
  const own = await get('MANAGER', `manager/payments/${receipt.id}/approval-eligibility`);
  assert.equal(own.status, 200);
  assert.equal(own.body.allowed, true);
  assert.equal(own.body.action, 'payment.request-approval');
  assert.equal(
    (await get('MANAGER', `platform/payments/${receipt.id}/confirm-eligibility`)).status,
    403,
  );
  const foreign = await get(
    'MANAGER',
    `manager/payments/${foreignReceipt.id}/approval-eligibility`,
  );
  const missing = await get('MANAGER', `manager/payments/${randomUUID()}/approval-eligibility`);
  assert.equal(foreign.status, 404);
  assert.equal(foreign.body.code, missing.body.code);
  assert(!JSON.stringify(foreign.body).includes(foreignStudent));
  receipt.approval_requested_at = now;
  const pending = await get('MANAGER', `manager/payments/${receipt.id}/approval-eligibility`);
  assert.equal(pending.body.allowed, false);
  assert.equal(pending.body.reason, 'PAYMENT_NOT_PENDING');
  assert.deepEqual(writes, []);
});
test('manager password-only exception stays scoped to manager routes', async () => {
  const previous = process.env.MANAGER_PASSWORD_ONLY_LOGIN;
  process.env.MANAGER_PASSWORD_ONLY_LOGIN = 'true';
  actors.MANAGER.mfaCompleted = false;
  try {
    assert.equal((await get('MANAGER', 'manager/me')).status, 200);
    assert.equal(
      (await get('MANAGER', `manager/payments/${receipt.id}/approval-eligibility`)).body.allowed,
      true,
    );
    assert.equal((await get('MANAGER', 'platform/actor-context')).status, 403);
  } finally {
    if (previous === undefined) delete process.env.MANAGER_PASSWORD_ONLY_LOGIN;
    else process.env.MANAGER_PASSWORD_ONLY_LOGIN = previous;
  }
});
test('director eligibility checks receipt state and open period using read-only SQL without locks', async () => {
  const path = `platform/payments/${receipt.id}/confirm-eligibility`;
  const open = await get('DIRECTOR', path);
  assert.equal(open.status, 200);
  assert.equal(open.body.allowed, true);
  closed = true;
  const locked = await get('DIRECTOR', path);
  assert.equal(locked.body.allowed, false);
  assert.equal(locked.body.reason, 'CLOSED_PERIOD');
  receipt.confirmed_by_director_at = now;
  const confirmed = await get('DIRECTOR', path);
  assert.equal(confirmed.body.reason, 'PAYMENT_ALREADY_CONFIRMED');
  assert.deepEqual(writes, []);
});
test('existing start command reruns policy after metadata and keeps actual start side effects separate', async () => {
  const outcomes = new OutcomesService(
    app.get(ScheduleAccess),
    { change: async () => writes.push('lesson-event') },
    {
      snapshotAtStart: async () => {
        throw new Error('Trial must not create a pay snapshot');
      },
    },
  );
  assert.equal((await outcomes.startEligibility(context('TEACHER'), lesson.id)).allowed, true);
  lesson.status = 'CANCELLED';
  await assert.rejects(
    outcomes.start(context('TEACHER'), lesson.id, {}),
    (e) => e.domain.code === 'LESSON_NOT_IN_START_WINDOW',
  );
  assert.deepEqual(writes, []);
  lesson.status = 'SCHEDULED';
  await outcomes.start(context('TEACHER'), lesson.id, {});
  assert.deepEqual(writes, ['lesson', 'lesson-event']);
});
test('regular lesson admission remains server-only: unpaid/permission absent denies metadata and command', async () => {
  const outcomes = app.get(OutcomesService);
  lesson.kind = 'REGULAR';
  paid = false;
  const metadata = await outcomes.startEligibility(context('TEACHER'), lesson.id);
  assert.equal(metadata.allowed, false);
  assert.equal(metadata.reason, 'PAID_ACCESS_OR_DIRECTOR_PERMISSION_REQUIRED');
  await assert.rejects(
    outcomes.start(context('TEACHER'), lesson.id, {}),
    (e) => e.domain.code === metadata.reason,
  );
  assert.deepEqual(writes, []);
});
test('manager workflow reruns portfolio/state policy and never directly confirms receipt', async () => {
  const flow = app.get(ManagerPaymentWorkflow);
  assert.equal((await flow.approvalEligibility(context('MANAGER'), receipt.id)).allowed, true);
  portfolio = false;
  const denied = await flow.publishPayment(context('MANAGER'), ownStudent, receipt.id);
  assert.equal(denied.ok, false);
  assert.equal(denied.error.code, 'PAYMENT_NOT_FOUND');
  assert.deepEqual(writes, []);
  portfolio = true;
  const sent = await flow.publishPayment(context('MANAGER'), ownStudent, receipt.id);
  assert.equal(sent.ok, true);
  assert.equal(sent.value.status, 'AWAITING_APPROVAL');
  assert.equal(receipt.confirmed_by_director_at, null);
  assert.deepEqual(writes, ['payment', 'outbox']);
});
test('manager cannot call director command, confirmed receipt error code is unchanged', async () => {
  const payments = app.get(PaymentsService);
  await assert.rejects(
    payments.confirm(context('MANAGER'), receipt.id, {}),
    (e) => e.domain.code === 'FORBIDDEN',
  );
  receipt.confirmed_by_director_at = now;
  await assert.rejects(
    payments.confirm(context('DIRECTOR'), receipt.id, {}),
    (e) => e.domain.code === 'PAYMENT_ALREADY_CONFIRMED',
  );
  assert.deepEqual(writes, []);
});
test('unknown source timestamps remain null and invalid timezone fails closed', async () => {
  const actorsService = app.get(StaffActorContextService),
    previous = profiles.TEACHER.updated_at;
  profiles.TEACHER.updated_at = undefined;
  try {
    assert.equal((await actorsService.get(actors.TEACHER)).profileUpdatedAt, null);
  } finally {
    profiles.TEACHER.updated_at = previous;
  }
  const zone = process.env.SCHOOL_TIMEZONE;
  process.env.SCHOOL_TIMEZONE = 'Invalid/Zone';
  try {
    await assert.rejects(
      actorsService.get(actors.TEACHER),
      (e) => e.domain.code === 'CONFIGURATION_INVALID',
    );
  } finally {
    if (zone === undefined) delete process.env.SCHOOL_TIMEZONE;
    else process.env.SCHOOL_TIMEZONE = zone;
  }
  assert.equal(app.get(PolicyService).canRequestPaymentApproval(actors.DIRECTOR), false);
});
