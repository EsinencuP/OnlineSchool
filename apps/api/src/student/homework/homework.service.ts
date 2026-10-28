import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@online-school/db';
import { ok } from '@online-school/shared';
import { DatabaseService } from '../../core/database/database.module.js';
import { domainError, fail, unwrap } from '../../core/errors/domain-error.js';
import type { CriticalContext } from '../../core/http.js';
import { at, count } from '../../modules/finance/finance-common.js';
import { object, string, uuid } from '../../modules/identity/input.js';
import {
  PrivateUploads,
  MAX_HOMEWORK_FILE_BYTES,
  UPLOAD_TTL_SECONDS,
} from '../../modules/storage/private-uploads.service.js';
import { MeService } from '../me/me.service.js';
import type { IStudentContext } from '../student-context.interface.js';
import type {
  HomeworkQuery,
  HomeworkResponseDto,
  SavedDraftDto,
  SubmitResponseDto,
  UploadUrlResponseDto,
  ConfirmUploadResponseDto,
} from './homework.dto.js';

export const DRAFT_TTL_MS = 30 * 86400000;
export function homeworkProjectionSql(
  studentId: string,
  query: HomeworkQuery,
  now: Date,
  homeworkId?: string,
): Prisma.Sql {
  const filter = query.status ? Prisma.sql`WHERE status=${query.status}` : Prisma.empty;
  const selected = homeworkId ? Prisma.sql`AND d.id=${homeworkId}::uuid` : Prisma.empty;
  return Prisma.sql`
    WITH scoped AS (
      SELECT d.id,d.issued_at,d.due_at,d.assignment_id,a.title,a.content,s.name AS subject_name,t.full_name AS teacher_name,
        draft.content AS draft_content,
        CASE WHEN latest.id IS NULL THEN 'NOT_SUBMITTED' WHEN review.result='NEEDS_REVISION' THEN 'NEEDS_REVISION'
          WHEN review.result='ACCEPTED' THEN 'REVIEWED' ELSE 'SUBMITTED' END AS status,
        COALESCE(latest.submitted_at>d.due_at,false) AS is_late
      FROM homework_deliveries d JOIN student_subject_enrollments e ON e.id=d.enrollment_id
      JOIN homework_assignments a ON a.id=d.assignment_id JOIN subjects s ON s.id=a.subject_id
      JOIN teacher_accounts t ON t.id=d.issued_by
      LEFT JOIN homework_drafts draft ON draft.delivery_id=d.id AND draft.expires_at>${now}
      LEFT JOIN LATERAL (SELECT h.id,h.submitted_at FROM homework_submissions h
        WHERE h.delivery_id=d.id AND h.student_id=e.student_id AND h.submitted_at<=${now}
        ORDER BY h.version DESC LIMIT 1) latest ON true
      LEFT JOIN LATERAL (SELECT r.result FROM submission_reviews r WHERE r.submission_id=latest.id
        AND r.reviewed_at<=${now} ORDER BY r.version DESC LIMIT 1) review ON true
      WHERE e.student_id=${studentId}::uuid ${selected} AND d.issued_at<=${now} AND a.archived_at IS NULL
        AND (d.cancelled_at IS NULL OR d.cancelled_at>${now})
    ), filtered AS (SELECT * FROM scoped ${filter}), paged AS (
      SELECT * FROM filtered ORDER BY issued_at DESC,id DESC LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}
    ), result AS (
      SELECT p.issued_at,p.id,jsonb_build_object('homeworkId',p.id,'assignedAt',p.issued_at,'dueAt',p.due_at,
        'subjectName',p.subject_name,'teacherName',p.teacher_name,'title',p.title,
        'description',CASE WHEN jsonb_typeof(p.content)='string' THEN p.content#>>'{}'
          ELSE COALESCE(p.content->>'text',p.content->>'description','') END,
        'status',p.status,'isLate',p.is_late,'draftContent',p.draft_content,
        'versions',COALESCE(v.versions,'[]'::jsonb),'latestVersion',v.versions->0,
        'attachments',COALESCE(a.files,'[]'::jsonb)) AS item
      FROM paged p LEFT JOIN LATERAL (
        SELECT jsonb_agg(jsonb_build_object('versionNumber',h.version,'content',
          CASE WHEN jsonb_typeof(h.content)='string' THEN h.content#>>'{}' ELSE COALESCE(h.content->>'text','') END,
          'submittedAt',h.submitted_at,'teacherComment',r.comment,'teacherStatus',
          CASE r.result WHEN 'ACCEPTED' THEN 'REVIEWED' WHEN 'NEEDS_REVISION' THEN 'NEEDS_REVISION' ELSE NULL END,
          'attachments',COALESCE(f.files,'[]'::jsonb)) ORDER BY h.version DESC) AS versions
        FROM homework_submissions h
        LEFT JOIN LATERAL (SELECT sr.comment,sr.result FROM submission_reviews sr WHERE sr.submission_id=h.id
          AND sr.reviewed_at<=${now} ORDER BY sr.version DESC LIMIT 1) r ON true
        LEFT JOIN LATERAL (SELECT jsonb_agg(jsonb_build_object('fileId',o.id,'fileName',COALESCE(o.file_name,'attachment'),
          'fileSizeBytes',o.size,'mimeType',o.content_type) ORDER BY o.id) AS files
          FROM homework_submission_attachments ha JOIN s3_objects o ON o.id=ha.file_id
          WHERE ha.submission_id=h.id AND o.status='VERIFIED') f ON true
        WHERE h.delivery_id=p.id AND h.student_id=${studentId}::uuid AND h.submitted_at<=${now}
      ) v ON true LEFT JOIN LATERAL (
        SELECT jsonb_agg(jsonb_build_object('fileId',o.id,'fileName',COALESCE(o.file_name,'attachment'),
          'fileSizeBytes',o.size,'mimeType',o.content_type) ORDER BY o.id) AS files
        FROM homework_assignment_attachments ha JOIN s3_objects o ON o.id=ha.file_id
        WHERE ha.assignment_id=p.assignment_id AND o.status='VERIFIED'
      ) a ON true
    ) SELECT COALESCE((SELECT jsonb_agg(item ORDER BY issued_at DESC,id DESC) FROM result),'[]'::jsonb) AS items,
      (SELECT count(*)::int FROM filtered) AS total`;
}

