import { studentAccessSuspended } from '../manager-contacts.js';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@online-school/db';
import { err, ok } from '@online-school/shared';
import type { Result } from '@online-school/shared';
import { DatabaseService } from '../../core/database/database.module.js';
import { AppException, domainError, fail } from '../../core/errors/domain-error.js';
import type { DomainError } from '../../core/errors/domain-error.js';
import type { AccountContext, CriticalContext } from '../../core/http.js';
import { at } from '../../modules/finance/finance-common.js';
import { object, string } from '../../modules/identity/input.js';
import { studentMeetLinkSql, studentMeetProjection } from './meet-access.js';
import { MeService } from '../me/me.service.js';
import type { IStudentContext } from '../student-context.interface.js';
import type {
  LessonsResponseDto,
  StudentLessonStatus,
  RescheduleRequestResponseDto,
  LessonRequestResultDto,
} from './lessons.dto.js';
import { lessonPeriod, preferredDate } from './lesson-period.js';
import type { ParsedLessonsQuery } from './lesson-period.js';
import { StudentCrmTaskService } from './student-crm-task.service.js';

export interface LessonRow {
  id: string | null;
  scheduled_at: Date;
  scheduled_end_at: Date;
  teacher_name: string;
  subject_name: string;
  subject_id?: string;
  original_scheduled_at?: Date;
  student_status: StudentLessonStatus;
  google_meet_link: string | null;
  total: number;
}
@Injectable()
export class StudentLessonsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly me: MeService,
    private readonly tasks: StudentCrmTaskService,
  ) {}

  async list(
    student: IStudentContext,
    query: ParsedLessonsQuery,
    lessonId?: string,
    upcoming = false,
  ): Promise<Result<LessonsResponseDto, DomainError>> {
    try {
      const now = new Date(),
        period = lessonPeriod(query, now, student.timeZone);
      const rows = await this.read(
        student.studentProfileId,
        query,
        lessonId || upcoming ? null : period.from,
        lessonId || upcoming ? null : period.until,
        now,
        lessonId,
        upcoming,
      );
      const total = rows[0]?.total ?? 0;
      if (query.month && query.view !== 'list' && total > 62)
        return err(domainError('CALENDAR_MONTH_LIMIT_EXCEEDED', 422));
      return ok({
        items: rows
          .filter((row) => row.id !== null)
          .map((row) => {
            const delta = +row.scheduled_at - +now;
            return {
              lessonId: row.id!,
              scheduledAt: row.scheduled_at.toISOString(),
              durationMinutes: Math.round((+row.scheduled_end_at - +row.scheduled_at) / 60000),
              teacherName: row.teacher_name,
              subjectName: row.subject_name,
              ...(row.subject_id ? { subjectId: row.subject_id } : {}),
              ...(row.original_scheduled_at
                ? { originalScheduledAt: row.original_scheduled_at.toISOString() }
                : {}),
              status: row.student_status,
              ...studentMeetProjection(row, student, now),
              canRequestReschedule: row.student_status === 'SCHEDULED' && delta >= 86400000,
            };
          }),
        total,
        page: query.page,
        pageSize: query.pageSize,
      });
    } catch (error) {
      return err(
        error instanceof AppException
          ? error.domain
          : domainError('STUDENT_LESSONS_UNAVAILABLE', 503),
      );
    }
  }

  async read(
    studentId: string,
    query: ParsedLessonsQuery,
    from: Date | null,
    until: Date | null,
    time: Date,
    lessonId?: string,
    upcoming = false,
  ): Promise<LessonRow[]> {
    const period =
      from && until
        ? Prisma.sql`AND l.scheduled_at>=${from} AND l.scheduled_at<${until}`
        : Prisma.empty;
    const archive =
      query.period === 'archive'
        ? Prisma.sql`WHERE student_status IN ('COMPLETED','CANCELLED','NO_SHOW')`
        : Prisma.empty;
    const direction = query.period === 'archive' ? Prisma.sql`DESC` : Prisma.sql`ASC`;
    const selected = lessonId
      ? Prisma.sql`AND l.id=${lessonId}::uuid`
      : upcoming
        ? Prisma.sql`AND l.status='SCHEDULED' AND l.scheduled_end_at>${time}`
        : Prisma.empty;
    const subject = query.subjectId
      ? Prisma.sql`AND e.subject_id=${query.subjectId}::uuid`
      : Prisma.empty;
    return this.database.client.$queryRaw<LessonRow[]>(Prisma.sql`
      WITH records AS (
        SELECT l.id,l.scheduled_at,l.scheduled_end_at,l.original_scheduled_at,e.subject_id,
          t.full_name AS teacher_name,s.name AS subject_name,
          CASE WHEN l.status='CONDUCTED' THEN CASE WHEN EXISTS(SELECT 1 FROM lesson_actual_outcomes o WHERE o.lesson_occurrence_id=l.id AND o.confirmed_at<=${time}) THEN 'COMPLETED' ELSE 'DISPUTED' END
            WHEN l.status='CANCELLED' AND r.result='NOT_CONDUCTED' AND r.student_no_show AND r.reported_at<=${time} THEN 'NO_SHOW'
            ELSE l.status::text END AS student_status,
          ${studentMeetLinkSql(time)} AS google_meet_link
        FROM lesson_occurrences l JOIN student_subject_enrollments e ON e.id=l.enrollment_id
          JOIN teacher_accounts t ON t.id=l.scheduled_teacher_id JOIN subjects s ON s.id=e.subject_id
          JOIN teaching_assignments a ON a.id=l.teaching_assignment_id
          LEFT JOIN lesson_outcome_reports r ON r.id=l.confirmed_report_id AND r.lesson_occurrence_id=l.id
        WHERE e.student_id=${studentId}::uuid ${selected} ${period} ${subject}
      ), filtered AS (SELECT * FROM records ${archive})
      SELECT page.*,totals.total FROM (SELECT count(*)::int AS total FROM filtered) totals
        LEFT JOIN LATERAL (SELECT * FROM filtered ORDER BY scheduled_at ${direction},id ${direction}
          LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}) page ON true
      ORDER BY page.scheduled_at ${direction},page.id ${direction}`);
  }

  async requestResult(
    student: IStudentContext,
    lessonId: string,
    key: string,
    type?: 'RESCHEDULE_REQUEST' | 'ATTENDANCE_DISPUTE',
  ): Promise<LessonRequestResultDto> {
    try {
      const [task] = await this.database.client.$queryRaw<
        { crmTaskId: string; type: 'RESCHEDULE_REQUEST' | 'ATTENDANCE_DISPUTE' }[]
      >`SELECT task.id AS "crmTaskId",task.type::text AS type
        FROM crm_tasks task JOIN lesson_occurrences l ON l.id=task.lesson_id
        JOIN student_subject_enrollments e ON e.id=l.enrollment_id
        WHERE task.student_id=${student.studentProfileId}::uuid AND e.student_id=task.student_id
          AND task.lesson_id=${lessonId}::uuid AND
          ((task.type='RESCHEDULE_REQUEST' AND task.idempotency_key=${`student-reschedule:${student.userId}:${key}`})
            OR (task.type='ATTENDANCE_DISPUTE' AND task.idempotency_key=${`student-dispute:${student.userId}:${key}`}))
          AND (${type ?? null}::text IS NULL OR task.type::text=${type ?? null})
        LIMIT 1`;
      return task
        ? { status: 'CREATED', crmTaskId: task.crmTaskId, type: task.type }
        : { status: 'UNKNOWN', crmTaskId: null, type: null };
    } catch {
      return fail(domainError('STUDENT_LESSON_REQUEST_UNAVAILABLE', 503));
    }
  }

  async owns(
    client: Pick<Prisma.TransactionClient, '$queryRaw'>,
    studentId: string,
    lessonId: string,
  ): Promise<boolean> {
    try {
      const rows = await client.$queryRaw<
        { id: string }[]
      >`SELECT l.id FROM lesson_occurrences l JOIN student_subject_enrollments e ON e.id=l.enrollment_id WHERE l.id=${lessonId}::uuid AND e.student_id=${studentId}::uuid`;
      return rows.length === 1;
    } catch {
      return fail(domainError('STUDENT_LESSONS_UNAVAILABLE', 503));
    }
  }
  async authorize(
    tx: Prisma.TransactionClient,
    actor: AccountContext,
    studentId: string,
    lessonId: string,
  ): Promise<Result<IStudentContext, DomainError>> {
    if (actor.kind !== 'STUDENT' || !actor.roles.includes('STUDENT'))
      return err(domainError('FORBIDDEN', 403));
    const loaded = await this.me.load(actor.accountId, tx);
    if (!loaded.ok) return loaded;
    const student = loaded.value.context;
    if (student.studentProfileId !== studentId || !(await this.owns(tx, studentId, lessonId)))
      return err(domainError('LESSON_FORBIDDEN', 403));
    if (student.mustChangePassword) return err(domainError('MUST_CHANGE_PASSWORD', 403));
    if (!student.hasActiveAccess) return err(studentAccessSuspended(student.managerContacts));
    return ok(student);
  }
  async request(
    ctx: CriticalContext,
    student: IStudentContext,
    lessonId: string,
    body: unknown,
  ): Promise<RescheduleRequestResponseDto> {
    const input = object(body, ['reason', 'preferredDate']),
      reason = string(input.reason, 1, 500);
    const [lesson] = await ctx.tx.$queryRaw<
      { id: string; student_id: string; status: string; scheduled_at: Date }[]
    >`
      SELECT l.id,e.student_id,l.status,l.scheduled_at FROM lesson_occurrences l JOIN student_subject_enrollments e ON e.id=l.enrollment_id
      WHERE l.id=${lessonId}::uuid FOR UPDATE OF l`;
    if (!lesson || lesson.student_id !== student.studentProfileId)
      return fail(domainError('LESSON_FORBIDDEN', 403));
    const now = await at(ctx.tx);
    if (lesson.status !== 'SCHEDULED' || +lesson.scheduled_at - +now < 86400000)
      return fail(domainError('RESCHEDULE_WINDOW_CLOSED', 422));
    const date = preferredDate(
      input.preferredDate,
      lessonPeriod({ period: 'today', page: 1, pageSize: 20 }, now, student.timeZone).today,
    );
    return this.tasks.create(
      ctx,
      {
        lessonId,
        studentProfileId: student.studentProfileId,
        payload: { reason, preferredDate: date },
      },
      now,
    );
  }
}
