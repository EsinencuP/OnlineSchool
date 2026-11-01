import { jest } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { Prisma } from '../../packages/db/dist/index.js';
import { managerPaymentsFixture, match } from './manager-payments-fixture.mjs';
const collision = () =>
  new Prisma.PrismaClientKnownRequestError('private conflicting student', {
    code: 'P2010',
    clientVersion: '7.10.1',
    meta: { driverAdapterError: { cause: { originalCode: '23P01' } } },
  });
export async function managerScheduleFixture(extension = {}) {
  const fixture = await managerPaymentsFixture({
    beforeCommit(s) {
      if (s.failExclusionOnCommit) {
        s.failExclusionOnCommit = false;
        throw collision();
      }
      extension.beforeCommit?.(s);
    },
    snapshotFields: [
      'approvals',
      'consumptions',
      'changeEvents',
      'jobs',
      ...(extension.snapshotFields ?? []),
    ],
    reset(s) {
      for (const k of ['teachers', 'assignments', 'approvals', 'consumptions']) s[k] = new Map();
      s.availability = [];
      s.changeEvents = [];
      s.jobs = [];
      s.reports = new Set();
      s.failExclusion = false;
      s.failExclusionOnCommit = false;
      s.failAfterApproval = false;
      extension.reset?.(s);
    },
    configure(db, getState, accounts) {
      const s = () => getState(),
        raw = db.$queryRaw.getMockImplementation();
      const consumed = (grantId) =>
        [...s().consumptions.values()]
          .filter((c) => c.grant_id === grantId && !c.cancelled_at)
          .reduce((n, c) => n + c.quantity, 0);
      const grantRemaining = (g) => g.quantity - consumed(g.id);
      const subRemaining = (id) =>
        [...s().grants.values()]
          .filter((g) => g.subscription_id === id)
          .reduce((n, g) => n + grantRemaining(g), 0);
      db.$queryRaw.mockImplementation(async (parts, ...values) => {
        const sql = parts.text ?? parts.join('?'),
          params = parts.text ? parts.values : values;
        let result;
        if (sql.includes('AS price') && sql.includes('FROM allocations')) {
          const id = params.find((x) => s().financial.has(x)),
            fin = s().financial.get(id);
          result = [
            {
              price: fin?.full_price ?? '1000',
              paid: s().rightsUnpaid ? '0' : (fin?.full_price ?? '1000'),
              remaining: subRemaining(id),
            },
          ];
        } else if (sql.includes('AS remaining FROM entitlement_grants')) {
          const g = s().grants.get(params[0]);
          result = [{ remaining: g ? grantRemaining(g) : 0 }];
        } else if (sql.includes('AS balance') && sql.includes('FROM entitlement_grants')) {
          result = [{ balance: String(subRemaining(params.find((x) => s().financial.has(x)))) }];
        } else if (sql.includes('SELECT EXISTS') && sql.includes(' AS ok')) {
          result = [
            {
              ok: !s().rightsUnpaid && [...s().grants.values()].some((g) => grantRemaining(g) > 0),
            },
          ];
        } else if (sql.includes('FROM teacher_availabilities WHERE')) {
          result = s().availability.filter(
            (a) => a.teacher_id === params[0] && a.starts_at <= params[1] && a.ends_at >= params[2],
          );
        } else if (
          sql.includes('SELECT s.id FROM staff_accounts') &&
          sql.includes('JOIN ledger_entries e')
        ) {
          const staff = accounts.find((a) => a.staffId === params[1]),
            entry = s().entries.get(params[0]),
            doc = entry && s().documents.get(entry.document_id),
            c = doc?.consumption_id && s().consumptions.get(doc.consumption_id);
          const fin = c && s().financial.get(c.subscription_id),
            student = fin && s().students.get(s().enrollments.get(fin.enrollment_id).student_id);
          result =
            staff?.role === 'MANAGER' && student?.managerId === staff.staffId
              ? [{ id: staff.staffId }]
              : [];
        }
        if (result !== undefined) {
          s().queries.push({ sql, params, text: parts.text ?? Prisma.sql(parts, ...values).text });
          return result;
        }
        return raw(parts, ...values);
      });
      const lesson = (r) =>
        r
          ? {
              ...r,
              enrollment_ref: s().enrollments.get(r.enrollment_id),
              scheduled_teacher_ref: {
                full_name: s().teachers.get(r.scheduled_teacher_id)?.full_name ?? 'Teacher',
              },
              teaching_assignment_ref: {
                google_meet_link:
                  s().assignments.get(r.teaching_assignment_id)?.google_meet_link ?? null,
              },
              t03_entitlementconsumption_lesson_occurrence_id: [
                ...s().consumptions.values(),
              ].filter((c) => c.lesson_occurrence_id === r.id && !c.cancelled_at),
              change_approvals: [...s().approvals.values()].filter(
                (a) => a.lesson_id === r.id && !a.consumed_at,
              ),
            }
          : null;
      const scoped = (r) => {
        const row = lesson(r),
          student = s().students.get(row.enrollment_ref.student_id);
        return {
          ...row,
          enrollment_ref: {
            ...row.enrollment_ref,
            student_ref: {
              manager_assignments: [
                {
                  manager_id: student.managerId,
                  assigned_at: new Date('2020-01-01'),
                  ended_at: null,
                },
              ],
            },
          },
        };
      };
      const lessonMatch = (r, w) => {
        const filter = w?.enrollment_ref?.student_ref;
        if (filter) {
          const manager = filter.manager_assignments.some.manager_id;
          if (
            s().students.get(s().enrollments.get(r.enrollment_id).student_id).managerId !== manager
          )
            return false;
        }
        const where = { ...w };
        if (where.enrollment_ref)
          where.enrollment_ref = { ...where.enrollment_ref, student_ref: undefined };
        if (where.enrollment_ref) delete where.enrollment_ref.student_ref;
        return match(scoped(r), where);
      };
      db.lessonOccurrence = {
        findUnique: jest.fn(async ({ where }) => lesson(s().lessons.get(where.id))),
        findFirst: jest.fn(async ({ where }) =>
          lesson([...s().lessons.values()].find((r) => lessonMatch(r, where))),
        ),
        findMany: jest.fn(async ({ where }) =>
          [...s().lessons.values()]
            .filter((r) => lessonMatch(r, where))
            .map(lesson)
            .sort((a, b) => +a.scheduled_at - +b.scheduled_at || a.id.localeCompare(b.id)),
        ),
        count: jest.fn(
          async ({ where }) =>
            [...s().lessons.values()].filter((r) => lessonMatch(r, where)).length,
        ),
        create: jest.fn(async ({ data }) => {
          if (s().failExclusion) throw collision();
          const r = {
            id: randomUUID(),
            manager_subscription_id: null,
            google_meet_link: null,
            meet_link_overridden: false,
            student_reschedule_count: 0,
            reschedule_history_verified: false,
            version: 1,
            confirmed_report_id: null,
            actual_start_at: null,
            ...data,
          };
          s().lessons.set(r.id, r);
          return lesson(r);
        }),
        update: jest.fn(async ({ where, data }) => {
          if (s().failExclusion && data.scheduled_at) throw collision();
          const r = s().lessons.get(where.id);
          for (const [k, v] of Object.entries(data))
            r[k] = v && typeof v === 'object' && 'increment' in v ? r[k] + v.increment : v;
          return lesson(r);
        }),
      };
      db.lessonOutcomeReport = {
        findFirst: jest.fn(async ({ where }) =>
          s().reports.has(where.lesson_occurrence_id) ? { id: randomUUID() } : null,
        ),
      };
      db.lessonActualOutcome = { findUnique: jest.fn(async () => null) };
      db.teacherAccount.findUnique = jest.fn(async ({ where }) => {
        const t = s().teachers.get(where.id);
        return t ? { ...t, account: { disabled_at: t.disabled_at ?? null } } : null;
      });
      db.teachingAssignment = {
        findMany: jest.fn(async ({ where }) =>
          [...s().assignments.values()].filter((a) => match(a, where)),
        ),
        findUnique: jest.fn(async ({ where }) => s().assignments.get(where.id) ?? null),
      };
      const rootFind = db.managerSubscription.findMany.getMockImplementation();
      db.managerSubscription.findMany.mockImplementation(async (input) =>
        (await rootFind(input)).filter((r) =>
          match(r, {
            ...(input.where.id ? { id: input.where.id } : {}),
            ...(input.where.enrollment_id ? { enrollment_id: input.where.enrollment_id } : {}),
          }),
        ),
      );
      db.entitlementGrant.findMany = jest.fn(async ({ where }) =>
        [...s().grants.values()].filter((g) => match(g, where)),
      );
      db.entitlementGrant.findUnique = jest.fn(
        async ({ where }) => s().grants.get(where.id) ?? null,
      );
      db.entitlementConsumption = {
        create: jest.fn(async ({ data }) => {
          if (
            [...s().consumptions.values()].some(
              (c) => c.lesson_occurrence_id === data.lesson_occurrence_id && !c.cancelled_at,
            )
          )
            throw new Prisma.PrismaClientKnownRequestError('duplicate', {
              code: 'P2002',
              clientVersion: '7.10.1',
            });
          const r = { id: randomUUID(), cancelled_at: null, ...data };
          s().consumptions.set(r.id, r);
          return r;
        }),
        findUniqueOrThrow: jest.fn(async ({ where }) => s().consumptions.get(where.id)),
      };
      db.scheduleChangeApproval = {
        findUnique: jest.fn(async ({ where }) =>
          where.id
            ? (s().approvals.get(where.id) ?? null)
            : ([...s().approvals.values()].find((a) =>
                match(a, where.lesson_id_lesson_version_request_hash),
              ) ?? null),
        ),
        create: jest.fn(async ({ data }) => {
          const r = {
            id: randomUUID(),
            created_at: s().now,
            approved_at: null,
            approved_by_id: null,
            consumed_at: null,
            ...data,
          };
          s().approvals.set(r.id, r);
          return r;
        }),
        update: jest.fn(async ({ where, data }) => {
          const r = s().approvals.get(where.id);
          Object.assign(r, data);
          return r;
        }),
      };
      db.lessonChangeEvent = {
        create: jest.fn(async ({ data }) => {
          s().changeEvents.push(data);
          return data;
        }),
      };
      db.jobRecord.create = jest.fn(async ({ data }) => {
        const row = { id: randomUUID(), ...data };
        s().jobs.push(row);
        return row;
      });
      const entryCreate = db.ledgerEntry.create.getMockImplementation();
      db.ledgerEntry.create.mockImplementation(async ({ data }) =>
        entryCreate({
          data: Object.fromEntries(
            Object.entries(data).map(([k, v]) => [
              k,
              Prisma.Decimal.isDecimal(v) ? v.toFixed(4) : v,
            ]),
          ),
        }),
      );
      db.crmTask.findUnique = jest.fn(
        async ({ where }) =>
          [...s().tasks.values()].find((t) => t.idempotency_key === where.idempotency_key) ?? null,
      );
      extension.configure?.(db, getState, accounts);
    },
  });
  const { f } = fixture;
  const readyFor = (student, options = {}) => {
    const pkg = fixture.packageFor(student),
      s = f.state,
      rootId = pkg.subscription_id;
    s.roots.set(rootId, {
      id: rootId,
      enrollment_id: pkg.enrollmentId,
      current_plan_id: pkg.planId,
      status: 'ACTIVE',
      starts_at: new Date('2026-10-30T00:00:00Z'),
      ends_at: new Date('2026-12-01T00:00:00Z'),
      timezone: 'Europe/Chisinau',
      freeze_days_used: 0,
      ...options,
    });
    s.periods.set(pkg.subscription_id, {
      financial_subscription_id: pkg.subscription_id,
      manager_subscription_id: rootId,
    });
    const grant = {
      id: randomUUID(),
      subscription_id: pkg.subscription_id,
      payment_distribution_id: pkg.id,
      quantity: 8,
      granted_at: s.now,
      basis: 'CONFIRMED_PAYMENT',
    };
    s.grants.set(grant.id, grant);
    const teacher = { id: randomUUID(), full_name: 'Teacher', deactivated_at: null };
    s.teachers.set(teacher.id, teacher);
    const assignment = {
      id: randomUUID(),
      enrollment_id: pkg.enrollmentId,
      teacher_id: teacher.id,
      valid_from: new Date('2020-01-01'),
      valid_to: null,
      google_meet_link: 'https://meet.google.com/abc-defg-hij',
    };
    s.assignments.set(assignment.id, assignment);
    s.availability.push({
      id: randomUUID(),
      teacher_id: teacher.id,
      starts_at: new Date('2026-10-01'),
      ends_at: new Date('2027-12-01'),
    });
    return {
      pkg,
      subscriptionId: rootId,
      teacherId: teacher.id,
      assignmentId: assignment.id,
      grantId: grant.id,
    };
  };
  return { ...fixture, readyFor };
}
