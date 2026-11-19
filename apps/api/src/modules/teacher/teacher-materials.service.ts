import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@online-school/db';
import { err, ok } from '@online-school/shared';
import type { Result } from '@online-school/shared';
import { DatabaseService } from '../../core/database/database.module.js';
import { AppException, domainError, fail } from '../../core/errors/domain-error.js';
import type { DomainError } from '../../core/errors/domain-error.js';
import type { CriticalContext } from '../../core/http.js';
import { at } from '../finance/finance-common.js';
import { PrivateUploads, UPLOAD_TTL_SECONDS } from '../storage/private-uploads.service.js';
import type { TeacherContext } from './context/teacher-context.js';
import { MATERIAL_STATES } from './dto/teacher-materials.dto.js';
import type {
  MaterialConfirmResponseDto,
  MaterialUploadResponseDto,
  RequestMaterialUploadDto,
  RevokeMaterialResponseDto,
  ShareMaterialDto,
  ShareMaterialResponseDto,
  TeacherMaterialPageDto,
  TeacherSharedMaterialsDto,
} from './dto/teacher-materials.dto.js';

const failure = (error: unknown): DomainError =>
  error instanceof AppException ? error.domain : domainError('DATABASE_ERROR', 503);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Row = {
  id: string;
  file_name: string | null;
  size: bigint;
  content_type: string;
  status: 'PENDING' | 'VERIFIED';
  created_at: Date;
  active_grants: number;
};
const encode = (r: Row) =>
  Buffer.from(JSON.stringify([r.created_at.toISOString(), r.id])).toString('base64url');
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

