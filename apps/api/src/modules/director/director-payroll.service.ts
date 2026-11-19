import { Injectable } from '@nestjs/common';
import { Prisma } from '@online-school/db';
import { err, ok } from '@online-school/shared';
import type { Result } from '@online-school/shared';
import { DatabaseService } from '../../core/database/database.module.js';
import { AppException, domainError } from '../../core/errors/domain-error.js';
import type { DomainError } from '../../core/errors/domain-error.js';
import type { CriticalContext } from '../../core/http.js';
import { TransactionService } from '../../core/transaction/transaction.service.js';
import { at } from '../finance/finance-common.js';
import { FinanceAccess } from '../finance/finance-access.service.js';
import { PeriodsService } from '../finance/periods.service.js';
import {
  openPeriodDisputes,
  periodClosureBlockers,
  periodDisputesRevision,
} from '../finance/period-disputes.js';
import type { PeriodDisputeSource } from '../finance/period-disputes.js';
import type {
  PayrollSummaryDto,
  PayrollTeacherDto,
  PayrollTeacherRowDto,
  PayrollTotalDto,
  PeriodDto,
  PeriodDisputesDto,
  PeriodListDto,
  UnresolvedDto,
  UnresolvedItemDto,
} from './dto/director-payroll.dto.js';
import { UNRESOLVED_KINDS } from './dto/director-payroll.dto.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = 86_400_000;
const CAP = 100;
const failure = (error: unknown): DomainError =>
  error instanceof AppException ? error.domain : domainError('DATABASE_ERROR', 503);

type Money = { accrued: string; paid: string; outstanding: string };
const money = (r: { accrued: string; paid: string }): Money => ({
  accrued: r.accrued,
  paid: r.paid,
  outstanding: new Prisma.Decimal(r.accrued).minus(r.paid).toFixed(4),
});

// Date scopes for the open-items read model.
const blockerSql = (from: Date | null, to: Date | null) => {
  const lessonRange =
    from && to
      ? Prisma.sql`AND l.scheduled_at >= ${from} AND l.scheduled_at < ${to}`
      : Prisma.empty;
  const attemptRange =
    from && to
      ? Prisma.sql`AND pa.attempted_at >= ${from} AND pa.attempted_at < ${to}`
      : Prisma.empty;
  return { lessonRange, attemptRange };
};

/** DIR-03/DIR-04: what the school owes teachers, what blocks a period and who may close it. */
@Injectable()
export class DirectorPayrollService {
  constructor(
    private readonly db: DatabaseService,
    private readonly periods: PeriodsService,
    private readonly access: FinanceAccess,
    private readonly transactions: TransactionService,
  ) {}

  private async period(id: string) {
    return this.db.client.financialPeriod.findUnique({ where: { id } });
  }

