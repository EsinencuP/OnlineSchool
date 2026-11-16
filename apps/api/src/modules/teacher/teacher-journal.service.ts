import { Injectable } from '@nestjs/common';
import { Prisma } from '@online-school/db';
import { err, ok } from '@online-school/shared';
import type { Result } from '@online-school/shared';
import { DatabaseService } from '../../core/database/database.module.js';
import { AppException, domainError } from '../../core/errors/domain-error.js';
import type { DomainError } from '../../core/errors/domain-error.js';
import type { TeacherContext } from './context/teacher-context.js';
import { JOURNAL_STATES } from './dto/teacher-journal.dto.js';
import type {
  JournalState,
  TeacherJournalItemDto,
  TeacherJournalPageDto,
  TeacherLessonCardDto,
} from './dto/teacher-journal.dto.js';

const DAY_MS = 86_400_000;
const failure = (error: unknown): DomainError =>
  error instanceof AppException ? error.domain : domainError('DATABASE_ERROR', 503);

type Row = {
  id: string;
  scheduled_at: Date;
  scheduled_end_at: Date;
  kind: 'REGULAR' | 'TRIAL';
  state: JournalState;
  latest_result: 'CONDUCTED' | 'NOT_CONDUCTED' | 'DISPUTED' | null;
  student_id: string;
  student_name: string;
  subject_name: string;
  now: Date;
};

const encode = (row: Row) =>
  Buffer.from(JSON.stringify([row.scheduled_at.toISOString(), row.id])).toString('base64url');
function decode(cursor: string): { at: Date; id: string } | null {
  try {
    const [at, id] = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as unknown[];
    if (
      typeof at !== 'string' ||
      typeof id !== 'string' ||
      !/^[0-9a-f-]{36}$/i.test(id) ||
      Number.isNaN(Date.parse(at))
    )
      return null;
    return { at: new Date(at), id };
  } catch {
    return null;
  }
}

// State is derived from the lesson row and its latest report of the *current* lesson version,
// mirroring the rules of OutcomesService.report/confirm.
const stateSql = Prisma.sql`CASE
  WHEN l.status = 'CONDUCTED' THEN 'CONDUCTED'
  WHEN l.status = 'DISPUTED' THEN 'DISPUTED'
  WHEN l.status = 'CANCELLED' OR l.confirmed_report_id IS NOT NULL THEN 'CANCELLED'
  WHEN r.id IS NULL THEN 'AWAITING_REPORT'
  ELSE 'AWAITING_CONFIRMATION' END`;
const fromSql = Prisma.sql`FROM lesson_occurrences l
  JOIN student_subject_enrollments e ON e.id = l.enrollment_id
  JOIN students s ON s.id = e.student_id
  JOIN subjects sub ON sub.id = e.subject_id
  LEFT JOIN LATERAL (
    SELECT id, result FROM lesson_outcome_reports
    WHERE lesson_occurrence_id = l.id ORDER BY version DESC LIMIT 1
  ) latest ON true
  LEFT JOIN lesson_outcome_reports r ON r.id = latest.id AND r.lesson_version = l.version`;
const columnsSql = Prisma.sql`l.id, l.scheduled_at, l.scheduled_end_at, l.kind::text AS kind,
  ${stateSql} AS state, r.result::text AS latest_result,
  s.id AS student_id, COALESCE(s.display_name, s.full_name) AS student_name,
  sub.name AS subject_name, clock_timestamp() AS now`;

const item = (row: Row): TeacherJournalItemDto => {
  const deadline = new Date(+row.scheduled_end_at + DAY_MS);
  return {
    lessonId: row.id,
    startsAt: row.scheduled_at.toISOString(),
    endsAt: row.scheduled_end_at.toISOString(),
    state: row.state,
    kind: row.kind,
    studentId: row.student_id,
    studentName: row.student_name,
    subjectName: row.subject_name,
    reportDeadlineAt: deadline.toISOString(),
    overdue: row.state === 'AWAITING_REPORT' && +row.now > +deadline,
    latestReportResult: row.latest_result,
  };
};

