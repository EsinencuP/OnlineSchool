import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@online-school/db';
import { DatabaseService } from '../../core/database/database.module.js';
import { AuditService } from '../../core/audit/audit.service.js';
import { TransactionService } from '../../core/transaction/transaction.service.js';
import { SessionStore } from '../../core/session/session.store.js';
import { domainError, fail, unwrap } from '../../core/errors/domain-error.js';
import type { AccountContext } from '../../core/http.js';
import { at } from '../../modules/finance/finance-common.js';
import { PrivateUploads, READ_TTL_SECONDS } from '../../modules/storage/private-uploads.service.js';
import { MeService } from '../me/me.service.js';
import type { IStudentContext } from '../student-context.interface.js';
import type {
  FileSignedUrlResponseDto,
  MaterialsQuery,
  MaterialsResponseDto,
} from './materials.dto.js';

function materialFrom(): Prisma.Sql {
  return Prisma.sql`FROM file_permissions p JOIN s3_objects o ON o.id=p.s3_object_id
    JOIN teacher_accounts t ON t.account_id=p.granted_by
    LEFT JOIN subjects s ON s.id=p.educational_subject_id`;
}
function materialWhere(student: IStudentContext, now: Date): Prisma.Sql {
  return Prisma.sql`WHERE p.subject_id=${student.userId}::uuid AND p.subject_type='STUDENT'
    AND p.revoked_at IS NULL AND p.granted_at<=${now} AND (p.expires_at IS NULL OR p.expires_at>${now})
    AND o.status='VERIFIED' AND o.uploaded_at<=${now}
    AND EXISTS (SELECT 1 FROM student_accounts sa WHERE sa.account_id=p.subject_id AND sa.student_id=${student.studentProfileId}::uuid)
    AND (p.educational_subject_id IS NULL OR EXISTS (SELECT 1 FROM student_subject_enrollments e
      WHERE e.student_id=${student.studentProfileId}::uuid AND e.subject_id=p.educational_subject_id))
    AND (p.lesson_occurrence_id IS NULL OR EXISTS (SELECT 1 FROM lesson_occurrences l
      JOIN student_subject_enrollments e ON e.id=l.enrollment_id WHERE l.id=p.lesson_occurrence_id
        AND e.student_id=${student.studentProfileId}::uuid AND e.subject_id=p.educational_subject_id))`;
}
export function materialsProjectionSql(
  student: IStudentContext,
  query: MaterialsQuery,
  now: Date,
): Prisma.Sql {
  const filter = query.subjectId
    ? Prisma.sql`AND p.educational_subject_id=${query.subjectId}::uuid`
    : Prisma.empty;
  return Prisma.sql`WITH visible AS (
    SELECT o.id AS "fileId",COALESCE(o.file_name,'Материал') AS "fileName",o.size AS "fileSizeBytes",o.content_type AS "mimeType",
      COALESCE(s.name,'Без предмета') AS "subjectName",o.uploaded_at AS "uploadedAt",p.granted_at AS "sharedAt",
      t.full_name AS "sharedByTeacherName",CASE WHEN p.lesson_occurrence_id IS NOT NULL THEN p.lesson_title ELSE NULL END AS "lessonTitle"
    ${materialFrom()} ${materialWhere(student, now)} ${filter}
    ), paged AS (SELECT * FROM visible ORDER BY "sharedAt" DESC,"fileId" DESC
      LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize})
    SELECT COALESCE((SELECT jsonb_agg(to_jsonb(paged) ORDER BY "sharedAt" DESC,"fileId" DESC) FROM paged),'[]'::jsonb) AS items,
      (SELECT count(*)::int FROM visible) AS total`;
}
export function materialAccessSql(student: IStudentContext, id: string, now: Date): Prisma.Sql {
  return Prisma.sql`SELECT p.id AS permission_id,o.id AS file_id,o.bucket,o.key,COALESCE(o.file_name,'Материал') AS file_name,
    p.can_download,p.expires_at ${materialFrom()} ${materialWhere(student, now)} AND o.id=${id}::uuid FOR SHARE OF p,o`;
}
export interface MaterialAccessRow {
  permission_id: string;
  file_id: string;
  bucket: string;
  key: string;
  file_name: string;
  can_download: boolean;
  expires_at: Date | null;
}
@Injectable()
export class StudentMaterialsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly transactions: TransactionService,
    private readonly sessions: SessionStore,
    private readonly me: MeService,
    private readonly storage: PrivateUploads,
    private readonly audit: AuditService,
  ) {}
  async list(student: IStudentContext, query: MaterialsQuery): Promise<MaterialsResponseDto> {
    const [row] = await this.database.client.$queryRaw<
      Pick<MaterialsResponseDto, 'items' | 'total'>[]
    >(materialsProjectionSql(student, query, new Date()));
    if (!row) return fail(domainError('MATERIALS_UNAVAILABLE', 503));
    for (const item of row.items) {
      item.uploadedAt = new Date(item.uploadedAt).toISOString();
      item.sharedAt = new Date(item.sharedAt).toISOString();
    }
    return { ...row, page: query.page, pageSize: query.pageSize };
  }
  async signedUrl(
    student: IStudentContext,
    id: string,
    token: string | undefined,
    actor: AccountContext,
    requestId: string,
  ): Promise<FileSignedUrlResponseDto> {
    // X-Request-Id may be reused by a client; it is correlation, not an idempotency identity.
    const issuanceId = randomUUID();
    const result = await this.transactions.runCritical(async (tx) => {
      // A URL is an independent capability: revalidate the session and access immediately before issuing it.
      const current = unwrap(await this.sessions.resolve(token, tx));
      if (
        current.accountId !== student.userId ||
        current.kind !== 'STUDENT' ||
        !current.roles.includes('STUDENT')
      )
        return fail(domainError('FORBIDDEN', 403));
      const loaded = unwrap(await this.me.load(current.accountId, tx)).context;
      if (loaded.studentProfileId !== student.studentProfileId)
        return fail(domainError('FILE_ACCESS_DENIED', 403));
      if (loaded.mustChangePassword) return fail(domainError('MUST_CHANGE_PASSWORD', 403));
      if (!loaded.hasActiveAccess)
        return fail({
          ...domainError('ACCESS_SUSPENDED', 402),
          details: {
            managerContacts: {
              whatsapp: process.env.STUDENT_MANAGER_WHATSAPP ?? '',
              telegram: process.env.STUDENT_MANAGER_TELEGRAM ?? '',
            },
          },
        });
      const now = await at(tx);
      const [permission] = await tx.$queryRaw<MaterialAccessRow[]>(
        materialAccessSql(loaded, id, now),
      );
      if (!permission) return fail(domainError('FILE_ACCESS_DENIED', 403));
      // SigV4 uses whole seconds. Expiry never exceeds either 15 minutes or the explicit grant.
      const signingDate = new Date(Math.floor(+now / 1000) * 1000);
      const expiresIn = Math.min(
        READ_TTL_SECONDS,
        permission.expires_at
          ? Math.floor((+permission.expires_at - +signingDate) / 1000)
          : READ_TTL_SECONDS,
      );
      if (expiresIn < 1) return fail(domainError('FILE_ACCESS_DENIED', 403));
      const url = await this.storage.signRead({
        bucket: permission.bucket,
        key: permission.key,
        fileName: permission.file_name,
        canDownload: permission.can_download,
        signingDate,
        expiresIn,
      });
      await tx.fileAuditLog.create({
        data: {
          s3_object_id: permission.file_id,
          permission_id: permission.permission_id,
          action: permission.can_download ? 'DOWNLOAD' : 'VIEW',
          actor_id: current.accountId,
          at: now,
          result: 'SUCCESS',
          request_id: requestId,
          event_key: `student:material-url:${issuanceId}`,
        },
      });
      return {
        url,
        expiresAt: new Date(+signingDate + expiresIn * 1000).toISOString(),
        fileName: permission.file_name,
      };
    });
    if (!result.ok && [401, 403].includes(result.error.status)) {
      unwrap(
        await this.audit.denial({
          requestId,
          actor,
          resourceId: id,
          action: 'student.material.url.denied',
          code: result.error.code,
        }),
      );
    }
    return unwrap(result);
  }
}
