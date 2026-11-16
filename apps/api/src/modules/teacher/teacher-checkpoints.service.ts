import { Injectable } from '@nestjs/common';
import { Prisma } from '@online-school/db';
import { err, ok } from '@online-school/shared';
import type { Result } from '@online-school/shared';
import { DatabaseService } from '../../core/database/database.module.js';
import { AppException, domainError, fail } from '../../core/errors/domain-error.js';
import type { DomainError } from '../../core/errors/domain-error.js';
import type { CriticalContext } from '../../core/http.js';
import { at } from '../finance/finance-common.js';
import type { TeacherContext } from './context/teacher-context.js';
import { CHECKPOINT_STATES, CHECKPOINT_TYPES } from './dto/teacher-checkpoints.dto.js';
import type {
  CheckpointState,
  CompleteCheckpointDto,
  CompleteCheckpointResponseDto,
  PublishReportResponseDto,
  SaveReportDto,
  SaveReportResponseDto,
  TeacherCheckpointCardDto,
  TeacherCheckpointItemDto,
  TeacherCheckpointPageDto,
} from './dto/teacher-checkpoints.dto.js';

const failure = (error: unknown): DomainError =>
  error instanceof AppException ? error.domain : domainError('DATABASE_ERROR', 503);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Row = {
  id: string;
  type: 'LESSON_4' | 'LESSON_8';
  confirmed_lesson_count: number;
  triggered_at: Date;
  completed_at: Date | null;
  teacher_summary: string | null;
  enrollment_id: string;
  student_id: string;
  student_name: string;
  subject_name: string;
  state: CheckpointState;
};

const encode = (r: Row) =>
  Buffer.from(JSON.stringify([r.triggered_at.toISOString(), r.id])).toString('base64url');
function decode(cursor: string): { at: Date; id: string } | null {
  try {
    const [t, id] = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as unknown[];
    if (
      typeof t !== 'string' ||
      typeof id !== 'string' ||
      !UUID_RE.test(id) ||
      Number.isNaN(Date.parse(t))
    )
      return null;
    return { at: new Date(t), id };
  } catch {
    return null;
  }
}

// A LESSON_4 review is done when the teacher completed it; a LESSON_8 one when its report is published.
const baseSql = (teacherId: string, extra: Prisma.Sql) => Prisma.sql`
  SELECT cp.id, cp.type::text AS type, cp.confirmed_lesson_count, cp.triggered_at, cp.completed_at,
         cp.teacher_summary, e.id AS enrollment_id, s.id AS student_id,
         COALESCE(s.display_name, s.full_name) AS student_name, sub.name AS subject_name,
         CASE WHEN cp.type = 'LESSON_4' THEN (CASE WHEN cp.completed_at IS NOT NULL THEN 'COMPLETED' ELSE 'PENDING' END)
              ELSE (CASE WHEN EXISTS (SELECT 1 FROM education_reports r WHERE r.checkpoint_id = cp.id AND r.status = 'PUBLISHED')
                         THEN 'COMPLETED' ELSE 'PENDING' END) END AS state
  FROM progress_checkpoints cp
  JOIN student_subject_enrollments e ON e.id = cp.enrollment_id
  JOIN students s ON s.id = e.student_id
  JOIN subjects sub ON sub.id = e.subject_id
  WHERE EXISTS (SELECT 1 FROM teaching_assignments a WHERE a.enrollment_id = e.id
      AND a.teacher_id = ${teacherId}::uuid AND a.valid_from <= clock_timestamp()
      AND (a.valid_to IS NULL OR a.valid_to > clock_timestamp())) ${extra}`;

const item = (r: Row): TeacherCheckpointItemDto => ({
  checkpointId: r.id,
  type: r.type,
  confirmedLessonCount: r.confirmed_lesson_count,
  triggeredAt: r.triggered_at.toISOString(),
  state: r.state,
  completedAt: r.completed_at?.toISOString() ?? null,
  enrollmentId: r.enrollment_id,
  studentId: r.student_id,
  studentName: r.student_name,
  subjectName: r.subject_name,
});

const contentOf = (value: unknown) => {
  const c = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const text = (k: string) => (typeof c[k] === 'string' ? (c[k] as string) : '');
  return {
    achievements: text('achievements'),
    growthAreas: text('growthAreas'),
    recommendations: text('recommendations'),
    teacherSignature: text('teacherSignature'),
  };
};

@Injectable()
export class TeacherCheckpointsService {
  constructor(private readonly db: DatabaseService) {}

