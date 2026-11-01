import { jest } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { Prisma } from '../../packages/db/dist/index.js';
import { AppModule } from '../../apps/api/dist/app.module.js';
import { managerSubscriptionsFixture } from './manager-subscriptions-fixture.mjs';
const decimal = (v) => new Prisma.Decimal(v ?? 0);
const unique = () =>
  new Prisma.PrismaClientKnownRequestError('duplicate', { code: 'P2002', clientVersion: '7.10.1' });
export function match(row, where) {
  if (!where) return true;
  if (!row) return false;
  return Object.entries(where).every(([key, value]) => {
    if (key === 'AND') return (Array.isArray(value) ? value : [value]).every((w) => match(row, w));
    if (key === 'OR') return value.some((w) => match(row, w));
    if (key === 'NOT') return !(Array.isArray(value) ? value : [value]).some((w) => match(row, w));
    const actual = row[key];
    if (value === null) return actual == null;
    if (value instanceof Date) return actual instanceof Date && +actual === +value;
    if (typeof value !== 'object') return actual === value;
    if ('some' in value)
      return Array.isArray(actual) && actual.some((row) => match(row, value.some));
    if ('is' in value) return value.is === null ? actual == null : match(actual, value.is);
    if ('not' in value) return value.not === null ? actual != null : actual !== value.not;
    if ('in' in value) return value.in.includes(actual);
    if ('gt' in value) return actual > value.gt;
    if ('gte' in value) return actual >= value.gte;
    if ('lt' in value) return actual < value.lt;
    if ('lte' in value) return actual <= value.lte;
    return match(actual, value);
  });
}
export async function managerPaymentsFixture(extension = {}) {
  const fixture = await managerSubscriptionsFixture({
    beforeCommit: extension.beforeCommit,
    module: AppModule,
    basePath: '',
    snapshotFields: [
      'receipts',
      'documents',
      'entries',
      'lines',
      'permissions',
      'tasks',
      ...(extension.snapshotFields ?? []),
    ],
    reset(s) {
      for (const key of ['receipts', 'documents', 'entries', 'permissions', 'tasks'])
        s[key] = new Map();
      s.lines = [];
      s.closedPeriod = false;
      s.failLedger = false;
      s.unbalanced = false;
      s.periodId = randomUUID();
      extension.reset?.(s);
    },
    configure(db, getState, accounts) {
      const s = () => getState(),
        originalQuery = db.$queryRaw.getMockImplementation();
      const receipt = (r) =>
        r
          ? {
              ...r,
              amount: decimal(r.amount),
              t03_ledgerdocument_payment_id: docFor('payment_id', r.id),
            }
          : null;
      const docFor = (field, id) => {
        const d = [...s().documents.values()].find((d) => d[field] === id);
        return d
          ? {
              ...d,
              t03_ledgerentry_document_id:
                [...s().entries.values()].find((e) => e.document_id === d.id) ?? null,
            }
          : null;
      };
      const sub = (r) =>
        r
          ? {
              ...r,
              full_price: decimal(r.full_price),
              original_paid_unit_price: decimal(r.original_paid_unit_price),
              initial_discount_amount: decimal(r.initial_discount_amount),
              enrollment_ref: s().enrollments.get(r.enrollment_id),
              sale_condition_ref: plan(s().plans.get(r.sale_condition_id)),
            }
          : null;
      const plan = (r) =>
        r
          ? {
              valid_from: new Date('2020-01-01'),
              valid_to: null,
              discount_amount: decimal(0),
              ...r,
              price: decimal(r.price),
              lesson_unit_price: decimal(r.lesson_unit_price),
            }
          : null;
      const dist = (r) =>
        r
          ? {
              ...r,
              amount: decimal(r.amount ?? r.paid),
              approved_at: r.approved_at ?? (r.approved ? s().now : null),
              subscription_ref: sub(s().financial.get(r.subscription_id)),
              payment_ref: receipt(s().receipts.get(r.payment_id)),
              ledger_document: docFor('distribution_id', r.id),
              manager_operation:
                [...s().operations.values()].find((o) => o.distribution_id === r.id) ?? null,
            }
          : null;
      const receiptRows = (where) =>
        [...s().receipts.values()].map(receipt).filter((r) => match(r, where));
      const distRows = (where) =>
        [...s().funding.values()].map(dist).filter((r) => match(r, where));
      const page = (rows, { take, skip = 0 }) =>
        rows
          .sort((a, b) => +b.created_at - +a.created_at || b.id.localeCompare(a.id))
          .slice(skip, take === undefined ? undefined : skip + take);
      db.$queryRaw.mockImplementation(async (parts, ...values) => {
        const sql = parts.text ?? parts.join('?'),
          params = parts.text ? parts.values : values;
        if (sql.includes('SELECT s.id FROM staff_accounts'))
          return accounts.some((a) => a.staffId === params[0] && a.role === 'DIRECTOR')
            ? [{ id: params[0] }]
            : [];
        if (
          sql.includes('SELECT id,closed_at FROM financial_periods') ||
          sql.includes('SELECT closed_at FROM financial_periods')
        )
          return [{ id: s().periodId, closed_at: s().closedPeriod ? s().now : null }];
        if (sql.includes('sum(amount) FILTER')) {
          const rows = s().lines.filter((l) => l.entry_id === params[0]);
          return [...new Set(rows.map((l) => l.currency))].map((currency) => ({
            currency,
            debit: rows
              .filter((l) => l.currency === currency && l.direction === 'DEBIT')
              .reduce((a, l) => a.add(l.amount), decimal(0))
              .toFixed(4),
            credit: s().unbalanced
              ? '0.0001'
              : rows
                  .filter((l) => l.currency === currency && l.direction === 'CREDIT')
                  .reduce((a, l) => a.add(l.amount), decimal(0))
                  .toFixed(4),
            count: BigInt(rows.length),
          }));
        }
        if (sql.includes('FROM allocations') && sql.includes('AS paid')) {
          const id = params.find((x) => s().financial.has(x)),
            specific = params.find((x) => s().funding.has(x));
          const rows = distRows({ subscription_id: id }).filter(
            (d) =>
              d.approved_at &&
              d.payment_ref?.confirmed_by_director_at &&
              d.payment_ref.t03_ledgerdocument_payment_id?.t03_ledgerentry_document_id
                ?.published_at &&
              d.ledger_document?.t03_ledgerentry_document_id?.published_at,
          );
          return [
            {
              paid: rows.reduce((a, d) => a.add(d.amount), decimal(0)).toFixed(4),
              latest: s().now,
              eligible: rows.some((d) => d.id === specific),
            },
          ];
        }
        return originalQuery(parts, ...values);
      });
      db.paymentReceipt = {
        findUnique: jest.fn(async ({ where }) => receipt(s().receipts.get(where.id))),
        findUniqueOrThrow: jest.fn(async ({ where }) => receipt(s().receipts.get(where.id))),
        findFirst: jest.fn(async ({ where }) => receiptRows(where)[0] ?? null),
        findMany: jest.fn(async (input) => page(receiptRows(input.where), input)),
        count: jest.fn(async ({ where }) => receiptRows(where).length),
        create: jest.fn(async ({ data }) => {
          if (
            data.external_reference &&
            [...s().receipts.values()].some(
              (r) => r.method === data.method && r.external_reference === data.external_reference,
            )
          )
            throw unique();
          const r = {
            id: randomUUID(),
            method: null,
            purpose: null,
            manager_note: null,
            received_at: null,
            approval_requested_at: null,
            rejected_at: null,
            rejection_reason: null,
            rejected_by_staff_id: null,
            confirmed_by_director_at: null,
            confirmed_by_director_id: null,
            external_reference: null,
            created_at: s().now,
            updated_at: s().now,
            ...data,
            amount: data.amount.toFixed(4),
          };
          s().receipts.set(r.id, r);
          return receipt(r);
        }),
        update: jest.fn(async ({ where, data }) => {
          Object.assign(s().receipts.get(where.id), data);
          return receipt(s().receipts.get(where.id));
        }),
      };
      db.subscription.findUnique = jest.fn(async ({ where }) => sub(s().financial.get(where.id)));
      db.subscription.findUniqueOrThrow = jest.fn(async ({ where }) =>
        sub(s().financial.get(where.id)),
      );
      db.subscription.create = jest.fn(async ({ data }) => {
        const r = {
          id: randomUUID(),
          valid_to: null,
          frozen_from: null,
          frozen_until: null,
          ...data,
          full_price: data.full_price.toFixed(4),
          original_paid_unit_price: data.original_paid_unit_price.toFixed(4),
          initial_discount_amount: data.initial_discount_amount.toFixed(4),
        };
        s().financial.set(r.id, r);
        return sub(r);
      });
      db.saleCondition.findUnique = jest.fn(async ({ where }) => plan(s().plans.get(where.id)));
      db.saleCondition.findUniqueOrThrow = db.saleCondition.findUnique;
      db.paymentDistribution = {
        create: jest.fn(async ({ data }) => {
          if (
            [...s().funding.values()].some(
              (d) => d.payment_id === data.payment_id && d.subscription_id === data.subscription_id,
            )
          )
            throw unique();
          const r = {
            id: randomUUID(),
            publicationId: randomUUID(),
            approved_at: null,
            approved_by_director_id: null,
            approved: false,
            published: false,
            ...data,
            amount: data.amount.toFixed(4),
            paid: data.amount.toFixed(4),
            created_at: s().now,
          };
          s().funding.set(r.id, r);
          return dist(r);
        }),
        findFirst: jest.fn(async ({ where }) => distRows(where)[0] ?? null),
        findUnique: jest.fn(async ({ where }) => dist(s().funding.get(where.id))),
        findUniqueOrThrow: jest.fn(async ({ where }) => dist(s().funding.get(where.id))),
        update: jest.fn(async ({ where, data }) => {
          const r = s().funding.get(where.id);
          Object.assign(r, data);
          r.approved = !!r.approved_at;
          return dist(r);
        }),
        aggregate: jest.fn(async ({ where }) => ({
          _sum: { amount: distRows(where).reduce((a, d) => a.add(d.amount), decimal(0)) },
        })),
        findMany: jest.fn(async (input) => page(distRows(input.where), input)),
        count: jest.fn(async ({ where }) => distRows(where).length),
      };
      db.ledgerDocument = {
        create: jest.fn(async ({ data }) => {
          const r = { id: randomUUID(), ...data };
          s().documents.set(r.id, r);
          return r;
        }),
        findUnique: jest.fn(
          async ({ where }) =>
            [...s().documents.values()].find((d) =>
              Object.entries(where).every(([k, v]) => d[k] === v),
            ) ?? null,
        ),
      };
      db.ledgerEntry = {
        create: jest.fn(async ({ data }) => {
          if (s().failLedger) throw Error('private bank details');
          const r = { id: randomUUID(), published_at: null, ...data };
          s().entries.set(r.id, r);
          return r;
        }),
        findUnique: jest.fn(
          async ({ where }) =>
            [...s().entries.values()].find((e) =>
              Object.entries(where).every(([k, v]) => e[k] === v),
            ) ?? null,
        ),
        findUniqueOrThrow: jest.fn(async ({ where }) => s().entries.get(where.id)),
        update: jest.fn(async ({ where, data }) => {
          const e = s().entries.get(where.id);
          Object.assign(e, data);
          const d = s().documents.get(e.document_id);
          if (d.distribution_id) {
            const source = s().funding.get(d.distribution_id);
            source.published = !!e.published_at;
            source.publicationId = e.id;
          }
          return e;
        }),
      };
      db.ledgerLine = {
        createMany: jest.fn(async ({ data }) => {
          s().lines.push(...data.map((l) => ({ ...l, amount: l.amount.toFixed(4) })));
          return { count: data.length };
        }),
      };
      db.assignedManager.findFirst = jest.fn(async ({ where }) => {
        const row = s().students.get(where.student_id);
        return row && (!where.manager_id || where.manager_id === row.managerId)
          ? { id: randomUUID(), manager_id: row.managerId }
          : null;
      });
      db.crmTask = {
        create: jest.fn(async ({ data }) => {
          const row = { id: randomUUID(), ...data };
          s().tasks.set(row.id, row);
          return row;
        }),
      };
      db.temporaryAccessPermission = {
        findMany: jest.fn(async ({ where }) =>
          [...s().permissions.values()].filter((p) => match(p, where)),
        ),
        update: jest.fn(async ({ where, data }) =>
          Object.assign(s().permissions.get(where.id), data),
        ),
        create: jest.fn(async ({ data }) => {
          const r = { id: randomUUID(), revoked_at: null, ...data };
          s().permissions.set(r.id, r);
          return r;
        }),
      };
      const outbox = db.outboxEvent.create.getMockImplementation();
      db.outboxEvent.create.mockImplementation(async (input) => {
        const row = await outbox(input);
        row.id ??= randomUUID();
        return row;
      });
      db.jobRecord = { create: jest.fn(async ({ data }) => ({ id: randomUUID(), ...data })) };
      extension.configure?.(db, getState, accounts);
    },
  });
  const planFor = (student, overrides = {}) => {
    const s = fixture.f.state,
      id = randomUUID(),
      planId = randomUUID();
    s.enrollments.set(id, {
      id,
      student_id: student.id,
      status: 'ACTIVE',
      valid_from: new Date('2020-01-01'),
      valid_to: null,
    });
    s.plans.set(planId, {
      id: planId,
      code: 'PLAN',
      duration_days: 30,
      price: '1000.0000',
      lesson_unit_price: '125.0000',
      lesson_count: 8,
      currency: 'MDL',
      ...overrides,
    });
    return { enrollmentId: id, planId };
  };
  return { ...fixture, planFor };
}