@Injectable()
export class TeacherMaterialsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly storage: PrivateUploads,
  ) {}

  private async teacher(ctx: CriticalContext): Promise<string> {
    const t = await ctx.tx.teacherAccount.findFirst({
      where: { account_id: ctx.actor.accountId, deactivated_at: null },
      select: { id: true },
    });
    return t?.id ?? fail(domainError('FORBIDDEN', 403));
  }

  async requestUpload(
    ctx: CriticalContext,
    body: RequestMaterialUploadDto,
  ): Promise<MaterialUploadResponseDto> {
    const teacher = await this.teacher(ctx);
    const fileName = body.fileName.trim();
    if (
      !fileName ||
      [...fileName].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127) ||
      /[\\/]/.test(fileName)
    )
      return fail(domainError('INVALID_INPUT', 422));
    const now = await at(ctx.tx);
    const id = randomUUID();
    const expiresAt = new Date(+now + UPLOAD_TTL_SECONDS * 1000);
    const bucket = this.storage.bucket();
    await ctx.tx.s3Object.create({
      data: {
        id,
        bucket,
        key: `materials/final/${id}`,
        file_name: fileName,
        size: BigInt(body.fileSizeBytes),
        content_type: body.mimeType,
        uploaded_by: ctx.actor.accountId,
        source_operation_id: ctx.operationId,
      },
    });
    await ctx.tx.$executeRaw`
      INSERT INTO teacher_material_uploads (file_id, teacher_id, staging_key, expires_at)
      VALUES (${id}::uuid, ${teacher}::uuid, ${'materials/incoming/' + id}, ${expiresAt}::timestamptz)`;
    const uploadUrl = await this.storage.sign({
      bucket,
      key: `materials/final/${id}`,
      stagingKey: `materials/incoming/${id}`,
      size: body.fileSizeBytes,
      mimeType: body.mimeType,
      expiresAt,
    });
    return { id, uploadUrl, expiresAt: expiresAt.toISOString() };
  }

  async confirm(ctx: CriticalContext, fileId: string): Promise<MaterialConfirmResponseDto> {
    if (!UUID_RE.test(fileId)) return fail(domainError('INVALID_INPUT', 422));
    const teacher = await this.teacher(ctx);
    await ctx.tx.$queryRaw`SELECT id FROM s3_objects WHERE id=${fileId}::uuid FOR UPDATE`;
    const [upload] = await ctx.tx.$queryRaw<
      { staging_key: string; expires_at: Date; confirmed_at: Date | null }[]
    >`SELECT staging_key, expires_at, confirmed_at FROM teacher_material_uploads
      WHERE file_id=${fileId}::uuid AND teacher_id=${teacher}::uuid`;
    const file = upload ? await ctx.tx.s3Object.findUnique({ where: { id: fileId } }) : null;
    if (!upload || !file) return fail(domainError('NOT_FOUND', 404));
    if (file.status === 'VERIFIED') return { id: fileId, status: 'VERIFIED' };
    if (file.status !== 'PENDING') return fail(domainError('UPLOAD_NOT_PENDING', 409));
    await this.storage.confirm({
      bucket: file.bucket,
      key: file.key,
      stagingKey: upload.staging_key,
      size: Number(file.size),
      mimeType: file.content_type,
      expiresAt: upload.expires_at,
    });
    const now = await at(ctx.tx);
    await ctx.tx.s3Object.update({
      where: { id: fileId },
      data: { status: 'VERIFIED', uploaded_at: now, verified_at: now },
    });
    await ctx.tx
      .$executeRaw`UPDATE teacher_material_uploads SET confirmed_at=${now}::timestamptz WHERE file_id=${fileId}::uuid`;
    return { id: fileId, status: 'VERIFIED' };
  }

  async list(
    ctx: TeacherContext,
    query: { state?: string; limit?: number; cursor?: string },
  ): Promise<Result<TeacherMaterialPageDto, DomainError>> {
    try {
      const limit = query.limit ?? 20;
      const cursor = query.cursor === undefined ? null : decode(query.cursor);
      if (query.cursor !== undefined && !cursor) return err(domainError('INVALID_CURSOR', 422));
      if (
        query.state !== undefined &&
        !(MATERIAL_STATES as readonly string[]).includes(query.state)
      )
        return err(domainError('INVALID_INPUT', 422));
      const rows = await this.db.client.$queryRaw<Row[]>(Prisma.sql`
        SELECT o.id, o.file_name, o.size, o.content_type, o.status::text AS status, o.created_at,
               (SELECT count(*)::int FROM file_permissions p WHERE p.s3_object_id = o.id
                  AND p.revoked_at IS NULL AND (p.expires_at IS NULL OR p.expires_at > clock_timestamp())) AS active_grants
        FROM teacher_material_uploads u JOIN s3_objects o ON o.id = u.file_id
        WHERE u.teacher_id = ${ctx.teacherId}::uuid AND o.status IN ('PENDING','VERIFIED')
          ${query.state ? Prisma.sql`AND o.status::text = ${query.state}` : Prisma.empty}
          ${cursor ? Prisma.sql`AND (o.created_at, o.id) < (${cursor.at}::timestamptz, ${cursor.id}::uuid)` : Prisma.empty}
        ORDER BY o.created_at DESC, o.id DESC LIMIT ${limit + 1}`);
      const page = rows.slice(0, limit);
      return ok({
        items: page.map((r) => ({
          fileId: r.id,
          fileName: r.file_name ?? 'Материал',
          sizeBytes: Number(r.size),
          mimeType: r.content_type,
          status: r.status,
          createdAt: r.created_at.toISOString(),
          activeGrants: r.active_grants,
        })),
        nextCursor: rows.length > limit ? encode(page[page.length - 1]!) : null,
      });
    } catch (error: unknown) {
      return err(failure(error));
    }
  }

  private async ownedEnrollment(
    client: Prisma.TransactionClient | DatabaseService['client'],
    teacherId: string,
    enrollmentId: string,
    now: Date,
  ) {
    const enrollment = await client.studentSubjectEnrollment.findFirst({
      where: {
        id: enrollmentId,
        t03_teachingassignment_enrollment_id: {
          some: {
            teacher_id: teacherId,
            valid_from: { lte: now },
            OR: [{ valid_to: null }, { valid_to: { gt: now } }],
          },
        },
      },
      select: { id: true, student_id: true, subject_id: true, status: true },
    });
    return enrollment ?? fail(domainError('NOT_FOUND', 404));
  }

  async share(
    ctx: CriticalContext,
    fileId: string,
    body: ShareMaterialDto,
  ): Promise<ShareMaterialResponseDto> {
    if (!UUID_RE.test(fileId)) return fail(domainError('INVALID_INPUT', 422));
    const teacher = await this.teacher(ctx);
    const now = await at(ctx.tx);
    const [mine] = await ctx.tx.$queryRaw<{ ok: boolean }[]>`
      SELECT true AS ok FROM teacher_material_uploads WHERE file_id=${fileId}::uuid AND teacher_id=${teacher}::uuid`;
    const file = mine ? await ctx.tx.s3Object.findUnique({ where: { id: fileId } }) : null;
    if (!file) return fail(domainError('NOT_FOUND', 404));
    if (file.status !== 'VERIFIED') return fail(domainError('MATERIAL_NOT_VERIFIED', 409));
    const enrollment = await this.ownedEnrollment(ctx.tx, teacher, body.enrollmentId, now);
    if (enrollment.status !== 'ACTIVE') return fail(domainError('ENROLLMENT_INACTIVE', 422));
    const account = await ctx.tx.studentAccount.findFirst({
      where: { student_id: enrollment.student_id, deactivated_at: null },
      select: { account_id: true },
    });
    if (!account) return fail(domainError('STUDENT_ACCOUNT_REQUIRED', 409));
    const expires = body.expiresAt ? new Date(body.expiresAt) : null;
    if (expires && +expires <= +now) return fail(domainError('MATERIAL_EXPIRY_IN_PAST', 422));
    if (body.lessonId) {
      const lesson = await ctx.tx.lessonOccurrence.findFirst({
        where: { id: body.lessonId, enrollment_id: enrollment.id },
        select: { id: true },
      });
      if (!lesson) return fail(domainError('MATERIAL_LESSON_NOT_APPLICABLE', 422));
    }
    if (
      await ctx.tx.filePermission.findFirst({
        where: {
          s3_object_id: fileId,
          subject_id: account.account_id,
          subject_type: 'STUDENT',
          revoked_at: null,
        },
      })
    )
      return fail(domainError('MATERIAL_ALREADY_SHARED', 409));
    const permission = await ctx.tx.filePermission.create({
      data: {
        s3_object_id: fileId,
        subject_id: account.account_id,
        subject_type: 'STUDENT',
        granted_by: ctx.actor.accountId,
        granted_at: now,
        can_download: body.canDownload,
        expires_at: expires,
        educational_subject_id: enrollment.subject_id,
        lesson_occurrence_id: body.lessonId ?? null,
        lesson_title: body.lessonId ? (body.lessonTitle?.trim() ?? null) : null,
        source_operation_id: ctx.operationId,
      },
    });
    return { id: permission.id, fileId };
  }

  async revoke(ctx: CriticalContext, permissionId: string): Promise<RevokeMaterialResponseDto> {
    if (!UUID_RE.test(permissionId)) return fail(domainError('INVALID_INPUT', 422));
    await this.teacher(ctx);
    await ctx.tx
      .$queryRaw`SELECT id FROM file_permissions WHERE id=${permissionId}::uuid FOR UPDATE`;
    const permission = await ctx.tx.filePermission.findFirst({
      where: { id: permissionId, granted_by: ctx.actor.accountId },
    });
    if (!permission) return fail(domainError('NOT_FOUND', 404));
    if (permission.revoked_at) return fail(domainError('MATERIAL_ALREADY_REVOKED', 409));
    const now = await at(ctx.tx);
    await ctx.tx.filePermission.update({
      where: { id: permission.id },
      data: { revoked_at: now, revoked_by: ctx.actor.accountId },
    });
    await ctx.tx.fileAuditLog.create({
      data: {
        s3_object_id: permission.s3_object_id,
        permission_id: permission.id,
        action: 'REVOKE',
        actor_id: ctx.actor.accountId,
        at: now,
        result: 'SUCCESS',
        request_id: ctx.requestId,
        event_key: `teacher:revoke:${permission.id}`,
      },
    });
    return { id: permission.id, revokedAt: now.toISOString() };
  }

  async shared(
    ctx: TeacherContext,
    enrollmentId: string,
  ): Promise<Result<TeacherSharedMaterialsDto, DomainError>> {
    if (!UUID_RE.test(enrollmentId)) return err(domainError('INVALID_INPUT', 422));
    try {
      const now = (
        await this.db.client.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`
      )[0]!.now;
      const enrollment = await this.ownedEnrollment(
        this.db.client,
        ctx.teacherId,
        enrollmentId,
        now,
      );
      const accounts = await this.db.client.studentAccount.findMany({
        where: { student_id: enrollment.student_id },
        select: { account_id: true },
      });
      const rows = await this.db.client.filePermission.findMany({
        where: {
          granted_by: ctx.accountId,
          subject_type: 'STUDENT',
          subject_id: { in: accounts.map((a) => a.account_id) },
          educational_subject_id: enrollment.subject_id,
        },
        orderBy: [{ granted_at: 'desc' }, { id: 'desc' }],
        take: 200,
        include: { s3_object_ref: { select: { file_name: true } } },
      });
      return ok({
        enrollmentId,
        items: rows.map((p) => ({
          permissionId: p.id,
          fileId: p.s3_object_id,
          fileName: p.s3_object_ref.file_name ?? 'Материал',
          canDownload: p.can_download,
          lessonId: p.lesson_occurrence_id,
          lessonTitle: p.lesson_title,
          sharedAt: p.granted_at.toISOString(),
          expiresAt: p.expires_at?.toISOString() ?? null,
          revokedAt: p.revoked_at?.toISOString() ?? null,
        })),
      });
    } catch (error: unknown) {
      return err(failure(error));
    }
  }
}
