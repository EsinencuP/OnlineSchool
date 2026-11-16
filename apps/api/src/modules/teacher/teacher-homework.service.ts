import { createHash } from 'node:crypto';
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
import { HOMEWORK_STATES } from './dto/teacher-homework.dto.js';
import type {
  HomeworkState,
  IssueHomeworkDto,
  IssueHomeworkResponseDto,
  ReviewHomeworkDto,
  ReviewHomeworkResponseDto,
  TeacherHomeworkCardDto,
  TeacherHomeworkItemDto,
  TeacherHomeworkPageDto,
} from './dto/teacher-homework.dto.js';

const failure = (error: unknown): DomainError =>
  error instanceof AppException ? error.domain : domainError('DATABASE_ERROR', 503);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Unique per-row operation ids derived from the command key (unique columns need one id per row).
const derive = (operationId: string, tag: string): string => {
  const h = createHash('sha256').update(`${operationId}:${tag}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
};

type Row = {
  id: string;
  title: string;
  issued_at: Date;
  due_at: Date | null;
  student_id: string;
  student_name: string;
  subject_name: string;
  submission_count: number;
  latest_submitted_at: Date | null;
  is_late: boolean;
  state: HomeworkState;
};

const encode = (row: Row) =>
  Buffer.from(JSON.stringify([row.issued_at.toISOString(), row.id])).toString('base64url');
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

// Status rules mirror the student side (student/homework/homework.service.ts).
const baseSql = (teacherId: string, extra: Prisma.Sql) => Prisma.sql`
  SELECT d.id, a.title, d.issued_at, d.due_at, e.student_id,
         COALESCE(s.display_name, s.full_name) AS student_name, sub.name AS subject_name,
         (SELECT count(*)::int FROM homework_submissions h WHERE h.delivery_id = d.id) AS submission_count,
         latest.submitted_at AS latest_submitted_at,
         COALESCE(latest.submitted_at > d.due_at, false) AS is_late,
         CASE WHEN d.cancelled_at IS NOT NULL THEN 'CANCELLED'
              WHEN latest.id IS NULL THEN 'NOT_SUBMITTED'
              WHEN review.result IS NULL THEN 'AWAITING_REVIEW'
              WHEN review.result = 'NEEDS_REVISION' THEN 'NEEDS_REVISION'
              ELSE 'REVIEWED' END AS state
  FROM homework_deliveries d
  JOIN homework_assignments a ON a.id = d.assignment_id
  JOIN student_subject_enrollments e ON e.id = d.enrollment_id
  JOIN students s ON s.id = e.student_id
  JOIN subjects sub ON sub.id = e.subject_id
  LEFT JOIN LATERAL (SELECT id, submitted_at FROM homework_submissions
                     WHERE delivery_id = d.id ORDER BY version DESC LIMIT 1) latest ON true
  LEFT JOIN LATERAL (SELECT result::text AS result FROM submission_reviews
                     WHERE submission_id = latest.id ORDER BY version DESC LIMIT 1) review ON true
  WHERE d.issued_by = ${teacherId}::uuid AND d.issued_at <= clock_timestamp() ${extra}`;

const item = (r: Row): TeacherHomeworkItemDto => ({
  deliveryId: r.id,
  title: r.title,
  issuedAt: r.issued_at.toISOString(),
  dueAt: r.due_at?.toISOString() ?? null,
  state: r.state,
  studentId: r.student_id,
  studentName: r.student_name,
  subjectName: r.subject_name,
  submissionCount: r.submission_count,
  latestSubmittedAt: r.latest_submitted_at?.toISOString() ?? null,
  isLate: r.is_late,
});

const textOf = (content: unknown): string => {
  if (typeof content === 'string') return content;
  if (content && typeof content === 'object') {
    const c = content as Record<string, unknown>;
    for (const key of ['text', 'description'])
      if (typeof c[key] === 'string') return c[key] as string;
  }
  return '';
};

@Injectable()
export class TeacherHomeworkService {
  constructor(private readonly db: DatabaseService) {}

  async list(
    ctx: TeacherContext,
    query: { state?: string; limit?: number; cursor?: string },
  ): Promise<Result<TeacherHomeworkPageDto, DomainError>> {
    try {
      const limit = query.limit ?? 20;
      const cursor = query.cursor === undefined ? null : decode(query.cursor);
      if (query.cursor !== undefined && !cursor) return err(domainError('INVALID_CURSOR', 422));
      if (
        query.state !== undefined &&
        !(HOMEWORK_STATES as readonly string[]).includes(query.state)
      )
        return err(domainError('INVALID_INPUT', 422));
      const rows = await this.db.client.$queryRaw<Row[]>(Prisma.sql`
        SELECT * FROM (${baseSql(
          ctx.teacherId,
          cursor
            ? Prisma.sql`AND (d.issued_at, d.id) < (${cursor.at}::timestamptz, ${cursor.id}::uuid)`
            : Prisma.empty,
        )}) j
        ${query.state ? Prisma.sql`WHERE j.state = ${query.state}` : Prisma.empty}
        ORDER BY j.issued_at DESC, j.id DESC
        LIMIT ${limit + 1}`);
      const page = rows.slice(0, limit);
      return ok({
        items: page.map(item),
        nextCursor: rows.length > limit ? encode(page[page.length - 1]!) : null,
      });
    } catch (error: unknown) {
      return err(failure(error));
    }
  }

  async card(
    ctx: TeacherContext,
    id: string,
  ): Promise<Result<TeacherHomeworkCardDto, DomainError>> {
    if (!UUID_RE.test(id)) return err(domainError('INVALID_INPUT', 422));
    try {
      const rows = await this.db.client.$queryRaw<Row[]>(
        Prisma.sql`SELECT * FROM (${baseSql(ctx.teacherId, Prisma.sql`AND d.id = ${id}::uuid`)}) j`,
      );
      const row = rows[0];
      if (!row) return err(domainError('NOT_FOUND', 404));
      const delivery = await this.db.client.homeworkDelivery.findUniqueOrThrow({
        where: { id },
        select: {
          assignment_ref: { select: { content: true, lesson_occurrence_id: true } },
          t04_homeworksubmission_delivery_id: {
            orderBy: { version: 'desc' },
            select: {
              id: true,
              version: true,
              submitted_at: true,
              content: true,
              t04_submissionreview_submission_id: { orderBy: { version: 'desc' }, take: 1 },
            },
          },
        },
      });
      return ok({
        ...item(row),
        description: textOf(delivery.assignment_ref.content),
        lessonId: delivery.assignment_ref.lesson_occurrence_id,
        canReview: row.state === 'AWAITING_REVIEW',
        submissions: delivery.t04_homeworksubmission_delivery_id.map((s) => {
          const review = s.t04_submissionreview_submission_id[0];
          return {
            submissionId: s.id,
            version: s.version,
            submittedAt: s.submitted_at.toISOString(),
            text: textOf(s.content),
            review: review
              ? {
                  reviewId: review.id,
                  result: review.result,
                  comment: review.comment,
                  reviewedAt: review.reviewed_at.toISOString(),
                }
              : null,
          };
        }),
      });
    } catch (error: unknown) {
      return err(failure(error));
    }
  }

  private async teacher(ctx: CriticalContext): Promise<string> {
    const t = await ctx.tx.teacherAccount.findFirst({
      where: { account_id: ctx.actor.accountId, deactivated_at: null },
      select: { id: true },
    });
    return t?.id ?? fail(domainError('FORBIDDEN', 403));
  }

  async issue(ctx: CriticalContext, body: IssueHomeworkDto): Promise<IssueHomeworkResponseDto> {
    const teacher = await this.teacher(ctx);
    const now = await at(ctx.tx);
    const due = body.dueAt ? new Date(body.dueAt) : null;
    if (due && +due <= +now) return fail(domainError('HOMEWORK_DUE_IN_PAST', 422));
    const enrollments = await ctx.tx.studentSubjectEnrollment.findMany({
      where: { id: { in: body.enrollmentIds } },
      select: { id: true, student_id: true, subject_id: true, status: true },
    });
    if (enrollments.length !== body.enrollmentIds.length)
      return fail(domainError('FORBIDDEN', 403)); // unknown ids look the same as unassigned ones
    const assigned = await ctx.tx.teachingAssignment.findMany({
      where: {
        teacher_id: teacher,
        enrollment_id: { in: body.enrollmentIds },
        valid_from: { lte: now },
        OR: [{ valid_to: null }, { valid_to: { gt: now } }],
      },
      select: { enrollment_id: true },
    });
    const assignedSet = new Set(assigned.map((a) => a.enrollment_id));
    if (enrollments.some((e) => !assignedSet.has(e.id)))
      return fail(domainError('HOMEWORK_ENROLLMENT_NOT_ASSIGNED', 403));
    if (enrollments.some((e) => e.status !== 'ACTIVE'))
      return fail(domainError('ENROLLMENT_INACTIVE', 422));
    const subjectId = enrollments[0]!.subject_id;
    if (enrollments.some((e) => e.subject_id !== subjectId))
      return fail(domainError('HOMEWORK_SUBJECT_MISMATCH', 422));
    if (body.lessonId) {
      const lesson = await ctx.tx.lessonOccurrence.findUnique({
        where: { id: body.lessonId },
        select: { scheduled_teacher_id: true, enrollment_id: true },
      });
      if (
        !lesson ||
        lesson.scheduled_teacher_id !== teacher ||
        !body.enrollmentIds.includes(lesson.enrollment_id)
      )
        return fail(domainError('HOMEWORK_LESSON_NOT_APPLICABLE', 422));
    }
    const assignment = await ctx.tx.homeworkAssignment.create({
      data: {
        subject_id: subjectId,
        issued_by: teacher,
        title: body.title.trim(),
        content: { text: body.description },
        due_at: due,
        lesson_occurrence_id: body.lessonId ?? null,
        source_operation_id: ctx.operationId,
      },
    });
    const files = body.attachmentFileIds ?? [];
    if (files.length) {
      const owned = await ctx.tx.$queryRaw<{ id: string }[]>`
        SELECT o.id FROM teacher_material_uploads u JOIN s3_objects o ON o.id = u.file_id
        WHERE u.teacher_id = ${teacher}::uuid AND o.status = 'VERIFIED'
          AND o.id = ANY(${files}::uuid[])`;
      if (owned.length !== files.length)
        return fail(domainError('HOMEWORK_ATTACHMENT_NOT_AVAILABLE', 422));
      await ctx.tx.homeworkAssignmentAttachment.createMany({
        data: files.map((file_id) => ({ assignment_id: assignment.id, file_id })),
      });
    }
    const deliveries = [];
    for (const e of enrollments) {
      const delivery = await ctx.tx.homeworkDelivery.create({
        data: {
          assignment_id: assignment.id,
          enrollment_id: e.id,
          issued_by: teacher,
          issued_at: now,
          due_at: due,
          source_operation_id: derive(ctx.operationId, `delivery:${e.id}`),
        },
      });
      deliveries.push({ deliveryId: delivery.id, enrollmentId: e.id, studentId: e.student_id });
      // The student opens attachments through the ordinary material access (signed URL), so grant it.
      if (files.length) {
        const account = await ctx.tx.studentAccount.findFirst({
          where: { student_id: e.student_id, deactivated_at: null },
          select: { account_id: true },
        });
        if (account)
          for (const fileId of files) {
            const exists = await ctx.tx.filePermission.findFirst({
              where: {
                s3_object_id: fileId,
                subject_id: account.account_id,
                subject_type: 'STUDENT',
                revoked_at: null,
              },
              select: { id: true },
            });
            if (!exists)
              await ctx.tx.filePermission.create({
                data: {
                  s3_object_id: fileId,
                  subject_id: account.account_id,
                  subject_type: 'STUDENT',
                  granted_by: ctx.actor.accountId,
                  granted_at: now,
                  can_download: true,
                  educational_subject_id: subjectId,
                  lesson_occurrence_id: body.lessonId ?? null,
                  source_operation_id: derive(ctx.operationId, `grant:${e.id}:${fileId}`),
                },
              });
          }
      }
    }
    return { id: assignment.id, deliveries };
  }

  async review(
    ctx: CriticalContext,
    deliveryId: string,
    body: ReviewHomeworkDto,
  ): Promise<ReviewHomeworkResponseDto> {
    if (!UUID_RE.test(deliveryId)) return fail(domainError('INVALID_INPUT', 422));
    const teacher = await this.teacher(ctx);
    await ctx.tx
      .$queryRaw`SELECT id FROM homework_deliveries WHERE id=${deliveryId}::uuid FOR UPDATE`;
    const delivery = await ctx.tx.homeworkDelivery.findUnique({
      where: { id: deliveryId },
      select: { issued_by: true, cancelled_at: true },
    });
    if (!delivery || delivery.issued_by !== teacher) return fail(domainError('NOT_FOUND', 404));
    if (delivery.cancelled_at) return fail(domainError('HOMEWORK_CANCELLED', 409));
    const comment = body.comment?.trim() || null;
    if (body.result === 'NEEDS_REVISION' && !comment)
      return fail(domainError('REVIEW_COMMENT_REQUIRED', 422));
    const latest = await ctx.tx.homeworkSubmission.findFirst({
      where: { delivery_id: deliveryId },
      orderBy: { version: 'desc' },
      select: { id: true },
    });
    if (!latest || latest.id !== body.submissionId)
      return fail(domainError('NOT_LATEST_SUBMISSION', 409));
    if (await ctx.tx.submissionReview.findFirst({ where: { submission_id: latest.id } }))
      return fail(domainError('HOMEWORK_ALREADY_REVIEWED', 409));
    const review = await ctx.tx.submissionReview.create({
      data: {
        submission_id: latest.id,
        reviewer_id: teacher,
        version: 1,
        result: body.result,
        comment,
        reviewed_at: await at(ctx.tx),
        source_operation_id: ctx.operationId,
      },
    });
    return { id: review.id, deliveryId, submissionId: latest.id, result: body.result };
  }
}
