import { createHash } from 'node:crypto';
import { Prisma } from '@online-school/db';
import type { FinancialPeriod } from '@online-school/db';

type Bounds = Pick<FinancialPeriod, 'id' | 'starts_at' | 'ends_at'>;
export type PeriodDisputeSource = {
  lesson_id: string;
  task_id: string | null;
  report_id: string | null;
  source_entry_id: string | null;
  manager_id: string | null;
  source_version: number;
  status_at_close: string;
};

const matchingReport = Prisma.sql`l.kind='REGULAR' AND r.id=l.confirmed_report_id
  AND r.lesson_occurrence_id=l.id AND r.result='DISPUTED'`;
const openCrmTask = Prisma.sql`t.type='ATTENDANCE_DISPUTE'
  AND t.status IN ('OPEN','IN_PROGRESS')`;
const liveCharge = Prisma.sql`c.cancelled_at IS NULL AND e.published_at IS NOT NULL
  AND e.reverses_entry_id IS NULL AND NOT EXISTS (
    SELECT 1 FROM ledger_entries rev WHERE rev.reverses_entry_id=e.id AND rev.published_at IS NOT NULL
  )`;
const chargeJoin = Prisma.sql`JOIN entitlement_consumptions c
    ON c.id=t.original_consumption_id AND c.lesson_occurrence_id=t.lesson_id
  JOIN ledger_documents d ON d.consumption_id=c.id
  JOIN ledger_entries e ON e.document_id=d.id`;
const lessonRange = (period: Bounds) => Prisma.sql`
  l.scheduled_at>=${period.starts_at} AND l.scheduled_at<${period.ends_at}`;
const chargeDisputes = (period: Bounds) => Prisma.sql`
  SELECT l.id AS lesson_id, t.id AS task_id, NULL::uuid AS report_id, e.id AS source_entry_id,
    t.assigned_manager_id AS manager_id, t.version AS source_version, t.status::text AS status_at_close
  FROM crm_tasks t
  JOIN lesson_occurrences l ON l.id=t.lesson_id
  ${chargeJoin}
  WHERE ${openCrmTask} AND ${liveCharge} AND ${lessonRange(period)}
`;

export async function openPeriodDisputes(tx: Prisma.TransactionClient, period: Bounds) {
  return tx.$queryRaw<PeriodDisputeSource[]>(Prisma.sql`
    SELECT * FROM (
      SELECT l.id AS lesson_id, NULL::uuid AS task_id, r.id AS report_id,
        NULL::uuid AS source_entry_id, a.manager_id,
        r.version AS source_version, 'DISPUTED'::text AS status_at_close
      FROM lesson_occurrences l
      JOIN lesson_outcome_reports r ON ${matchingReport}
      JOIN student_subject_enrollments en ON en.id=l.enrollment_id
      LEFT JOIN assigned_managers a ON a.student_id=en.student_id AND a.ended_at IS NULL
      WHERE l.status='DISPUTED' AND ${lessonRange(period)}
      UNION ALL
      ${chargeDisputes(period)}
    ) issues ORDER BY lesson_id, task_id, report_id
  `);
}

export function periodDisputesRevision(periodId: string, disputes: PeriodDisputeSource[]): string {
  const values = disputes.map((d) => [
    d.lesson_id,
    d.task_id,
    d.report_id,
    d.source_entry_id,
    d.manager_id,
    d.source_version,
    d.status_at_close,
  ]);
  return createHash('sha256')
    .update(JSON.stringify([periodId, values]))
    .digest('hex');
}

export async function periodClosureBlockers(tx: Prisma.TransactionClient, period: Bounds) {
  const [row] = await tx.$queryRaw<{ lessons: number; attempts: number; drafts: number }[]>(
    Prisma.sql`
    WITH matched_charges AS (${chargeDisputes(period)})
    SELECT
      (SELECT count(*) FROM lesson_occurrences l
        LEFT JOIN lesson_actual_outcomes o ON o.lesson_occurrence_id=l.id
        LEFT JOIN teacher_accruals a ON a.lesson_actual_outcome_id=o.id
        WHERE ${lessonRange(period)} AND (
          (l.status='CONDUCTED' AND (o.id IS NULL OR a.id IS NULL)) OR
          (l.status='DISPUTED' AND NOT EXISTS(
            SELECT 1 FROM lesson_outcome_reports r WHERE ${matchingReport}
          )) OR EXISTS (
            SELECT 1 FROM crm_tasks t WHERE t.lesson_id=l.id AND ${openCrmTask}
              AND NOT EXISTS (SELECT 1 FROM matched_charges c WHERE c.task_id=t.id)
          )
        ))::int AS lessons,
      (SELECT count(*) FROM payout_attempts pa
        WHERE pa.attempted_at>=${period.starts_at} AND pa.attempted_at<${period.ends_at}
          AND (pa.status IN ('PENDING','UNKNOWN') OR (pa.status='SUCCEEDED'
            AND NOT EXISTS (SELECT 1 FROM confirmed_payouts cp WHERE cp.attempt_id=pa.id))))::int AS attempts,
      (SELECT count(*) FROM ledger_entries
        WHERE financial_period_id=${period.id}::uuid AND published_at IS NULL)::int AS drafts
  `,
  );
  return row!;
}
