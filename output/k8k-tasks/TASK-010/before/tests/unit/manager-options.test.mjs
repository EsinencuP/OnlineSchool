import { beforeAll, afterAll, beforeEach, expect, jest, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { managerFixture } from '../support/manager-crm-fixture.mjs';
import { Prisma } from '../../packages/db/dist/index.js';
let f, own, foreign;
const enrollmentId = randomUUID(),
  planId = randomUUID(),
  subjectId = randomUUID();
beforeAll(async () => {
  f = await managerFixture({
    basePath: '/api/v1/manager/options',
    configure: (client, state) => {
      client.$executeRaw = jest.fn(async () => 1);
      client.student.findMany = jest.fn(async ({ where }) =>
        [...state().students.values()]
          .filter(
            (s) =>
              s.managerId === where.AND[0].manager_assignments.some.manager_id &&
              (!where.AND[1] || where.AND[1].id === s.id),
          )
          .map((s) => ({ id: s.id, full_name: s.full_name })),
      );
      client.subject = { findMany: jest.fn(async () => [{ id: subjectId, name: 'Mathematics' }]) };
      client.saleCondition = {
        findMany: jest.fn(async () => [
          {
            id: planId,
            code: 'STANDARD',
            version: 2,
            price: new Prisma.Decimal('1234567.8912'),
            currency: 'MDL',
            lesson_count: 8,
          },
        ]),
      };
      client.studentSubjectEnrollment = {
        findMany: jest.fn(async () => [
          {
            id: enrollmentId,
            subject_id: subjectId,
            subject_ref: { name: 'Mathematics' },
            t03_teachingassignment_enrollment_id: [
              { teacher_ref: { id: randomUUID(), full_name: 'Assigned teacher' } },
            ],
          },
        ]),
      };
      client.subscription = { findMany: jest.fn(async () => []) };
    },
  });
});
afterAll(async () => f?.app.close());
beforeEach(async () => {
  await f.reset();
  own = f.addStudent(0);
  foreign = f.addStudent(1);
  for (const key of [
    'student',
    'subject',
    'saleCondition',
    'studentSubjectEnrollment',
    'subscription',
  ])
    f.client[key].findMany.mockClear();
  f.client.$executeRaw.mockClear();
});
test('named options preserve decimal precision and student portfolio boundary in read-only snapshot', async () => {
  const r = await f.api('get', `?studentId=${own.id}`);
  expect(r.status).toBe(200);
  expect(r.body.students).toEqual([{ id: own.id, label: own.full_name }]);
  expect(r.body.plans[0].price).toBe('1234567.8912');
  expect(r.body.enrollments[0].teachers[0].label).toBe('Assigned teacher');
  const query = f.client.studentSubjectEnrollment.findMany.mock.calls[0][0];
  expect(query.where.student_id).toBe(own.id);
  expect(query.where.student_ref.manager_assignments.some.manager_id).toBe(f.accounts[0].staffId);
  expect(query.select.t03_teachingassignment_enrollment_id.where.teacher_ref).toEqual({
    deactivated_at: null,
  });
  expect(
    f.client.subscription.findMany.mock.calls[0][0].where.enrollment_ref.student_ref
      .manager_assignments.some.manager_id,
  ).toBe(f.accounts[0].staffId);
  expect(f.client.$executeRaw.mock.calls[0][0].join('')).toBe(
    'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY',
  );
  expect(f.state.audit).toHaveLength(0);
  expect(f.state.outbox).toHaveLength(0);
});
test('global options expose only names from own portfolio, never private contacts', async () => {
  const r = await f.api('get', '');
  expect(r.status).toBe(200);
  expect(r.body.students).toEqual([{ id: own.id, label: own.full_name }]);
  expect(r.body.enrollments).toEqual([]);
  expect(r.body.financialSubscriptions).toEqual([]);
  expect(JSON.stringify(r.body)).not.toContain(foreign.id);
  expect(JSON.stringify(r.body)).not.toContain(own.email);
});
test('foreign and missing students have indistinguishable errors before any catalog read', async () => {
  const a = await f.api('get', `?studentId=${foreign.id}`),
    b = await f.api('get', `?studentId=${randomUUID()}`);
  expect(a.status).toBe(404);
  expect(b.status).toBe(404);
  expect(a.body.code).toBe('STUDENT_NOT_FOUND');
  expect(b.body.code).toBe(a.body.code);
  expect(f.client.subject.findMany).not.toHaveBeenCalled();
  expect(f.client.student.findMany).not.toHaveBeenCalled();
});
test.each([null, 2, 3, 4, 5])('session role %s cannot read form catalogs', async (index) => {
  const r = await f.api('get', '', index);
  expect(r.status).toBe(index === null ? 401 : 403);
  expect(f.client.subject.findMany).not.toHaveBeenCalled();
});
test.each(['?studentId=not-a-uuid', '?managerId=foreign', '?studentId[]=x'])(
  'invalid query %s is422',
  async (q) => {
    expect((await f.api('get', q)).status).toBe(422);
  },
);
test('database failure becomes generic Result without SQL, contacts or other students', async () => {
  f.client.subject.findMany.mockRejectedValueOnce(new Error(`secret SQL ${foreign.id}`));
  const r = await f.api('get', '');
  expect(r.status).toBe(503);
  expect(r.body.code).toBe('DATABASE_ERROR');
  expect(JSON.stringify(r.body)).not.toMatch(/secret|SQL/);
  expect(JSON.stringify(r.body)).not.toContain(foreign.id);
});