  async list(
    ctx: TeacherContext,
    query: { state?: string; type?: string; limit?: number; cursor?: string },
  ): Promise<Result<TeacherCheckpointPageDto, DomainError>> {
    try {
      const limit = query.limit ?? 20;
      const cursor = query.cursor === undefined ? null : decode(query.cursor);
      if (query.cursor !== undefined && !cursor) return err(domainError('INVALID_CURSOR', 422));
      if (
        (query.state !== undefined &&
          !(CHECKPOINT_STATES as readonly string[]).includes(query.state)) ||
        (query.type !== undefined && !(CHECKPOINT_TYPES as readonly string[]).includes(query.type))
      )
        return err(domainError('INVALID_INPUT', 422));
      const rows = await this.db.client.$queryRaw<Row[]>(Prisma.sql`
        SELECT * FROM (${baseSql(
          ctx.teacherId,
          cursor
            ? Prisma.sql`AND (cp.triggered_at, cp.id) < (${cursor.at}::timestamptz, ${cursor.id}::uuid)`
            : Prisma.empty,
        )}) j
        WHERE true ${query.state ? Prisma.sql`AND j.state = ${query.state}` : Prisma.empty}
          ${query.type ? Prisma.sql`AND j.type = ${query.type}` : Prisma.empty}
        ORDER BY j.triggered_at DESC, j.id DESC LIMIT ${limit + 1}`);
      const page = rows.slice(0, limit);
      return ok({
        items: page.map(item),
        nextCursor: rows.length > limit ? encode(page[page.length - 1]!) : null,
      });
    } catch (error: unknown) {
      return err(failure(error));
    }
  }

  // The eight confirmed conducted lessons ending with the checkpoint's lesson (same scope the DB guard counts).
  private async window(
    client: Prisma.TransactionClient | DatabaseService['client'],
    studentId: string,
    subjectId: string,
    triggeredAt: Date,
  ): Promise<{ start: Date | null; end: Date | null; count: number }> {
    const rows = await client.$queryRaw<{ started: Date }[]>`
      SELECT o.actual_started_at AS started FROM lesson_actual_outcomes o
      JOIN lesson_occurrences l ON l.id = o.lesson_occurrence_id
      JOIN student_subject_enrollments e ON e.id = l.enrollment_id
      WHERE e.student_id = ${studentId}::uuid AND e.subject_id = ${subjectId}::uuid
        AND l.status = 'CONDUCTED' AND o.confirmed_at <= ${triggeredAt}::timestamptz
      ORDER BY o.confirmed_at DESC, o.id DESC LIMIT 8`;
    if (!rows.length) return { start: null, end: null, count: 0 };
    const times = rows.map((r) => +r.started);
    return {
      start: new Date(Math.min(...times)),
      end: new Date(Math.max(...times)),
      count: rows.length,
    };
  }

  async card(
    ctx: TeacherContext,
    id: string,
  ): Promise<Result<TeacherCheckpointCardDto, DomainError>> {
    if (!UUID_RE.test(id)) return err(domainError('INVALID_INPUT', 422));
    try {
      const row = (
        await this.db.client.$queryRaw<Row[]>(
          Prisma.sql`SELECT * FROM (${baseSql(ctx.teacherId, Prisma.sql`AND cp.id = ${id}::uuid`)}) j`,
        )
      )[0];
      if (!row) return err(domainError('NOT_FOUND', 404));
      const enrollment = await this.db.client.studentSubjectEnrollment.findUniqueOrThrow({
        where: { id: row.enrollment_id },
        select: { student_id: true, subject_id: true },
      });
      const report = await this.db.client.educationReport.findFirst({
        where: { checkpoint_id: id },
        orderBy: { version: 'desc' },
      });
      const win =
        row.type === 'LESSON_8'
          ? await this.window(
              this.db.client,
              enrollment.student_id,
              enrollment.subject_id,
              row.triggered_at,
            )
          : null;
      return ok({
        ...item(row),
        teacherSummary: row.teacher_summary,
        snapshotId:
          (
            await this.db.client.skillSnapshot.findUnique({
              where: { checkpoint_id: id },
              select: { id: true },
            })
          )?.id ?? null,
        suggestedPeriodStart: win?.start?.toISOString() ?? null,
        suggestedPeriodEnd: win?.end?.toISOString() ?? null,
        report: report
          ? {
              reportId: report.id,
              status: report.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT',
              periodStart: report.period_start.toISOString(),
              periodEnd: report.period_end.toISOString(),
              publishedAt: report.published_at?.toISOString() ?? null,
              ...contentOf(report.content),
            }
          : null,
      });
    } catch (error: unknown) {
      return err(failure(error));
    }
  }

  private async owned(ctx: CriticalContext, checkpointId: string) {
    if (!UUID_RE.test(checkpointId)) return fail(domainError('INVALID_INPUT', 422));
    const teacher = await ctx.tx.teacherAccount.findFirst({
      where: { account_id: ctx.actor.accountId, deactivated_at: null },
      select: { id: true },
    });
    if (!teacher) return fail(domainError('FORBIDDEN', 403));
    const now = await at(ctx.tx);
    const checkpoint = await ctx.tx.progressCheckpoint.findFirst({
      where: {
        id: checkpointId,
        enrollment_ref: {
          t03_teachingassignment_enrollment_id: {
            some: {
              teacher_id: teacher.id,
              valid_from: { lte: now },
              OR: [{ valid_to: null }, { valid_to: { gt: now } }],
            },
          },
        },
      },
      include: { enrollment_ref: { select: { student_id: true, subject_id: true } } },
    });
    if (!checkpoint) return fail(domainError('NOT_FOUND', 404));
    return { teacherId: teacher.id, checkpoint, now };
  }