@Injectable()
export class TeacherJournalService {
  constructor(private readonly db: DatabaseService) {}

  async list(
    ctx: TeacherContext,
    query: { state?: string; limit?: number; cursor?: string },
  ): Promise<Result<TeacherJournalPageDto, DomainError>> {
    try {
      const limit = query.limit ?? 20;
      const cursor = query.cursor === undefined ? null : decode(query.cursor);
      if (query.cursor !== undefined && !cursor) return err(domainError('INVALID_CURSOR', 422));
      if (query.state !== undefined && !(JOURNAL_STATES as readonly string[]).includes(query.state))
        return err(domainError('INVALID_INPUT', 422));
      const rows = await this.db.client.$queryRaw<Row[]>(Prisma.sql`
        SELECT * FROM (SELECT ${columnsSql} ${fromSql}
          WHERE l.scheduled_teacher_id = ${ctx.teacherId}::uuid
            AND l.scheduled_end_at <= clock_timestamp()
            ${cursor ? Prisma.sql`AND (l.scheduled_at, l.id) < (${cursor.at}::timestamptz, ${cursor.id}::uuid)` : Prisma.empty}
        ) j
        ${query.state ? Prisma.sql`WHERE j.state = ${query.state}` : Prisma.empty}
        ORDER BY j.scheduled_at DESC, j.id DESC
        LIMIT ${limit + 1}`);
      const page = rows.slice(0, limit);
      return ok({
        items: page.map(item),
        nextCursor: rows.length > limit ? encode(page[page.length - 1]!) : null,
        asOf: (rows[0]?.now ?? new Date()).toISOString(),
      });
    } catch (error: unknown) {
      return err(failure(error));
    }
  }

  async card(ctx: TeacherContext, id: string): Promise<Result<TeacherLessonCardDto, DomainError>> {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
      return err(domainError('INVALID_INPUT', 422));
    try {
      const rows = await this.db.client.$queryRaw<Row[]>(Prisma.sql`
        SELECT ${columnsSql} ${fromSql}
        WHERE l.id = ${id}::uuid AND l.scheduled_teacher_id = ${ctx.teacherId}::uuid`);
      const row = rows[0];
      if (!row) return err(domainError('NOT_FOUND', 404));
      const lesson = await this.db.client.lessonOccurrence.findUniqueOrThrow({
        where: { id },
        select: {
          version: true,
          status: true,
          kind: true,
          actual_start_at: true,
          trial_started_at: true,
          confirmed_report_id: true,
          outcome_reports: { orderBy: { version: 'desc' } },
          t03_lessonactualoutcome_lesson_occurrence_id: true,
        },
      });
      const current = lesson.outcome_reports.find((r) => r.lesson_version === lesson.version);
      const outcome = lesson.t03_lessonactualoutcome_lesson_occurrence_id;
      const started = lesson.kind === 'TRIAL' ? lesson.trial_started_at : lesson.actual_start_at;
      return ok({
        ...item(row),
        actualStartedAt: started?.toISOString() ?? null,
        // Same preconditions as OutcomesService.report (the command remains the authority).
        canReport:
          +row.scheduled_end_at <= +row.now &&
          !lesson.confirmed_report_id &&
          ['SCHEDULED', 'STAR_PENDING'].includes(lesson.status),
        reports: lesson.outcome_reports.map((r) => ({
          reportId: r.id,
          version: r.version,
          result: r.result,
          studentNoShow: r.student_no_show,
          actualStartedAt: r.actual_started_at?.toISOString() ?? null,
          durationMin: r.duration_min,
          note: r.note,
          reportedAt: r.reported_at.toISOString(),
          current: r.id === current?.id,
        })),
        confirmedOutcome: outcome
          ? {
              confirmedAt: outcome.confirmed_at.toISOString(),
              actualStartedAt: outcome.actual_started_at.toISOString(),
              durationMin: outcome.duration_min,
            }
          : null,
      });
    } catch (error: unknown) {
      return err(failure(error));
    }
  }
}
