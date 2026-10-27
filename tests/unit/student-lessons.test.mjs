import '../../apps/api/node_modules/reflect-metadata/Reflect.js';
import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import {
  LessonsQueryPipe,
  lessonPeriod,
  preferredDate,
} from '../../apps/api/dist/student/lessons/lesson-period.js';
import { StudentLessonsService } from '../../apps/api/dist/student/lessons/lessons.service.js';
import { StudentCrmTaskService } from '../../apps/api/dist/student/lessons/student-crm-task.service.js';
import { OutcomesService } from '../../apps/api/dist/modules/schedule/outcomes.service.js';
import { createHandlers } from '../../apps/worker/dist/handlers.js';
const pipe = new LessonsQueryPipe(),
  student = {
    userId: randomUUID(),
    studentProfileId: randomUUID(),
    hasActiveAccess: true,
    mustChangePassword: false,
    subjectIds: [],
    timeZone: 'Europe/Chisinau',
  };
const fixed = new Date('2026-10-27T12:00:00Z');
let client, service, row;
beforeEach(() => {
  row = {
    id: randomUUID(),
    scheduled_at: new Date(+fixed + 600000),
    scheduled_end_at: new Date(+fixed + 4200000),
    teacher_name: 'Teacher',
    subject_name: 'Math',
    student_status: 'SCHEDULED',
    google_meet_link: 'https://meet.google.com/abc-defg-hij',
    total: 1,
  };
  client = { $queryRaw: jest.fn(async () => [row]) };
  service = new StudentLessonsService({ client }, {}, {});
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});
test('query defaults and calendar contract are explicit', () => {
  expect(pipe.transform({})).toEqual({ period: 'week', page: 1, pageSize: 20 });
  expect(pipe.transform({ month: '2025-09' })).toEqual({
    period: 'month',
    month: '2025-09',
    page: 1,
    pageSize: 62,
  });
  expect(pipe.transform({ period: 'archive', page: '2', pageSize: '100' })).toEqual({
    period: 'archive',
    page: 2,
    pageSize: 100,
  });
});
test.each([
  { page: '0' },
  { page: '1.5' },
  { page: ['1', '2'] },
  { pageSize: '101' },
  { pageSize: '-1' },
  { page: '9007199254740992' },
  { page: '9007199254740991', pageSize: '100' },
  { period: 'all' },
  { month: '2025-13' },
  { month: '0000-01' },
  { month: '2025-09-01' },
  { month: '2025-09', page: '1' },
  { month: '2025-09', period: 'archive' },
  { studentProfileId: 'foreign' },
])('invalid query is rejected before a DB read: %j', (input) => {
  expect(() => pipe.transform(input)).toThrow();
});
test('today uses the student day at a UTC date boundary', () => {
  const period = lessonPeriod(
    pipe.transform({ period: 'today' }),
    new Date('2026-10-27T23:30:00Z'),
    'Europe/Chisinau',
  );
  expect(period.from.toISOString()).toBe('2026-10-27T22:00:00.000Z');
  expect(period.until.toISOString()).toBe('2026-10-28T22:00:00.000Z');
});
test('ISO week starts Monday in the student zone', () => {
  const period = lessonPeriod(pipe.transform({ period: 'week' }), fixed, 'Europe/Chisinau');
  expect(period.from.toISOString()).toBe('2026-10-25T22:00:00.000Z');
  expect(period.until.toISOString()).toBe('2026-11-01T22:00:00.000Z');
});
test('calendar month handles DST and end-exclusive boundaries', () => {
  const period = lessonPeriod(pipe.transform({ month: '2026-03' }), fixed, 'Europe/Chisinau');
  expect(period.from.toISOString()).toBe('2026-02-28T22:00:00.000Z');
  expect(period.until.toISOString()).toBe('2026-03-31T21:00:00.000Z');
  const spring = lessonPeriod(
    pipe.transform({ period: 'today' }),
    new Date('2026-03-29T12:00Z'),
    'Europe/Chisinau',
  );
  expect((+spring.until - +spring.from) / 3600000).toBe(23);
});
test.each(['2026-02-30', '2026-13-01', '2026-10-27T12:00:00Z', '0000-01-01', '2026-10-26'])(
  'invalid/past preferred date is rejected: %s',
  (value) => {
    expect(() => preferredDate(value, '2026-10-27')).toThrow();
  },
);
test('preferred date allows today and real leap days', () => {
  expect(preferredDate('2028-02-29', '2026-10-27')).toBe('2028-02-29');
  expect(preferredDate('2026-10-27', '2026-10-27')).toBe('2026-10-27');
});
test.each([
  [600001, false],
  [600000, true],
  [1, true],
  [0, true],
  [-3599999, true],
  [-3600000, true],
  [-3600001, false],
])('Meet window at %s milliseconds: %s', async (delta, allowed) => {
  jest.useFakeTimers({ now: fixed });
  row.scheduled_at = new Date(+fixed + delta);
  row.scheduled_end_at = new Date(+row.scheduled_at + 3600000);
  const result = await service.list(student, pipe.transform({ period: 'today' }));
  expect(result.value.items[0].canJoin).toBe(allowed);
  expect(result.value.items[0].meetLink).toBe(allowed ? row.google_meet_link : null);
});
test.each(['COMPLETED', 'CANCELLED', 'NO_SHOW', 'STAR_PENDING', 'DISPUTED'])(
  'terminal/unresolved %s cannot open Meet or request a move',
  async (status) => {
    jest.useFakeTimers({ now: fixed });
    row.student_status = status;
    row.scheduled_at = new Date(+fixed + 2 * 86400000);
    const card = (await service.list(student, pipe.transform({}))).value.items[0];
    expect(card.canJoin).toBe(false);
    expect(card.meetLink).toBeNull();
    expect(card.canRequestReschedule).toBe(false);
  },
);
test.each([
  [86400000, true],
  [86399999, false],
  [86400001, true],
])('reschedule eligibility uses exact 24h at %s milliseconds', async (delta, allowed) => {
  jest.useFakeTimers({ now: fixed });
  row.scheduled_at = new Date(+fixed + delta);
  expect(
    (await service.list(student, pipe.transform({}))).value.items[0].canRequestReschedule,
  ).toBe(allowed);
});
test('missing/unsafe Meet links stay hidden within the time window', async () => {
  jest.useFakeTimers({ now: fixed });
  row.google_meet_link = 'https://evil.invalid';
  expect((await service.list(student, pipe.transform({}))).value.items[0]).toMatchObject({
    canJoin: false,
    meetLink: null,
  });
});
test('page beyond the end keeps the true total; calendar overflow is explicit', async () => {
  client.$queryRaw.mockResolvedValue([{ id: null, total: 42 }]);
  expect((await service.list(student, pipe.transform({ page: '100' }))).value).toEqual({
    items: [],
    total: 42,
    page: 100,
    pageSize: 20,
  });
  client.$queryRaw.mockResolvedValue([{ ...row, total: 63 }]);
  expect((await service.list(student, pipe.transform({ month: '2026-10' }))).error.code).toBe(
    'CALENDAR_MONTH_LIMIT_EXCEEDED',
  );
});
test('SQL binds ownership, end-exclusive periods and stable archive order', async () => {
  await service.list(student, pipe.transform({ period: 'archive', page: '2' }));
  let sql = client.$queryRaw.mock.calls[0][0];
  expect(sql.sql).toContain("student_status IN ('COMPLETED','CANCELLED','NO_SHOW')");
  expect(sql.sql).toContain('ORDER BY scheduled_at DESC,id DESC');
  expect(sql.values).toContain(student.studentProfileId);
  expect(sql.values.at(-1)).toBe(20);
  client.$queryRaw.mockClear();
  await service.list(student, pipe.transform({ period: 'today' }));
  sql = client.$queryRaw.mock.calls[0][0];
  expect(sql.sql).toContain('l.scheduled_at>=');
  expect(sql.sql).toContain('l.scheduled_at<');
});
test('DB failures become sanitized Result.Err', async () => {
  client.$queryRaw.mockRejectedValue(Error('private password dburl'));
  const result = await service.list(student, pipe.transform({}));
  expect(result.error.code).toBe('STUDENT_LESSONS_UNAVAILABLE');
  expect(JSON.stringify(result)).not.toContain('private');
});
test('CRM task is addressed to one lesson/student and active assigned manager', async () => {
  const id = randomUUID(),
    manager = randomUUID(),
    ctx = {
      actor: { accountId: student.userId },
      operationId: randomUUID(),
      tx: {
        assignedManager: { findFirst: jest.fn(async () => ({ manager_id: manager })) },
        crmTask: { create: jest.fn(async () => ({ id })) },
      },
    };
  const input = {
    lessonId: row.id,
    studentProfileId: student.studentProfileId,
    payload: { reason: 'Move please', preferredDate: '2026-11-01' },
  };
  expect(await new StudentCrmTaskService().create(ctx, input, fixed)).toEqual({
    crmTaskId: id,
    status: 'CREATED',
  });
  expect(ctx.tx.crmTask.create.mock.calls[0][0].data).toMatchObject({
    type: 'RESCHEDULE_REQUEST',
    student_id: student.studentProfileId,
    lesson_id: row.id,
    payload: input.payload,
    assigned_manager_id: manager,
  });
});
test('teacher cannot label a conducted lesson as student no-show', async () => {
  const access = {
    lesson: async () => ({ status: 'SCHEDULED', scheduled_end_at: new Date(+fixed - 1000) }),
    teacher: async () => randomUUID(),
  };
  // Reject the contradictory classification before any report/finance write.
  const tx = {
    $queryRaw: async (parts) =>
      parts.join('').includes('clock_timestamp') ? [{ now: fixed }] : [],
  };
  const outcomes = new OutcomesService(access, {}, {});
  await expect(
    outcomes.report({ tx }, row.id, {
      result: 'CONDUCTED',
      studentNoShow: true,
      note: 'Confirmed attendance',
      actualStartedAt: '2026-10-27T10:00:00Z',
      durationMin: 30,
    }),
  ).rejects.toMatchObject({ domain: { code: 'INVALID_NO_SHOW_RESULT' } });
});