  async complete(
    ctx: CriticalContext,
    checkpointId: string,
    body: CompleteCheckpointDto,
  ): Promise<CompleteCheckpointResponseDto> {
    const { teacherId, checkpoint, now } = await this.owned(ctx, checkpointId);
    if (checkpoint.type !== 'LESSON_4') return fail(domainError('CHECKPOINT_USES_REPORT', 409));
    await ctx.tx
      .$queryRaw`SELECT id FROM progress_checkpoints WHERE id=${checkpoint.id}::uuid FOR UPDATE`;
    if (checkpoint.completed_at) return fail(domainError('CHECKPOINT_ALREADY_COMPLETED', 409));
    await ctx.tx.progressCheckpoint.update({
      where: { id: checkpoint.id },
      data: {
        completed_at: now,
        completed_by: teacherId,
        teacher_summary: body.teacherSummary.trim(),
      },
    });
    const snapshot = await ctx.tx.skillSnapshot.findUnique({
      where: { checkpoint_id: checkpoint.id },
      select: { id: true },
    });
    return { id: checkpoint.id, completedAt: now.toISOString(), snapshotId: snapshot?.id ?? null };
  }

  async saveReport(
    ctx: CriticalContext,
    checkpointId: string,
    body: SaveReportDto,
  ): Promise<SaveReportResponseDto> {
    const { teacherId, checkpoint, now } = await this.owned(ctx, checkpointId);
    if (checkpoint.type !== 'LESSON_8') return fail(domainError('CHECKPOINT_HAS_NO_REPORT', 409));
    await ctx.tx
      .$queryRaw`SELECT id FROM progress_checkpoints WHERE id=${checkpoint.id}::uuid FOR UPDATE`;
    const win = await this.window(
      ctx.tx,
      checkpoint.enrollment_ref.student_id,
      checkpoint.enrollment_ref.subject_id,
      checkpoint.triggered_at,
    );
    if (win.count !== 8 || !win.start || !win.end)
      return fail(domainError('REPORT_NEEDS_EIGHT_LESSONS', 422));
    const content = {
      achievements: body.achievements.trim(),
      growthAreas: body.growthAreas.trim(),
      recommendations: body.recommendations.trim(),
      teacherSignature: body.teacherSignature.trim(),
    };
    const existing = await ctx.tx.educationReport.findFirst({
      where: { checkpoint_id: checkpoint.id },
      orderBy: { version: 'desc' },
    });
    if (existing?.status === 'PUBLISHED') return fail(domainError('REPORT_ALREADY_PUBLISHED', 409));
    if (existing) {
      if (existing.author_id !== teacherId) return fail(domainError('REPORT_AUTHOR_MISMATCH', 409));
      await ctx.tx.educationReport.update({
        where: { id: existing.id },
        data: { content, period_start: win.start, period_end: win.end },
      });
      return { id: existing.id, status: 'DRAFT' };
    }
    const created = await ctx.tx.educationReport.create({
      data: {
        checkpoint_id: checkpoint.id,
        author_id: teacherId,
        version: 1,
        period_start: win.start,
        period_end: win.end,
        content,
        created_at: now,
        source_operation_id: ctx.operationId,
      },
    });
    return { id: created.id, status: 'DRAFT' };
  }

  async publishReport(
    ctx: CriticalContext,
    checkpointId: string,
  ): Promise<PublishReportResponseDto> {
    const { teacherId, checkpoint, now } = await this.owned(ctx, checkpointId);
    await ctx.tx
      .$queryRaw`SELECT id FROM progress_checkpoints WHERE id=${checkpoint.id}::uuid FOR UPDATE`;
    const report = await ctx.tx.educationReport.findFirst({
      where: { checkpoint_id: checkpoint.id },
      orderBy: { version: 'desc' },
    });
    if (!report) return fail(domainError('REPORT_DRAFT_REQUIRED', 409));
    if (report.status === 'PUBLISHED') return fail(domainError('REPORT_ALREADY_PUBLISHED', 409));
    if (report.author_id !== teacherId) return fail(domainError('REPORT_AUTHOR_MISMATCH', 409));
    await ctx.tx.educationReport.update({
      where: { id: report.id },
      data: { status: 'PUBLISHED', generated_at: now, published_at: now, published_by: teacherId },
    });
    return { id: report.id, status: 'PUBLISHED', publishedAt: now.toISOString() };
  }
}
