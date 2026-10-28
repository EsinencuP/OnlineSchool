import { Injectable } from '@nestjs/common';
import { Prisma } from '@online-school/db';
import { err, ok } from '@online-school/shared';
import type { Result } from '@online-school/shared';
import { DatabaseService } from '../../core/database/database.module.js';
import { domainError } from '../../core/errors/domain-error.js';
import type { DomainError } from '../../core/errors/domain-error.js';
import type { IStudentContext } from '../student-context.interface.js';
import type { HistoryPage, LessonHistoryResponseDto } from './history.dto.js';

export const DISPUTE_WINDOW_MS = 30 * 86400000;
export interface HistoryRow {
  id: string | null;
  scheduled_at: Date;
  duration_minutes: number;
  teacher_name: string;
  subject_name: string;
  attendance_status: 'COMPLETED' | 'NO_SHOW';
  consumption_id: string | null;
  balance_before: string | null;
  balance_after: string | null;
  has_open_dispute: boolean;
  can_dispute: boolean;
  total?: number;
}
export function historyRecords(studentId: string, time: Date): Prisma.Sql {
  return Prisma.sql`
    SELECT l.id,l.scheduled_at,coalesce(o.duration_min,round(extract(epoch FROM(l.scheduled_end_at-l.scheduled_at))/60)::int) AS duration_minutes,
      t.full_name AS teacher_name,s.name AS subject_name,
      CASE WHEN l.status='CONDUCTED' THEN 'COMPLETED' ELSE 'NO_SHOW' END AS attendance_status,
      charge.id AS consumption_id,charge.entitlement_balance_before::text AS balance_before,charge.entitlement_balance_after::text AS balance_after,
      EXISTS(SELECT 1 FROM crm_tasks task WHERE task.lesson_id=l.id AND task.student_id=e.student_id AND task.type='ATTENDANCE_DISPUTE'
        AND task.status IN ('OPEN','IN_PROGRESS')) AS has_open_dispute,
      charge.id IS NOT NULL AND l.scheduled_at>=${time}::timestamptz-interval '720 hours' AND NOT EXISTS(
        SELECT 1 FROM crm_tasks task WHERE task.lesson_id=l.id AND task.student_id=e.student_id AND task.type='ATTENDANCE_DISPUTE'
          AND task.status IN ('OPEN','IN_PROGRESS')) AS can_dispute
    FROM lesson_occurrences l JOIN student_subject_enrollments e ON e.id=l.enrollment_id
      LEFT JOIN lesson_actual_outcomes o ON o.lesson_occurrence_id=l.id AND o.confirmed_at<=${time}
      LEFT JOIN lesson_outcome_reports r ON r.id=l.confirmed_report_id AND r.lesson_occurrence_id=l.id
      JOIN teacher_accounts t ON t.id=coalesce(o.actual_teacher_id,l.scheduled_teacher_id)
      JOIN subjects s ON s.id=e.subject_id
      LEFT JOIN LATERAL(SELECT c.id,le.entitlement_balance_before,le.entitlement_balance_after
        FROM entitlement_consumptions c JOIN subscriptions sub ON sub.id=c.subscription_id AND sub.enrollment_id=e.id
          JOIN ledger_documents d ON d.consumption_id=c.id JOIN ledger_entries le ON le.document_id=d.id
        WHERE c.lesson_occurrence_id=l.id AND c.consumed_at<=${time} AND (c.cancelled_at IS NULL OR c.cancelled_at>${time}) AND le.published_at<=${time}
        ORDER BY c.consumed_at DESC,c.id DESC LIMIT 1) charge ON true
    WHERE e.student_id=${studentId}::uuid AND l.scheduled_at<=${time}
      AND ((l.status='CONDUCTED' AND o.id IS NOT NULL) OR
        (l.status='CANCELLED' AND r.result='NOT_CONDUCTED' AND r.student_no_show AND r.reported_at<=${time}))`;
}
@Injectable()
export class StudentHistoryService {
  constructor(private readonly database: DatabaseService) {}
  async read(studentId: string, page: HistoryPage, time: Date): Promise<HistoryRow[]> {
    return this.database.client.$queryRaw<HistoryRow[]>(Prisma.sql`
      WITH records AS (${historyRecords(studentId, time)})
      SELECT data.*,totals.total FROM(SELECT count(*)::int AS total FROM records)totals
      LEFT JOIN LATERAL(SELECT * FROM records ORDER BY scheduled_at DESC,id DESC LIMIT ${page.pageSize} OFFSET ${(page.page - 1) * page.pageSize})data ON true
      ORDER BY data.scheduled_at DESC,data.id DESC`);
  }
  async list(
    student: IStudentContext,
    page: HistoryPage,
  ): Promise<Result<LessonHistoryResponseDto, DomainError>> {
    try {
      const rows = await this.read(student.studentProfileId, page, new Date());
      return ok({
        items: rows
          .filter((row) => row.id !== null)
          .map((row) => ({
            lessonId: row.id!,
            scheduledAt: row.scheduled_at.toISOString(),
            durationMinutes: row.duration_minutes,
            teacherName: row.teacher_name,
            subjectName: row.subject_name,
            attendanceStatus: row.attendance_status,
            lessonDeducted: row.consumption_id !== null,
            balanceBefore:
              row.balance_before === null
                ? null
                : new Prisma.Decimal(row.balance_before).toFixed(0),
            balanceAfter:
              row.balance_after === null ? null : new Prisma.Decimal(row.balance_after).toFixed(0),
            canDispute: row.can_dispute,
          })),
        total: rows[0]?.total ?? 0,
        ...page,
      });
    } catch {
      return err(domainError('STUDENT_HISTORY_UNAVAILABLE', 503));
    }
  }
  async eligibility(
    tx: Pick<Prisma.TransactionClient, '$queryRaw'>,
    studentId: string,
    lessonId: string,
    time: Date,
  ): Promise<HistoryRow | undefined> {
    const [row] = await tx.$queryRaw<HistoryRow[]>(
      Prisma.sql`SELECT * FROM (${historyRecords(studentId, time)})history WHERE id=${lessonId}::uuid`,
    );
    return row;
  }
}
