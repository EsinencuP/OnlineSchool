import '../../apps/api/node_modules/reflect-metadata/Reflect.js';
import { readFile } from 'node:fs/promises';
import { expect, jest, test } from '@jest/globals';
import { StudentSubjectsService } from '../../apps/api/dist/student/subjects/subjects.service.js';
import { studentSubjectsSql } from '../../apps/api/dist/student/subjects/subjects.sql.js';
import { getStudentSubjects } from '../../packages/api-contracts/dist/index.js';

const id = (n) => `54000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const now = new Date('2026-11-07T08:00:00Z');
const until = '2026-11-09T13:00:00Z';
const student = {
  userId: id(1),
  studentProfileId: id(2),
  hasActiveAccess: true,
  mustChangePassword: false,
  subjectIds: [],
};
const fact = (overrides = {}) => ({
  subjectId: id(10),
  subjectName: 'Mathematics',
  enrollmentId: id(100),
  enrollmentStatus: 'ACTIVE',
  subscriptionId: id(1000),
  managerSubscriptionId: null,
  validUntil: until,
  frozenUntil: null,
  periodCurrent: true,
  frozen: false,
  fullyPaid: true,
  grantBalance: 3,
  admission: null,
  homework: false,
  materials: false,
  lessons: false,
  ...overrides,
});
const permission = { maxLessons: 2, lessonsRemaining: 1, validUntil: until };
const setup = (rows) => {
  const query = jest.fn(async () => [{ generatedAt: now, mustChangePassword: false, rows }]);
  return { query, service: new StudentSubjectsService({ client: { $queryRaw: query } }) };
};
const list = async (rows) => (await setup(rows).service.list(student)).items;

test('math and expired physics retain separate capabilities and paid balances', async () => {
  const { service, query } = setup([
    fact(),
    fact({
      subjectId: id(11),
      subjectName: 'Physics',
      enrollmentId: id(101),
      subscriptionId: id(1001),
      periodCurrent: false,
      grantBalance: 7,
      lessons: true,
    }),
  ]);
  const snapshot = await service.list(student);
  expect(snapshot.generatedAt).toBe(now.toISOString());
  expect(snapshot.items).toMatchObject([
    {
      subjectId: id(10),
      displayStatus: 'ACTIVE',
      liveAccess: true,
      subscriptions: [{ paidLessonsRemaining: 3 }],
    },
    {
      subjectId: id(11),
      displayStatus: 'EXPIRED',
      reasonCode: 'PERIOD_EXPIRED',
      liveAccess: false,
      capabilities: { canOpenLessons: true, canOpenSubscription: true },
      subscriptions: [{ paidLessonsRemaining: 7 }],
    },
  ]);
  expect(query).toHaveBeenCalledTimes(1);
});

test('freeze keeps owned issued resources visible and closes subject live access', async () => {
  const [subject] = await list([
    fact({
      frozen: true,
      frozenUntil: until,
      enrollmentStatus: 'PAUSED',
      homework: true,
      materials: true,
    }),
  ]);
  expect(subject).toMatchObject({
    displayStatus: 'FROZEN',
    reasonCode: 'FROZEN',
    liveAccess: false,
    capabilities: { canViewHomework: true, canViewMaterials: true, canOpenLessons: false },
    subscriptions: [{ paidLessonsRemaining: 3, frozenUntil: new Date(until).toISOString() }],
  });
});

test('a separately approved limited admission never adds paid rights; a confirmed last payment uses only the paid grant', async () => {
  const partial = { fullyPaid: false, grantBalance: null };
  const [before] = await list([fact(partial)]);
  const [limited] = await list([
    fact({ ...partial, admission: { ...permission, reason: 'private fixture value' } }),
  ]);
  const [after] = await list([fact({ fullyPaid: true, grantBalance: 3 })]);
  expect(before).toMatchObject({
    reasonCode: 'PAYMENT_OR_ADMISSION_REQUIRED',
    liveAccess: false,
    subscriptions: [{ paidLessonsRemaining: 0, temporaryAdmission: null }],
  });
  expect(limited).toMatchObject({
    reasonCode: 'TEMPORARY_ADMISSION',
    liveAccess: true,
    subscriptions: [
      {
        paidLessonsRemaining: 0,
        temporaryAdmission: { ...permission, validUntil: new Date(until).toISOString() },
      },
    ],
  });
  expect(after).toMatchObject({
    reasonCode: 'PAID_RIGHTS',
    liveAccess: true,
    subscriptions: [{ paidLessonsRemaining: 3, temporaryAdmission: null }],
  });
  expect(limited.subscriptions[0].temporaryAdmission).not.toHaveProperty('reason');
});

test('zero rights, unknown history and a subject without a started plan are distinguishable', async () => {
  const [empty, historical, none] = await list([
    fact({ grantBalance: 0 }),
    fact({ subjectId: id(11), periodCurrent: false, grantBalance: null }),
    fact({ subjectId: id(12), subscriptionId: null, grantBalance: null }),
  ]);
  expect(empty).toMatchObject({
    displayStatus: 'LIMITED',
    reasonCode: 'NO_PAID_RIGHTS',
    liveAccess: false,
    subscriptions: [{ paidLessonsRemaining: 0 }],
  });
  expect(historical).toMatchObject({
    displayStatus: 'EXPIRED',
    liveAccess: false,
    subscriptions: [{ paidLessonsRemaining: null }],
  });
  expect(none).toMatchObject({
    displayStatus: 'NONE',
    liveAccess: false,
    subscriptions: [],
    capabilities: { canOpenSubscription: false },
  });
  const [paidWithoutGrant] = await list([fact({ grantBalance: null })]);
  expect(paidWithoutGrant).toMatchObject({
    reasonCode: 'RIGHTS_UNKNOWN',
    liveAccess: false,
    subscriptions: [{ paidLessonsRemaining: null }],
  });
});

test('wrapper returns one financial anchor; groups are kept separate and unknown siblings propagate null', async () => {
  const wrapper = id(2000);
  const [subject] = await list([
    fact({
      managerSubscriptionId: wrapper,
      periodCurrent: false,
      subscriptionId: id(1001),
      grantBalance: 2,
    }),
    fact({ managerSubscriptionId: wrapper, grantBalance: 4 }),
    fact({
      enrollmentId: id(101),
      enrollmentStatus: 'ENDED',
      subscriptionId: id(1002),
      grantBalance: 1,
    }),
  ]);
  expect(subject.enrollmentIds).toEqual([id(100), id(101)]);
  expect(subject.subscriptions).toMatchObject([
    {
      subscriptionId: id(1000),
      managerSubscriptionId: wrapper,
      paidLessonsRemaining: 6,
      displayStatus: 'ACTIVE',
    },
    { subscriptionId: id(1002), paidLessonsRemaining: 1, displayStatus: 'EXPIRED' },
  ]);
  const [unknown] = await list([
    fact({ managerSubscriptionId: wrapper }),
    fact({
      managerSubscriptionId: wrapper,
      subscriptionId: id(1001),
      periodCurrent: false,
      grantBalance: null,
    }),
  ]);
  expect(unknown.subscriptions[0]).toMatchObject({
    subscriptionId: id(1000),
    paidLessonsRemaining: null,
  });
});

test('one SELECT binds actor and profile, only started periods, confirmed quantity sources and valid admissions', () => {
  const sql = studentSubjectsSql(student);
  expect(new Set(sql.values)).toEqual(new Set([student.userId, student.studentProfileId]));
  expect(sql.text).toContain('statement_timestamp() AS as_of');
  expect(sql.text).toContain('sa.account_id=$1::uuid AND sa.student_id=$2::uuid');
  expect(sql.text).toContain(
    'JOIN profile own ON own.student_id=e.student_id AND NOT own.must_change_password',
  );
  expect(sql.text).toContain('root.enrollment_id=e.id');
  expect(sql.text).toContain('WHERE s.valid_from<=(SELECT as_of FROM snapshot)');
  expect(sql.text).toContain("g.basis='CONFIRMED_PAYMENT'");
  expect(sql.text).toContain('GROUP BY g.subscription_id');
  expect(sql.text).toContain('l.enrollment_id=s.enrollment_id');
  expect(sql.text).toContain('a.effective_at<=(SELECT as_of FROM snapshot)');
  expect(sql.text).toContain('c.consumed_at<=(SELECT as_of FROM snapshot)');
  expect(sql.text).toContain('c.cancelled_at IS NULL OR c.cancelled_at>');
  expect(sql.text).toContain('NOT s.fully_paid');
  expect(sql.text).toContain('p.approved_at>=epoch.latest');
  expect(sql.text).toContain('p.valid_to>(SELECT as_of FROM snapshot)');
  expect(sql.text).toContain('p.revoked_at IS NULL OR p.revoked_at>');
  expect(sql.text).toContain('coalesce(u.used,0)<p.max_lessons');
  expect(sql.text).not.toMatch(/\b(INSERT|UPDATE|DELETE|FOR UPDATE|FOR SHARE)\b/i);
});

test('SDK uses the typed GET, cookies, abort and no-store; OpenAPI has no input selector', async () => {
  const result = { generatedAt: now.toISOString(), items: await list([fact()]) };
  const fetch = jest
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async () => new Response(JSON.stringify(result)));
  try {
    const signal = new AbortController().signal;
    expect(await getStudentSubjects({ cache: 'no-store', signal })).toEqual({
      ok: true,
      value: result,
    });
    expect(fetch.mock.calls[0]).toEqual([
      '/api/v1/student/subjects',
      expect.objectContaining({ method: 'GET', credentials: 'include', cache: 'no-store', signal }),
    ]);
  } finally {
    fetch.mockRestore();
  }
  const { paths, components } = JSON.parse(
    await readFile('packages/api-contracts/openapi/openapi.json', 'utf8'),
  );
  const op = paths['/api/v1/student/subjects'];
  expect(Object.keys(op)).toEqual(['get']);
  expect(op.get.parameters ?? []).toEqual([]);
  expect(op.get.security).toContainEqual({ sessionCookie: [] });
  expect(Object.keys(op.get.responses)).toEqual(['200', '400', '401', '402', '403', '503']);
  expect(components.schemas.StudentSubjectSubscriptionDto.additionalProperties).toBe(false);
  expect(
    components.schemas.StudentSubjectSubscriptionDto.properties.paidLessonsRemaining.type,
  ).toEqual(['integer', 'null']);
});