test('explicit absence is stored as a report classification without changing the lesson or finances', async () => {
  const access = {
    lesson: async () => ({
      status: 'SCHEDULED',
      scheduled_end_at: new Date(+fixed - 1000),
      enrollment_id: randomUUID(),
      version: 1,
    }),
    teacher: async () => randomUUID(),
  };
  const tx = {
    $queryRaw: async (parts) =>
      parts.join('').includes('clock_timestamp') ? [{ now: fixed }] : [],
    lessonOutcomeReport: {
      findFirst: async () => null,
      create: jest.fn(async ({ data }) => ({ id: randomUUID(), ...data })),
    },
    studentSubjectEnrollment: {
      findUniqueOrThrow: async () => ({ student_id: student.studentProfileId }),
    },
  };
  const result = await new OutcomesService(access, {}, {}).report(
    { tx, operationId: randomUUID() },
    row.id,
    { result: 'NOT_CONDUCTED', studentNoShow: true, note: 'Student did not attend' },
  );
  expect(result.student_no_show).toBe(true);
  expect(tx.lessonOutcomeReport.create).toHaveBeenCalledTimes(1);
});
test('worker recognizes the committed reschedule event instead of dead-lettering an unknown topic', () => {
  expect(createHandlers().has('student.lesson.reschedule-requested.v1')).toBe(true);
  expect(createHandlers().has('student.password.change.v1')).toBe(true);
  expect(createHandlers().has('student.lesson.dispute-requested.v1')).toBe(true);
});
