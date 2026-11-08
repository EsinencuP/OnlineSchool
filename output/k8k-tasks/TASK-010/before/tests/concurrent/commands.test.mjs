import { afterAll, beforeAll, expect, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { apiFixture, good, QA } from '../support/api-fixture.mjs';
import {
  fundedSubscription,
  lessonFixture,
  insert,
} from '../../packages/db/test/integration/finance-fixtures.mjs';
let f;
beforeAll(async () => {
  f = await apiFixture();
});
afterAll(async () => {
  await f?.close();
});

test('concurrent lesson bookings: five requests, one succeeds and four return 409', async () => {
  const subject = good(
    await f.call('subjects', { body: { code: randomUUID(), name: 'FND race subject' } }),
  );
  const enrollment = good(
    await f.call('enrollments', { body: { studentId: QA.students[0], subjectId: subject.id } }),
  );
  const start = new Date(Date.now() + 7 * 86400000),
    end = new Date(+start + 3600000);
  const assignment = good(
    await f.call('teaching-assignments', {
      body: {
        enrollmentId: enrollment.id,
        teacherId: QA.teachers[1],
        validFrom: new Date().toISOString(),
        basis: 'FND concurrent booking',
      },
    }),
  );
  good(
    await f.call('teacher-availability', {
      actor: 'teacher',
      body: {
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        timezone: 'Europe/Chisinau',
      },
    }),
  );
  const body = {
    teachingAssignmentId: assignment.id,
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
    basis: 'FND same slot race',
  };
  const result = await Promise.all(Array.from({ length: 5 }, () => f.call('lessons', { body })));
  expect(result.map((r) => r.status).sort()).toEqual([200, 409, 409, 409, 409]);
  expect(
    await f.db.lessonOccurrence.count({ where: { teaching_assignment_id: assignment.id } }),
  ).toBe(1);
});

test('concurrent entitlement consumption: five different lessons cannot double-spend one right', async () => {
  const finance = await fundedSubscription(f.pool, QA.director, QA.students[0]);
  const grant = good(
    await f.call('entitlements/grant', {
      body: {
        subscriptionId: finance.subscription.id,
        distributionId: finance.distribution.id,
        quantity: 1,
      },
    }),
  );
  const lessons = [];
  for (let i = 0; i < 5; i++) lessons.push(await lessonFixture(f.pool, finance, QA.director));
  const result = await Promise.all(
    lessons.map((l) =>
      f.call('entitlements/consume', {
        body: { grantId: grant.id, studentId: QA.students[0], lessonId: l.lesson.id },
      }),
    ),
  );
  expect(result.filter((r) => r.status === 200)).toHaveLength(1);
  expect(
    result.filter((r) => r.status === 422 && r.body.code === 'INSUFFICIENT_PAID_RIGHTS'),
  ).toHaveLength(4);
  expect(
    await f.db.entitlementConsumption.count({ where: { grant_id: grant.id, cancelled_at: null } }),
  ).toBe(1);
  expect(
    await f.db.ledgerDocument.count({
      where: {
        consumption_id: { in: result.filter((r) => r.status === 200).map((r) => r.body.id) },
      },
    }),
  ).toBe(1);
});

test('concurrent distribution approval: three requests allocate a payment exactly once', async () => {
  const finance = await fundedSubscription(f.pool, QA.director, QA.students[0]);
  const payment = good(
    await f.call('payments/register', {
      body: { studentId: QA.students[0], amount: '100', currency: 'MDL' },
    }),
  );
  good(await f.call(`payments/${payment.id}/confirm`, { actor: 'director' }));
  const subscription = await insert(f.pool, 'subscriptions', {
    enrollment_id: finance.enrollment.id,
    sale_condition_id: finance.condition.id,
    lesson_count: 2,
    full_price: '100',
    initial_discount_amount: '0',
    original_paid_unit_price: '50',
    currency: 'MDL',
    valid_from: new Date(),
  });
  const proposed = good(
    await f.call(`payments/${payment.id}/distribute`, {
      body: { subscriptionId: subscription.id, amount: '100' },
    }),
  );
  const result = await Promise.all(
    Array.from({ length: 3 }, () =>
      f.call(`distributions/${proposed.id}/approve`, { actor: 'director' }),
    ),
  );
  expect(result.map((r) => r.status).sort()).toEqual([200, 409, 409]);
  expect(
    await f.db.paymentDistribution.count({
      where: { payment_id: payment.id, approved_at: { not: null } },
    }),
  ).toBe(1);
  expect(await f.db.ledgerDocument.count({ where: { distribution_id: proposed.id } })).toBe(1);
});