  async summary(periodId?: string): Promise<Result<PayrollSummaryDto, DomainError>> {
    try {
      if (periodId && !UUID_RE.test(periodId)) return err(domainError('PERIOD_NOT_FOUND', 404));
      if (periodId && !(await this.period(periodId)))
        return err(domainError('PERIOD_NOT_FOUND', 404));
      const scope = periodId
        ? Prisma.sql`AND a.financial_period_id = ${periodId}::uuid`
        : Prisma.empty;
      const rows = await this.db.client.$queryRaw<
        {
          teacher_id: string;
          teacher_name: string;
          currency: string;
          accrued: string;
          paid: string;
          open_attempts: number;
        }[]
      >(Prisma.sql`
        SELECT t.id AS teacher_id, t.full_name AS teacher_name, a.currency,
          sum(a.amount)::text AS accrued,
          COALESCE(sum((SELECT sum(cp.amount) FROM payout_attempts pa JOIN confirmed_payouts cp ON cp.attempt_id = pa.id
                        WHERE pa.obligation_id = o.id)), 0)::text AS paid,
          COALESCE(sum((SELECT count(*) FROM payout_attempts pa LEFT JOIN confirmed_payouts cp ON cp.attempt_id = pa.id
                        WHERE pa.obligation_id = o.id AND (pa.status IN ('PENDING','UNKNOWN') OR (pa.status = 'SUCCEEDED' AND cp.id IS NULL)))), 0)::int AS open_attempts
        FROM teacher_accruals a
        JOIN teacher_accounts t ON t.id = a.teacher_id
        LEFT JOIN payroll_obligations o ON o.accrual_id = a.id
        WHERE true ${scope}
        GROUP BY t.id, t.full_name, a.currency`);
      const teachers: PayrollTeacherRowDto[] = rows
        .map((r) => ({
          teacherId: r.teacher_id,
          teacherName: r.teacher_name,
          currency: r.currency,
          ...money(r),
          openAttempts: r.open_attempts,
        }))
        .sort(
          (x, y) =>
            new Prisma.Decimal(y.outstanding).comparedTo(x.outstanding) ||
            x.teacherName.localeCompare(y.teacherName),
        );
      const byCurrency = new Map<string, { accrued: Prisma.Decimal; paid: Prisma.Decimal }>();
      for (const r of rows) {
        const sum = byCurrency.get(r.currency) ?? {
          accrued: new Prisma.Decimal(0),
          paid: new Prisma.Decimal(0),
        };
        byCurrency.set(r.currency, {
          accrued: sum.accrued.plus(r.accrued),
          paid: sum.paid.plus(r.paid),
        });
      }
      const totals: PayrollTotalDto[] = [...byCurrency]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([currency, s]) => ({
          currency,
          ...money({ accrued: s.accrued.toFixed(4), paid: s.paid.toFixed(4) }),
        }));
      return ok({ periodId: periodId ?? null, totals, teachers });
    } catch (error: unknown) {
      return err(failure(error));
    }
  }

  async teacher(teacherId: string): Promise<Result<PayrollTeacherDto, DomainError>> {
    if (!UUID_RE.test(teacherId)) return err(domainError('TEACHER_NOT_FOUND', 404));
    try {
      const teacher = await this.db.client.teacherAccount.findUnique({
        where: { id: teacherId },
        select: { id: true, full_name: true },
      });
      if (!teacher) return err(domainError('TEACHER_NOT_FOUND', 404));
      const rows = await this.db.client.$queryRaw<
        {
          obligation_id: string;
          accrual_id: string;
          lesson_id: string;
          recognized_at: Date;
          currency: string;
          amount: string;
          paid: string;
          open_attempts: number;
          exception: boolean;
        }[]
      >(Prisma.sql`
        SELECT o.id AS obligation_id, a.id AS accrual_id, out.lesson_occurrence_id AS lesson_id, a.recognized_at,
               a.currency, a.amount::text AS amount,
               COALESCE((SELECT sum(cp.amount) FROM payout_attempts pa JOIN confirmed_payouts cp ON cp.attempt_id = pa.id
                         WHERE pa.obligation_id = o.id), 0)::text AS paid,
               (SELECT count(*) FROM payout_attempts pa LEFT JOIN confirmed_payouts cp ON cp.attempt_id = pa.id
                 WHERE pa.obligation_id = o.id AND (pa.status IN ('PENDING','UNKNOWN') OR (pa.status = 'SUCCEEDED' AND cp.id IS NULL)))::int AS open_attempts,
               (a.exception_authorized_by_id IS NOT NULL) AS exception
        FROM teacher_accruals a
        JOIN payroll_obligations o ON o.accrual_id = a.id
        JOIN lesson_actual_outcomes out ON out.id = a.lesson_actual_outcome_id
        WHERE a.teacher_id = ${teacherId}::uuid
        ORDER BY a.recognized_at DESC, o.id DESC LIMIT 200`);
      const obligations = rows.map((r) => ({
        obligationId: r.obligation_id,
        accrualId: r.accrual_id,
        lessonId: r.lesson_id,
        recognizedAt: r.recognized_at.toISOString(),
        currency: r.currency,
        amount: r.amount,
        ...money({ accrued: r.amount, paid: r.paid }),
        openAttempts: r.open_attempts,
        exception: r.exception,
      }));
      const totals = new Map<string, { accrued: Prisma.Decimal; paid: Prisma.Decimal }>();
      for (const o of obligations) {
        const s = totals.get(o.currency) ?? {
          accrued: new Prisma.Decimal(0),
          paid: new Prisma.Decimal(0),
        };
        totals.set(o.currency, { accrued: s.accrued.plus(o.amount), paid: s.paid.plus(o.paid) });
      }
      return ok({
        teacherId: teacher.id,
        teacherName: teacher.full_name,
        totals: [...totals].map(([currency, s]) => ({
          currency,
          ...money({ accrued: s.accrued.toFixed(4), paid: s.paid.toFixed(4) }),
        })),
        obligations: obligations.map(({ paid, outstanding, ...rest }) => ({
          ...rest,
          paid,
          outstanding,
        })),
      });
    } catch (error: unknown) {
      return err(failure(error));
    }
  }

  private async blockerCounts(from: Date | null, to: Date | null) {
    const { lessonRange, attemptRange } = blockerSql(from, to);
    const [row] = await this.db.client.$queryRaw<
      { unaccrued: number; disputed: number; attempts: number; drafts: number }[]
    >(Prisma.sql`
      SELECT
        (SELECT count(*) FROM lesson_occurrences l LEFT JOIN lesson_actual_outcomes o ON o.lesson_occurrence_id = l.id
          LEFT JOIN teacher_accruals a ON a.lesson_actual_outcome_id = o.id
          WHERE l.status = 'CONDUCTED' AND (o.id IS NULL OR a.id IS NULL) ${lessonRange})::int AS unaccrued,
        (SELECT count(*) FROM lesson_occurrences l WHERE l.status = 'DISPUTED' ${lessonRange})::int AS disputed,
        (SELECT count(*) FROM payout_attempts pa WHERE pa.status IN ('PENDING','UNKNOWN') ${attemptRange})::int AS attempts,
        (SELECT count(*) FROM ledger_entries e WHERE e.published_at IS NULL
          ${from && to ? Prisma.sql`AND e.financial_period_id IN (SELECT id FROM financial_periods WHERE starts_at = ${from} AND ends_at = ${to})` : Prisma.empty})::int AS drafts`);
    return row!;
  }

  async list(): Promise<Result<PeriodListDto, DomainError>> {
    try {
      const now = await at(this.db.client);
      const rows = await this.db.client.financialPeriod.findMany({
        orderBy: { starts_at: 'desc' },
        take: 60,
      });
      const items: PeriodDto[] = [];
      for (const p of rows) {
        const finished = p.ends_at <= now;
        const blockers = p.closed_at
          ? 0
          : Object.values(await periodClosureBlockers(this.db.client, p)).reduce(
              (a, b) => a + b,
              0,
            );
        items.push({
          id: p.id,
          startsAt: p.starts_at.toISOString(),
          endsAt: p.ends_at.toISOString(),
          closedAt: p.closed_at?.toISOString() ?? null,
          finished,
          blockers,
          readyToClose: finished && !p.closed_at && blockers === 0,
        });
      }
      return ok({ items });
    } catch (error: unknown) {
      return err(failure(error));
    }
  }

  async disputes(id: string, page: number): Promise<Result<PeriodDisputesDto, DomainError>> {
    if (!UUID_RE.test(id)) return err(domainError('PERIOD_NOT_FOUND', 404));
    return this.transactions.runReadOnly<PeriodDisputesDto>(async (tx) => {
      const period = await tx.financialPeriod.findUnique({ where: { id } });
      if (!period) return err(domainError('PERIOD_NOT_FOUND', 404));
      const meta = {
        periodId: period.id,
        startsAt: period.starts_at.toISOString(),
        endsAt: period.ends_at.toISOString(),
        closedAt: period.closed_at?.toISOString() ?? null,
        closedById: period.closed_by_id,
        page,
      };
      const projection = (row: PeriodDisputeSource) => ({
        lessonId: row.lesson_id,
        taskId: row.task_id,
        reportId: row.report_id,
        sourceEntryId: row.source_entry_id,
        sourceVersion: row.source_version,
      });
      const skip = (page - 1) * CAP;
      if (!period.closed_at) {
        const rows = await openPeriodDisputes(tx, period);
        return ok({
          ...meta,
          revision: periodDisputesRevision(period.id, rows),
          total: rows.length,
          items: rows.slice(skip, skip + CAP).map((row) => ({
            ...projection(row),
            managerId: row.manager_id,
            managerAtCloseId: null,
            currentStatus: row.status_at_close,
            statusAtClose: null,
            resolvedAt: null,
            correctionEntryId: null,
          })),
        });
      }
      const where = { period_id: id };
      const total = await tx.financialPeriodDispute.count({ where });
      const rows = await tx.financialPeriodDispute.findMany({
        where,
        orderBy: [{ lesson_id: 'asc' }, { task_id: 'asc' }, { report_id: 'asc' }],
        skip,
        take: CAP,
        include: {
          task: {
            select: {
              status: true,
              assigned_manager_id: true,
              resolved_at: true,
              ledger_publication_id: true,
            },
          },
          lesson: {
            select: {
              status: true,
              outcome_dispute_decision: {
                select: {
                  decided_at: true,
                  outcome: {
                    select: {
                      t03_teacheraccrual_lesson_actual_outcome_id: {
                        select: {
                          t03_payrollobligation_accrual_id: {
                            select: { recognition_entry_id: true },
                          },
                        },
                      },
                    },
                  },
                },
              },
              enrollment_ref: {
                select: {
                  student_ref: {
                    select: {
                      manager_assignments: {
                        where: { ended_at: null },
                        select: { manager_id: true },
                        take: 1,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });
      return ok({
        ...meta,
        revision: null,
        total,
        items: rows.map((row) => ({
          ...projection(row),
          managerId: row.task
            ? row.task.assigned_manager_id
            : (row.lesson.enrollment_ref.student_ref.manager_assignments[0]?.manager_id ?? null),
          managerAtCloseId: row.manager_id,
          currentStatus: row.task?.status ?? row.lesson.status,
          statusAtClose: row.status_at_close,
          resolvedAt: row.task
            ? (row.task.resolved_at?.toISOString() ?? null)
            : (row.lesson.outcome_dispute_decision?.decided_at.toISOString() ?? null),
          correctionEntryId: row.task
            ? row.task.ledger_publication_id
            : (row.lesson.outcome_dispute_decision?.outcome
                ?.t03_teacheraccrual_lesson_actual_outcome_id?.t03_payrollobligation_accrual_id
                ?.recognition_entry_id ?? null),
        })),
      });
    });
  }

  async unresolved(periodId?: string): Promise<Result<UnresolvedDto, DomainError>> {
    try {
      let from: Date | null = null,
        to: Date | null = null;
      if (periodId) {
        if (!UUID_RE.test(periodId)) return err(domainError('PERIOD_NOT_FOUND', 404));
        const p = await this.period(periodId);
        if (!p) return err(domainError('PERIOD_NOT_FOUND', 404));
        from = p.starts_at;
        to = p.ends_at;
      }
      const { lessonRange, attemptRange } = blockerSql(from, to);
      const draftScope = periodId
        ? Prisma.sql`AND e.financial_period_id = ${periodId}::uuid`
        : Prisma.empty;
      const lessons = await this.db.client.$queryRaw<
        { id: string; kind: string; at: Date; teacher: string | null; student: string | null }[]
      >(Prisma.sql`
        SELECT l.id, CASE WHEN l.status = 'DISPUTED' THEN 'DISPUTED_LESSON' ELSE 'UNACCRUED_LESSON' END AS kind,
               l.scheduled_at AS at, t.full_name AS teacher, COALESCE(s.display_name, s.full_name) AS student
        FROM lesson_occurrences l
        LEFT JOIN lesson_actual_outcomes o ON o.lesson_occurrence_id = l.id
        LEFT JOIN teacher_accruals a ON a.lesson_actual_outcome_id = o.id
        LEFT JOIN teacher_accounts t ON t.id = l.scheduled_teacher_id
        LEFT JOIN student_subject_enrollments en ON en.id = l.enrollment_id
        LEFT JOIN students s ON s.id = en.student_id
        WHERE (l.status = 'DISPUTED' OR (l.status = 'CONDUCTED' AND (o.id IS NULL OR a.id IS NULL))) ${lessonRange}
        ORDER BY l.scheduled_at, l.id LIMIT ${CAP * 2}`);
      const attempts = await this.db.client.$queryRaw<
        {
          id: string;
          at: Date;
          teacher: string;
          amount: string;
          currency: string;
          status: string;
        }[]
      >(Prisma.sql`
        SELECT pa.id, pa.attempted_at AS at, t.full_name AS teacher, pa.amount::text AS amount, pa.currency, pa.status::text AS status
        FROM payout_attempts pa
        JOIN payroll_obligations o ON o.id = pa.obligation_id
        JOIN teacher_accruals a ON a.id = o.accrual_id
        JOIN teacher_accounts t ON t.id = a.teacher_id
        WHERE pa.status IN ('PENDING','UNKNOWN') ${attemptRange}
        ORDER BY pa.attempted_at, pa.id LIMIT ${CAP}`);
      const drafts = await this.db.client.$queryRaw<{ id: string; at: Date }[]>(Prisma.sql`
        SELECT e.id, e.effective_at AS at FROM ledger_entries e
        WHERE e.published_at IS NULL ${draftScope}
        ORDER BY e.effective_at, e.id LIMIT ${CAP}`);
      const counts = await this.blockerCounts(from, to);
      const perKind = new Map<string, number>();
      const capped = (i: UnresolvedItemDto) => {
        const n = (perKind.get(i.kind) ?? 0) + 1;
        perKind.set(i.kind, n);
        return n <= CAP;
      };
      const items: UnresolvedItemDto[] = [
        ...lessons.map((l) => ({
          kind: l.kind as UnresolvedItemDto['kind'],
          id: l.id,
          at: l.at.toISOString(),
          teacherName: l.teacher,
          studentName: l.student,
          amount: null,
          currency: null,
          detail:
            l.kind === 'DISPUTED_LESSON'
              ? 'Disputed lesson: review the confirmed report and the period dispute register'
              : 'Conducted lesson has no teacher accrual',
        })),
        ...attempts.map((a) => ({
          kind: 'OPEN_PAYOUT_ATTEMPT' as const,
          id: a.id,
          at: a.at.toISOString(),
          teacherName: a.teacher,
          studentName: null,
          amount: a.amount,
          currency: a.currency,
          detail: `Payout attempt is ${a.status}: confirm or reconcile it`,
        })),
        ...drafts.map((d) => ({
          kind: 'DRAFT_LEDGER_ENTRY' as const,
          id: d.id,
          at: d.at.toISOString(),
          teacherName: null,
          studentName: null,
          amount: null,
          currency: null,
          detail: 'Ledger entry is still a draft: publish or discard it',
        })),
      ]
        .sort((a, b) => a.at.localeCompare(b.at))
        .filter(capped);
      return ok({
        periodId: periodId ?? null,
        counts: Object.fromEntries(
          UNRESOLVED_KINDS.map((k) => [
            k,
            {
              UNACCRUED_LESSON: counts.unaccrued,
              DISPUTED_LESSON: counts.disputed,
              OPEN_PAYOUT_ATTEMPT: counts.attempts,
              DRAFT_LEDGER_ENTRY: counts.drafts,
            }[k],
          ]),
        ),
        items,
      });
    } catch (error: unknown) {
      return err(failure(error));
    }
  }

  async create(
    ctx: CriticalContext,
    input: { startsAt: string; endsAt: string },
  ): Promise<Result<PeriodDto, DomainError>> {
    try {
      const director = await this.access.staff(ctx, true);
      void director;
      const starts = new Date(input.startsAt),
        ends = new Date(input.endsAt);
      const span = +ends - +starts;
      if (!Number.isFinite(span) || span < DAY || span > 32 * DAY)
        return err(domainError('INVALID_PERIOD', 422));
      // Serialise concurrent creations so two requests cannot both see a free range.
      await ctx.tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('financial_periods'))`;
      const overlap = await ctx.tx.financialPeriod.findFirst({
        where: { starts_at: { lt: ends }, ends_at: { gt: starts } },
        select: { id: true },
      });
      if (overlap) return err(domainError('PERIOD_OVERLAP', 409));
      const row = await ctx.tx.financialPeriod.create({
        data: { starts_at: starts, ends_at: ends, source_operation_id: ctx.operationId },
      });
      const now = await at(ctx.tx);
      return ok({
        id: row.id,
        startsAt: row.starts_at.toISOString(),
        endsAt: row.ends_at.toISOString(),
        closedAt: null,
        finished: row.ends_at <= now,
        blockers: 0,
        readyToClose: row.ends_at <= now,
      });
    } catch (error: unknown) {
      return err(failure(error));
    }
  }

  async close(
    ctx: CriticalContext,
    id: string,
    body: unknown,
  ): Promise<Result<PeriodDto, DomainError>> {
    try {
      const closed = (await this.periods.close(ctx, id, body)) as {
        id: string;
        starts_at: Date;
        ends_at: Date;
        closed_at: Date;
      };
      return ok({
        id: closed.id,
        startsAt: closed.starts_at.toISOString(),
        endsAt: closed.ends_at.toISOString(),
        closedAt: closed.closed_at.toISOString(),
        finished: true,
        blockers: 0,
        readyToClose: false,
      });
    } catch (error: unknown) {
      return err(failure(error));
    }
  }
}
