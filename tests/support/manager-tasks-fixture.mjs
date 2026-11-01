import { jest } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { Prisma } from '../../packages/db/dist/index.js';
import { managerScheduleFixture } from './manager-schedule-fixture.mjs';
import { match } from './manager-payments-fixture.mjs';
export async function managerTasksFixture() {
  const fx = await managerScheduleFixture({
    snapshotFields: ['adjustments'],
    reset(s) {
      s.adjustments = new Map();
      s.failTaskCas = false;
    },
    configure(db, getState) {
      const s = () => getState();
      const task = (r) =>
        r
          ? {
              ...r,
              student: r.student_id
                ? {
                    ...s().students.get(r.student_id),
                    manager_assignments: [
                      {
                        manager_id: s().students.get(r.student_id)?.managerId,
                        assigned_at: new Date('2020-01-01'),
                        ended_at: null,
                      },
                    ],
                  }
                : null,
              lesson: r.lesson_id
                ? {
                    ...s().lessons.get(r.lesson_id),
                    enrollment_ref: s().enrollments.get(
                      s().lessons.get(r.lesson_id)?.enrollment_id,
                    ),
                  }
                : null,
            }
          : null;
      const tasks = (where) => [...s().tasks.values()].map(task).filter((r) => match(r, where));
      db.crmTask = {
        create: jest.fn(async ({ data }) => {
          const row = {
            id: randomUUID(),
            status: 'OPEN',
            version: 1,
            escalated_at: null,
            decision: null,
            original_consumption_id: null,
            ledger_publication_id: null,
            dispute_resolution_key: null,
            lesson_id: null,
            payload: null,
            student_id: null,
            lead_id: null,
            created_at: s().now,
            resolved_at: null,
            resolved_by_staff_id: null,
            ...data,
          };
          s().tasks.set(row.id, row);
          return task(row);
        }),
        findFirst: jest.fn(async ({ where }) => tasks(where)[0] ?? null),
        findUnique: jest.fn(async ({ where }) => tasks(where)[0] ?? null),
        findMany: jest.fn(async ({ where, take }) =>
          tasks(where)
            .sort((a, b) => +a.due_at - +b.due_at || a.id.localeCompare(b.id))
            .slice(0, take),
        ),
        updateMany: jest.fn(async ({ where, data }) => {
          if (s().failTaskCas) return { count: 0 };
          const rows = tasks(where);
          for (const r of rows) {
            const row = s().tasks.get(r.id);
            for (const [k, v] of Object.entries(data))
              row[k] = v && typeof v === 'object' && 'increment' in v ? row[k] + v.increment : v;
          }
          return { count: rows.length };
        }),
      };
      const orig = db.managerSubscription.findFirst.getMockImplementation();
      db.managerSubscription.findFirst.mockImplementation(async (input) => {
        if (!input.where.id) return orig(input);
        return (
          [...s().roots.values()].find(
            (r) =>
              r.id === input.where.id &&
              s().enrollments.get(r.enrollment_id).student_id ===
                input.where.enrollment_ref.student_id,
          ) ?? null
        );
      });
      const source = async (r) => {
        if (!r) return null;
        const sub = await db.subscription.findUnique({ where: { id: r.subscription_id } }),
          doc = [...s().documents.values()].find((d) => d.consumption_id === r.id);
        return {
          ...r,
          subscription_ref: sub,
          ledger_document: doc
            ? {
                ...doc,
                t03_ledgerentry_document_id:
                  [...s().entries.values()].find((e) => e.document_id === doc.id) ?? null,
              }
            : null,
        };
      };
      db.entitlementConsumption.findMany = jest.fn(async ({ where, take }) =>
        (await Promise.all([...s().consumptions.values()].map(source)))
          .filter((r) => match(r, where))
          .slice(0, take),
      );
      db.entitlementConsumption.findFirst = jest.fn(
        async ({ where }) => (await db.entitlementConsumption.findMany({ where }))[0] ?? null,
      );
      db.entitlementConsumption.findUnique = jest.fn(
        async ({ where }) => s().consumptions.get(where.id) ?? null,
      );
      db.entitlementConsumption.update = jest.fn(async ({ where, data }) =>
        Object.assign(s().consumptions.get(where.id), data),
      );
      db.entitlementAdjustment = {
        findFirst: jest.fn(
          async ({ where }) => [...s().adjustments.values()].find((r) => match(r, where)) ?? null,
        ),
        create: jest.fn(async ({ data }) => {
          if (
            [...s().adjustments.values()].some(
              (a) => a.source_operation_id === data.source_operation_id,
            )
          )
            throw new Prisma.PrismaClientKnownRequestError('duplicate', {
              code: 'P2002',
              clientVersion: '7.10.1',
            });
          const row = { id: randomUUID(), ...data };
          s().adjustments.set(row.id, row);
          return row;
        }),
      };
      db.lessonOccurrence.findUniqueOrThrow = db.lessonOccurrence.findUnique;
      db.ledgerDocument.findUniqueOrThrow = db.ledgerDocument.findUnique;
      db.ledgerEntry.findFirst = jest.fn(
        async ({ where }) => [...s().entries.values()].find((e) => match(e, where)) ?? null,
      );
      db.ledgerLine.findMany = jest.fn(async ({ where }) =>
        s()
          .lines.filter((l) => match(l, where))
          .map((l) => ({ ...l, amount: new Prisma.Decimal(l.amount) })),
      );
    },
  });
  const { f } = fx;
  const addTask = async (student, type = 'MANUAL', extra = {}) =>
    f.client.crmTask.create({
      data: {
        student_id: student.id,
        type,
        title: 'Own task',
        due_at: new Date(+f.state.now + 86400000),
        ...extra,
      },
    });
  const charged = async (student, ready) => {
    const lesson = await f.api('post', `/api/v1/manager/students/${student.id}/lessons`, 0, {
      key: randomUUID(),
      body: {
        teacherId: ready.teacherId,
        subscriptionId: ready.subscriptionId,
        startsAt: '2026-10-31T12:00:00Z',
        durationMinutes: 60,
      },
    });
    if (lesson.status !== 201) throw Error(JSON.stringify(lesson.body));
    const cancelled = await f.api(
      'post',
      `/api/v1/manager/lessons/${lesson.body.lessonId}/cancel`,
      0,
      { key: randomUUID(), body: { chargeable: true, reason: 'Late student cancellation' } },
    );
    if (cancelled.status !== 200) throw Error(JSON.stringify(cancelled.body));
    return {
      lessonId: lesson.body.lessonId,
      consumptionId: [...f.state.consumptions.values()].find(
        (c) => c.lesson_occurrence_id === lesson.body.lessonId,
      ).id,
    };
  };
  return { ...fx, addTask, charged };
}
