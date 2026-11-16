import { Injectable } from '@nestjs/common';
import { Prisma } from '@online-school/db';
import { err, ok } from '@online-school/shared';
import type { Result } from '@online-school/shared';
import { StaffActorContextService } from '../../core/actor/actor-context.service.js';
import { DatabaseService } from '../../core/database/database.module.js';
import { AppException, domainError } from '../../core/errors/domain-error.js';
import type { DomainError } from '../../core/errors/domain-error.js';
import type { AccountContext } from '../../core/http.js';
import { Decimal } from '../finance/finance-common.js';
import type { TeacherContext } from './context/teacher-context.js';
import type { PayrollStatus, TeacherPayrollResponseDto } from './dto/teacher-payroll.dto.js';

const failure = (error: unknown): DomainError =>
  error instanceof AppException ? error.domain : domainError('DATABASE_ERROR', 503);
const money = (value: unknown) => new Decimal(String(value ?? 0));
const fixed = (value: InstanceType<typeof Decimal>) => value.toFixed(4);

type Row = {
  outcome_id: string;
  started_at: Date;
  duration_min: number;
  student_name: string;
  subject_name: string;
  rate: unknown;
  points: number;
  rate_basis: string;
  currency: string;
  accrual_id: string | null;
  amount: unknown;
  recognized_at: Date | null;
  paid: unknown;
  last_paid_at: Date | null;
};

/** Read-only personal statement: one line per confirmed lesson of the month with its payment state. */
@Injectable()
export class TeacherPayrollService {
  constructor(
    private readonly db: DatabaseService,
    private readonly actors: StaffActorContextService,
  ) {}

  async statement(
    ctx: TeacherContext,
    actor: AccountContext,
    month?: string,
  ): Promise<Result<TeacherPayrollResponseDto, DomainError>> {
    try {
      const { timezone } = await this.actors.get(actor);
      const bounds = await this.db.client.$queryRaw<
        { month: string; start: Date; end: Date }[]
      >`WITH m AS (
          SELECT COALESCE(to_date(${month ?? null}::text || '-01', 'YYYY-MM-DD'),
                          date_trunc('month', clock_timestamp() AT TIME ZONE ${timezone})::date) AS first_day)
        SELECT to_char(first_day, 'YYYY-MM') AS month,
               (first_day::timestamp AT TIME ZONE ${timezone}) AS start,
               ((first_day + interval '1 month')::timestamp AT TIME ZONE ${timezone}) AS "end"
        FROM m`;
      const { month: label, start, end } = bounds[0]!;
      const rows = await this.db.client.$queryRaw<Row[]>(Prisma.sql`
        SELECT o.id AS outcome_id, o.actual_started_at AS started_at, o.duration_min,
               COALESCE(s.display_name, s.full_name) AS student_name, sub.name AS subject_name,
               o.rate_snapshot AS rate, o.points_snapshot AS points, o.rate_basis::text AS rate_basis,
               o.currency, a.id AS accrual_id, a.amount, a.recognized_at,
               COALESCE((SELECT sum(cp.amount) FROM confirmed_payouts cp
                  JOIN payout_attempts pa ON pa.id = cp.attempt_id
                  JOIN payroll_obligations ob ON ob.id = pa.obligation_id
                 WHERE ob.accrual_id = a.id), 0) AS paid,
               (SELECT max(cp.confirmed_at) FROM confirmed_payouts cp
                  JOIN payout_attempts pa ON pa.id = cp.attempt_id
                  JOIN payroll_obligations ob ON ob.id = pa.obligation_id
                 WHERE ob.accrual_id = a.id) AS last_paid_at
        FROM lesson_actual_outcomes o
        JOIN lesson_occurrences l ON l.id = o.lesson_occurrence_id
        JOIN student_subject_enrollments e ON e.id = l.enrollment_id
        JOIN students s ON s.id = e.student_id
        JOIN subjects sub ON sub.id = e.subject_id
        LEFT JOIN teacher_accruals a ON a.lesson_actual_outcome_id = o.id
        WHERE o.actual_teacher_id = ${ctx.teacherId}::uuid
          AND o.actual_started_at >= ${start}::timestamptz AND o.actual_started_at < ${end}::timestamptz
        ORDER BY o.actual_started_at DESC, o.id DESC
        LIMIT 500`);
      const totals = new Map<
        string,
        {
          accrued: InstanceType<typeof Decimal>;
          paid: InstanceType<typeof Decimal>;
          pending: InstanceType<typeof Decimal>;
        }
      >();
      const lines = rows.map((r) => {
        const amount = r.accrual_id ? money(r.amount) : money(r.rate);
        const paid = money(r.paid);
        const t = totals.get(r.currency) ?? {
          accrued: money(0),
          paid: money(0),
          pending: money(0),
        };
        let status: PayrollStatus;
        if (!r.accrual_id) {
          status = 'PENDING_ACCRUAL';
          t.pending = t.pending.plus(amount);
        } else {
          t.accrued = t.accrued.plus(amount);
          t.paid = t.paid.plus(paid);
          status = amount.isZero()
            ? 'NO_PAYMENT'
            : paid.gte(amount)
              ? 'PAID'
              : paid.gt(0)
                ? 'PARTIALLY_PAID'
                : 'ACCRUED';
        }
        totals.set(r.currency, t);
        return {
          outcomeId: r.outcome_id,
          lessonStartedAt: r.started_at.toISOString(),
          durationMin: r.duration_min,
          studentName: r.student_name,
          subjectName: r.subject_name,
          rate: fixed(money(r.rate)),
          points: r.points,
          rateBasis: r.rate_basis,
          currency: r.currency,
          amount: fixed(amount),
          paid: fixed(paid),
          status,
          accruedAt: r.recognized_at?.toISOString() ?? null,
          lastPaidAt: r.last_paid_at?.toISOString() ?? null,
        };
      });
      return ok({
        month: label,
        timezone,
        totals: [...totals.entries()].map(([currency, t]) => ({
          currency,
          accrued: fixed(t.accrued),
          paid: fixed(t.paid),
          outstanding: fixed(t.accrued.minus(t.paid)),
          pendingAccrual: fixed(t.pending),
        })),
        lines,
      });
    } catch (error: unknown) {
      return err(failure(error));
    }
  }
}