@Injectable()
export class StudentHomeworkService {
  constructor(
    private readonly database: DatabaseService,
    private readonly me: MeService,
    private readonly storage: PrivateUploads,
  ) {}
  async list(
    student: IStudentContext,
    query: HomeworkQuery,
    homeworkId?: string,
  ): Promise<HomeworkResponseDto> {
    const [row] = await this.database.client.$queryRaw<
      Pick<HomeworkResponseDto, 'items' | 'total'>[]
    >(homeworkProjectionSql(student.studentProfileId, query, new Date(), homeworkId));
    if (!row) return fail(domainError('HOMEWORK_UNAVAILABLE', 503));
    for (const item of row.items) {
      item.assignedAt = new Date(item.assignedAt).toISOString();
      if (item.dueAt) item.dueAt = new Date(item.dueAt).toISOString();
      for (const version of item.versions)
        version.submittedAt = new Date(version.submittedAt).toISOString();
      item.latestVersion = item.versions[0] ?? null;
    }
    return { ...row, page: query.page, pageSize: query.pageSize };
  }
  async owns(
    tx: Pick<Prisma.TransactionClient, 'homeworkDelivery'>,
    studentId: string,
    id: string,
  ): Promise<boolean> {
    return !!(await tx.homeworkDelivery.findFirst({
      where: { id, enrollment_ref: { student_id: studentId } },
      select: { id: true },
    }));
  }
  async authorize(tx: Prisma.TransactionClient, userId: string, studentId: string, id: string) {
    const loaded = unwrap(await this.me.load(userId, tx)).context;
    if (loaded.studentProfileId !== studentId || !(await this.owns(tx, studentId, id)))
      return fail(domainError('HOMEWORK_FORBIDDEN', 403));
    if (loaded.mustChangePassword) return fail(domainError('MUST_CHANGE_PASSWORD', 403));
    if (!loaded.hasActiveAccess) return fail(domainError('ACCESS_SUSPENDED', 402));
    return ok(loaded);
  }
  private async editable(ctx: CriticalContext, student: IStudentContext, id: string) {
    const [delivery] = await ctx.tx.$queryRaw<
      {
        id: string;
        due_at: Date | null;
        student_id: string;
        issued_at: Date;
        cancelled_at: Date | null;
        archived_at: Date | null;
      }[]
    >`
      SELECT d.id,d.due_at,d.issued_at,d.cancelled_at,a.archived_at,e.student_id
      FROM homework_deliveries d JOIN student_subject_enrollments e ON e.id=d.enrollment_id
      JOIN homework_assignments a ON a.id=d.assignment_id WHERE d.id=${id}::uuid FOR UPDATE OF d`;
    if (!delivery || delivery.student_id !== student.studentProfileId)
      return fail(domainError('HOMEWORK_FORBIDDEN', 403));
    const now = await at(ctx.tx);
    if (
      delivery.issued_at > now ||
      delivery.archived_at ||
      (delivery.cancelled_at && delivery.cancelled_at <= now)
    )
      return fail(domainError('HOMEWORK_UNAVAILABLE', 422));
    const latest = await ctx.tx.homeworkSubmission.findFirst({
      where: { delivery_id: id },
      orderBy: { version: 'desc' },
    });
    const review = latest
      ? await ctx.tx.submissionReview.findFirst({
          where: { submission_id: latest.id },
          orderBy: { version: 'desc' },
        })
      : null;
    if (latest && review?.result !== 'NEEDS_REVISION')
      return fail(
        domainError(
          latest && review?.result === 'ACCEPTED'
            ? 'HOMEWORK_ALREADY_REVIEWED'
            : 'ALREADY_SUBMITTED',
          409,
        ),
      );
    return { delivery, latest, now };
  }
  async draft(
    ctx: CriticalContext,
    student: IStudentContext,
    id: string,
    body: unknown,
  ): Promise<SavedDraftDto> {
    const input = object(body, ['content']);
    if (typeof input.content !== 'string' || input.content.length > 10000)
      return fail(domainError('INVALID_INPUT', 400));
    const { now } = await this.editable(ctx, student, id);
    const expires = new Date(+now + DRAFT_TTL_MS);
    await ctx.tx.homeworkDraft.upsert({
      where: { delivery_id: id },
      create: { delivery_id: id, content: input.content, expires_at: expires },
      update: { content: input.content, expires_at: expires },
    });
    return { homeworkId: id, status: 'SAVED', expiresAt: expires.toISOString() };
  }
  async prepareUpload(
    ctx: CriticalContext,
    student: IStudentContext,
    id: string,
    body: unknown,
  ): Promise<{ fileId: string }> {
    const input = object(body, ['fileName', 'fileSizeBytes', 'mimeType']);
    const fileName = string(input.fileName, 1, 255),
      mimeType = string(input.mimeType, 3, 127),
      size = count(input.fileSizeBytes, 1, MAX_HOMEWORK_FILE_BYTES);
    if (
      [...fileName].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127) ||
      /[\\/]/.test(fileName) ||
      !/^[a-zA-Z0-9!#$&^_.+-]+\/[a-zA-Z0-9!#$&^_.+-]+$/.test(mimeType)
    )
      return fail(domainError('INVALID_INPUT', 400));
    const { now } = await this.editable(ctx, student, id),
      fileId = randomUUID();
    await ctx.tx.s3Object.create({
      data: {
        id: fileId,
        bucket: this.storage.bucket(),
        key: `homework/final/${fileId}`,
        file_name: fileName,
        size: BigInt(size),
        content_type: mimeType,
        uploaded_by: student.userId,
        source_operation_id: ctx.operationId,
        homework_upload: {
          create: {
            delivery_id: id,
            staging_key: `homework/incoming/${fileId}`,
            expires_at: new Date(+now + UPLOAD_TTL_SECONDS * 1000),
          },
        },
      },
    });
    return { fileId };
  }
  async uploadUrl(
    student: IStudentContext,
    id: string,
    result: unknown,
  ): Promise<UploadUrlResponseDto> {
    const fileId = uuid(object(result, ['fileId']).fileId);
    const upload = await this.database.client.homeworkUpload.findFirst({
      where: {
        file_id: fileId,
        delivery_id: id,
        file: { uploaded_by: student.userId, status: 'PENDING' },
      },
      include: { file: true },
    });
    if (!upload) return fail(domainError('UPLOAD_NOT_PENDING', 409));
    const uploadUrl = await this.storage.sign({
      bucket: upload.file.bucket,
      key: upload.file.key,
      stagingKey: upload.staging_key,
      size: Number(upload.file.size),
      mimeType: upload.file.content_type,
      expiresAt: upload.expires_at,
    });
    return { fileId, uploadUrl };
  }
  async confirm(
    ctx: CriticalContext,
    student: IStudentContext,
    id: string,
    fileId: string,
  ): Promise<ConfirmUploadResponseDto> {
    await this.editable(ctx, student, id);
    await ctx.tx.$queryRaw`SELECT id FROM s3_objects WHERE id=${fileId}::uuid FOR UPDATE`;
    const upload = await ctx.tx.homeworkUpload.findFirst({
      where: { file_id: fileId, delivery_id: id, file: { uploaded_by: student.userId } },
      include: { file: true },
    });
    if (!upload) return fail(domainError('FILE_FORBIDDEN', 403));
    if (upload.confirmed_at && upload.file.status === 'VERIFIED')
      return { fileId, status: 'VERIFIED' };
    if (upload.file.status !== 'PENDING') return fail(domainError('UPLOAD_NOT_PENDING', 409));
    await this.storage.confirm({
      bucket: upload.file.bucket,
      key: upload.file.key,
      stagingKey: upload.staging_key,
      size: Number(upload.file.size),
      mimeType: upload.file.content_type,
      expiresAt: upload.expires_at,
    });
    const now = await at(ctx.tx);
    await ctx.tx.s3Object.update({
      where: { id: fileId },
      data: { status: 'VERIFIED', uploaded_at: now, verified_at: now },
    });
    await ctx.tx.homeworkUpload.update({ where: { file_id: fileId }, data: { confirmed_at: now } });
    return { fileId, status: 'VERIFIED' };
  }
  async submit(
    ctx: CriticalContext,
    student: IStudentContext,
    id: string,
    body: unknown,
  ): Promise<SubmitResponseDto> {
    const input = object(body, ['content', 'fileIds']);
    // Preserve the student's formatting; trimming is used for validation only.
    string(input.content, 1, 10000);
    if (input.fileIds !== undefined && (!Array.isArray(input.fileIds) || input.fileIds.length > 20))
      return fail(domainError('INVALID_INPUT', 400));
    const fileIds = ((input.fileIds ?? []) as unknown[]).map(uuid);
    if (new Set(fileIds).size !== fileIds.length) return fail(domainError('INVALID_INPUT', 400));
    const { delivery, latest, now } = await this.editable(ctx, student, id);
    if (fileIds.length) {
      await ctx.tx.$queryRaw(
        Prisma.sql`SELECT id FROM s3_objects WHERE id IN (${Prisma.join(fileIds.map((fileId) => Prisma.sql`${fileId}::uuid`))}) ORDER BY id FOR UPDATE`,
      );
      const files = await ctx.tx.homeworkUpload.findMany({
        where: {
          delivery_id: id,
          file_id: { in: fileIds },
          confirmed_at: { not: null },
          file: { uploaded_by: student.userId, status: 'VERIFIED' },
        },
      });
      if (files.length !== fileIds.length) return fail(domainError('FILE_NOT_CONFIRMED', 422));
    }
    const submissionId = randomUUID(),
      versionNumber = (latest?.version ?? 0) + 1;
    await ctx.tx.homeworkSubmission.create({
      data: {
        id: submissionId,
        delivery_id: id,
        student_id: student.studentProfileId,
        submitted_at: now,
        version: versionNumber,
        content: { text: input.content as string },
        supersedes_submission_id: latest?.id ?? null,
        source_operation_id: ctx.operationId,
        attachments: { create: fileIds.map((fileId) => ({ file_id: fileId })) },
      },
    });
    // Runtime roles cannot delete educational records. Erase plaintext and expire the single draft row atomically.
    await ctx.tx.homeworkDraft.updateMany({
      where: { delivery_id: id },
      data: { content: '', expires_at: now },
    });
    return {
      submissionId,
      status: 'SUBMITTED',
      isLate: !!delivery.due_at && now > delivery.due_at,
      versionNumber,
    };
  }
}
