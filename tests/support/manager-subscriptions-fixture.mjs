import { jest } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { Prisma } from '../../packages/db/dist/index.js';
import { managerFixture } from './manager-crm-fixture.mjs';
export async function managerSubscriptionsFixture(extension = {}) {
  let stateOf;
  const f = await managerFixture({
    beforeCommit(s) {
      if (s.failCommit > 0) {
        s.failCommit--;
        throw new Prisma.PrismaClientKnownRequestError('serialization', {
          code: 'P2034',
          clientVersion: '7.10.1',
        });
      }
      extension.beforeCommit?.(s);
    },
    basePath: extension.basePath ?? '/api/v1/manager',
    module: extension.module,
    snapshotFields: [
      'roots',
      'periods',
      'operations',
      'freezes',
      'grants',
      'financial',
      'lessons',
      'funding',
      ...(extension.snapshotFields ?? []),
    ],
    reset(s) {
      s.now = new Date('2026-10-31T10:00:00Z');
      for (const key of [
        'roots',
        'periods',
        'operations',
        'freezes',
        'grants',
        'financial',
        'plans',
        'enrollments',
        'funding',
        'lessons',
      ])
        s[key] = new Map();
      s.failCommit = 0;
      s.failPublication = false;
      s.legacyActive = false;
      s.queries = [];
      extension.reset?.(s);
    },
    configure(db, getState, accounts) {
      stateOf = getState;
      const state = () => getState(),
        original = db.$queryRaw.getMockImplementation();
      const decimalPlan = (p) =>
        p
          ? {
              ...p,
              price: new Prisma.Decimal(p.price),
              lesson_unit_price: new Prisma.Decimal(p.lesson_unit_price),
              discount_amount: new Prisma.Decimal(0),
            }
          : null;
      const decimalSub = (p) =>
        p
          ? {
              ...p,
              full_price: new Prisma.Decimal(p.full_price),
              original_paid_unit_price: new Prisma.Decimal(p.original_paid_unit_price),
              initial_discount_amount: new Prisma.Decimal(0),
            }
          : null;
      const total = (rootId) => {
        const ids = [...state().periods.values()]
          .filter((p) => p.manager_subscription_id === rootId)
          .map((p) => p.financial_subscription_id);
        return {
          total: ids.reduce((n, id) => n + state().financial.get(id).lesson_count, 0),
          remaining: [...state().grants.values()]
            .filter((g) => ids.includes(g.subscription_id))
            .reduce((n, g) => n + g.quantity - (g.consumed ?? 0), 0),
        };
      };
      db.$queryRaw.mockImplementation(async (parts, ...values) => {
        const sql = parts.text ?? parts.join('?'),
          params = parts.text ? parts.values : values,
          s = state();
        s.queries.push({ sql, params, text: parts.text ?? Prisma.sql(parts, ...values).text });
        if (sql.includes('clock_timestamp() AS now')) return [{ now: s.now }];
        if (sql.includes('AS paid') && sql.includes('AS eligible')) {
          const fin = [...s.funding.values()].find((p) => params.includes(p.id));
          return [
            {
              paid: fin?.paid ?? '0',
              latest: s.now,
              eligible:
                !!fin && fin.confirmed && fin.approved && fin.receiptPublished && fin.published,
            },
          ];
        }
        if (sql.includes('WITH RECURSIVE documents')) {
          if (s.failPublication) throw Error('private ledger source failure');
          const fin = s.funding.get(params[0]);
          return fin?.published ? [{ id: fin.publicationId }] : [];
        }
        if (sql.includes('FROM temporary_access_permissions p')) {
          const fin = [...s.funding.values()].find((p) => params.includes(p.subscription_id));
          return fin?.admission ? [{ id: randomUUID() }] : [];
        }
        if (sql.includes('AS exists')) return [{ exists: s.legacyActive }];
        if (sql.includes('AS total') && sql.includes('AS remaining'))
          return [total(params.find((x) => s.roots.has(x)))];
        if (sql.includes('FOR UPDATE OF s SKIP LOCKED'))
          return [...s.roots.values()]
            .filter(
              (r) =>
                (r.status === 'ACTIVE' && r.ends_at <= s.now) ||
                (r.status === 'FROZEN' &&
                  [...s.freezes.values()].some(
                    (fr) =>
                      fr.subscription_id === r.id && !fr.actual_ends_on && fr.ends_at <= s.now,
                  )),
            )
            .slice(0, 1)
            .map((r) => ({ id: r.id }));
        if (sql.includes('to_regclass')) return [{ ready: true }];
        if (sql.includes("'lessonsTotal'") && sql.includes(' AS data')) {
          const studentId = params.find((x) => s.students.has(x));
          const root = [...s.roots.values()].find(
            (r) => s.enrollments.get(r.enrollment_id).student_id === studentId,
          );
          if (!root) return [{ forbidden: false, data: null }];
          const b = total(root.id);
          const fr = [...s.freezes.values()].find(
            (fr) => fr.subscription_id === root.id && !fr.actual_ends_on,
          );
          return [
            {
              forbidden: false,
              data: {
                subscriptionId: root.id,
                planName: s.plans.get(root.current_plan_id).code,
                lessonsTotal: b.total,
                lessonsRemaining: b.remaining,
                validFrom: root.starts_at.toISOString(),
                validUntil: root.ends_at.toISOString(),
                frozenFrom: fr?.starts_at.toISOString() ?? null,
                frozenUntil: fr?.ends_at.toISOString() ?? null,
                isFrozen: !!fr,
                status: root.status,
              },
            },
          ];
        }
        if (sql.includes('FOR UPDATE')) return [{ id: params[0] }];
        return original(parts, ...values);
      });
      const sessionFind = db.session.findUnique.getMockImplementation();
      db.session.findUnique.mockImplementation(async (input) => {
        const row = await sessionFind(input);
        // Controlled business-clock advancement must not expire the test operator's session.
        return row
          ? { ...row, last_seen_at: state().now, expires_at: new Date('2100-01-01T00:00:00Z') }
          : null;
      });
      db.student.findUnique = jest.fn(async ({ where }) => state().students.get(where.id) ?? null);
      db.assignedManager.findFirst = jest.fn(async ({ where }) =>
        state().students.get(where.student_id)?.managerId === where.manager_id
          ? { id: randomUUID() }
          : null,
      );
      db.studentSubjectEnrollment = {
        findUnique: jest.fn(async ({ where }) => state().enrollments.get(where.id) ?? null),
        findUniqueOrThrow: jest.fn(async ({ where }) => state().enrollments.get(where.id)),
      };
      db.saleCondition = {
        findUnique: jest.fn(async ({ where }) => decimalPlan(state().plans.get(where.id))),
        findUniqueOrThrow: jest.fn(async ({ where }) => decimalPlan(state().plans.get(where.id))),
      };
      db.subscription = {
        findUnique: jest.fn(async ({ where }) => decimalSub(state().financial.get(where.id))),
        updateMany: jest.fn(async ({ where, data }) => {
          for (const id of where.id.in) Object.assign(state().financial.get(id), data);
          return { count: where.id.in.length };
        }),
      };
      db.paymentDistribution = {
        findFirst: jest.fn(async ({ where }) => {
          const p = state().funding.get(where.id);
          const sub = p && state().financial.get(p.subscription_id);
          if (
            !sub ||
            state().enrollments.get(sub.enrollment_id).student_id !==
              where.subscription_ref.enrollment_ref.student_id
          )
            return null;
          return {
            ...p,
            subscription_ref: {
              ...decimalSub(sub),
              sale_condition_ref: decimalPlan(state().plans.get(sub.sale_condition_id)),
            },
          };
        }),
        findUnique: jest.fn(async ({ where }) => {
          const d = state().funding.get(where.id);
          return d ? { ...d, approved_at: d.approved ? state().now : null } : null;
        }),
        aggregate: jest.fn(async ({ where }) => ({
          _sum: {
            amount: new Prisma.Decimal(
              [...state().funding.values()]
                .filter((p) => p.subscription_id === where.subscription_id && p.approved)
                .reduce((n, p) => n.add(p.paid), new Prisma.Decimal(0)),
            ),
          },
        })),
      };
      db.entitlementGrant = {
        aggregate: jest.fn(async ({ where }) => ({
          _sum: {
            quantity: [...state().grants.values()]
              .filter((g) => g.subscription_id === where.subscription_id)
              .reduce((n, g) => n + g.quantity, 0),
          },
        })),
        create: jest.fn(async ({ data }) => {
          const row = { id: randomUUID(), ...data };
          state().grants.set(row.id, row);
          return row;
        }),
      };
      db.managerSubscription = {
        findUnique: jest.fn(async ({ where, select }) => {
          const row = state().roots.get(where.id);
          return row && select?.enrollment_ref
            ? {
                enrollment_ref: {
                  student_id: state().enrollments.get(row.enrollment_id).student_id,
                },
              }
            : (row ?? null);
        }),
        findFirst: jest.fn(
          async ({ where }) =>
            [...state().roots.values()].find(
              (r) =>
                r.enrollment_id === where.enrollment_id &&
                r.status &&
                where.status.in.includes(r.status) &&
                r.id !== where.id?.not,
            ) ?? null,
        ),
        findMany: jest.fn(async ({ where }) =>
          [...state().roots.values()].filter(
            (r) =>
              state().enrollments.get(r.enrollment_id).student_id ===
              where.enrollment_ref.student_id,
          ),
        ),
        create: jest.fn(async ({ data }) => {
          const row = {
            freeze_days_used: 0,
            status: 'ACTIVE',
            created_at: state().now,
            updated_at: state().now,
            ...data,
          };
          state().roots.set(row.id, row);
          return row;
        }),
        update: jest.fn(async ({ where, data }) => {
          const row = state().roots.get(where.id);
          for (const [k, v] of Object.entries(data))
            row[k] = k === 'freeze_days_used' ? row[k] + v.increment : v;
          return row;
        }),
      };
      db.managerSubscriptionPeriod = {
        findUnique: jest.fn(
          async ({ where }) => state().periods.get(where.financial_subscription_id) ?? null,
        ),
        findMany: jest.fn(async ({ where }) =>
          [...state().periods.values()].filter(
            (p) => p.manager_subscription_id === where.manager_subscription_id,
          ),
        ),
        create: jest.fn(async ({ data }) => {
          state().periods.set(data.financial_subscription_id, data);
          return data;
        }),
      };
      db.managerSubscriptionOperation = {
        findUnique: jest.fn(
          async ({ where }) =>
            [...state().operations.values()].find(
              (o) => o.distribution_id === where.distribution_id,
            ) ?? null,
        ),
        create: jest.fn(async ({ data }) => {
          state().operations.set(data.id, data);
          return data;
        }),
      };
      db.subscriptionFreeze = {
        findFirst: jest.fn(
          async ({ where }) =>
            [...state().freezes.values()].find(
              (fr) => fr.subscription_id === where.subscription_id && !fr.actual_ends_on,
            ) ?? null,
        ),
        create: jest.fn(async ({ data }) => {
          const row = { id: randomUUID(), actual_ends_on: null, actual_ends_at: null, ...data };
          state().freezes.set(row.id, row);
          return row;
        }),
        update: jest.fn(async ({ where, data }) =>
          Object.assign(state().freezes.get(where.id), data),
        ),
      };
      db.lessonOccurrence = {
        findMany: jest.fn(async ({ where }) =>
          [...state().lessons.values()].filter(
            (l) =>
              l.enrollment_id === where.enrollment_id &&
              (typeof where.status === 'string'
                ? l.status === where.status
                : where.status.in.includes(l.status)) &&
              (!where.scheduled_at.gte || l.scheduled_at >= where.scheduled_at.gte) &&
              l.scheduled_at < where.scheduled_at.lt &&
              (!where.scheduled_end_at ||
                (l.scheduled_end_at ?? new Date(+l.scheduled_at + 3600000)) >
                  where.scheduled_end_at.gt),
          ),
        ),
        count: jest.fn(
          async ({ where }) =>
            [...state().lessons.values()].filter(
              (l) =>
                where.id.in.includes(l.id) &&
                (typeof where.status === 'string'
                  ? l.status === where.status
                  : where.status.in.includes(l.status)),
            ).length,
        ),
      };
      extension.configure?.(db, getState, accounts);
    },
  });
  const packageFor = (student, enrollmentId, planId, options = {}) => {
    const s = stateOf();
    enrollmentId ??= randomUUID();
    planId ??= randomUUID();
    s.enrollments.set(enrollmentId, {
      id: enrollmentId,
      student_id: student.id,
      status: 'ACTIVE',
      valid_from: new Date('2020-01-01'),
      valid_to: null,
    });
    if (!s.plans.has(planId))
      s.plans.set(planId, {
        id: planId,
        code: 'PLAN',
        duration_days: 30,
        price: '1000.0000',
        lesson_unit_price: '125.0000',
        lesson_count: 8,
        currency: 'MDL',
      });
    const plan = s.plans.get(planId),
      subId = randomUUID(),
      distId = randomUUID();
    s.financial.set(subId, {
      id: subId,
      enrollment_id: enrollmentId,
      sale_condition_id: planId,
      lesson_count: plan.lesson_count,
      full_price: plan.price,
      original_paid_unit_price: plan.lesson_unit_price,
      currency: plan.currency,
      valid_from: new Date(s.now),
      valid_to: null,
      frozen_from: null,
      frozen_until: null,
    });
    const row = {
      id: distId,
      payment_id: randomUUID(),
      subscription_id: subId,
      planId,
      enrollmentId,
      publicationId: randomUUID(),
      paid: plan.price,
      confirmed: true,
      approved: true,
      receiptPublished: true,
      published: true,
      admission: false,
      ...options,
    };
    s.funding.set(row.id, row);
    return row;
  };
  return { f, packageFor };
}
