import { randomUUID } from 'node:crypto';
import { Prisma } from '@online-school/db';
import type { PrismaClient } from '@online-school/db';
import type { PrivateUploads } from '@online-school/api/education-export';
import { err, ok } from '@online-school/shared';
import { systemAudit } from './contracts.js';
import type { Handler } from './contracts.js';

export const UPLOAD_CLEANUP_TOPIC = 'storage.upload-cleanup.v1';
const POLL_INTERVAL_MS = 60_000;
const BATCH_SIZE = 10;
type Storage = Pick<PrivateUploads, 'bucket' | 'deleteExpiredUpload'>;
type Target = Parameters<Storage['deleteExpiredUpload']>[0];
type Row = Target & { operationId: string; status: 'PENDING' | 'VERIFIED' | 'QUARANTINED' };

function expiredTargets(bucket: string) {
  return Prisma.sql`
    SELECT o.id AS "fileId", o.source_operation_id AS "operationId", o.bucket, o.status, u.scope,
      CASE WHEN u.confirmed_at IS NULL THEN 'ABANDONED' ELSE 'STAGING_ONLY' END AS mode
    FROM public.s3_objects o
    JOIN (
      SELECT file_id, staging_key, expires_at, confirmed_at, 'homework'::text AS scope FROM public.homework_uploads
      UNION ALL
      SELECT file_id, staging_key, expires_at, confirmed_at, 'materials'::text AS scope FROM public.teacher_material_uploads
    ) u ON u.file_id=o.id
    WHERE o.bucket=${bucket}
      AND u.expires_at<=statement_timestamp()-interval '1 day'
      AND u.staging_key=u.scope || '/incoming/' || o.id::text
      AND o.key=u.scope || '/final/' || o.id::text
      AND (
        (u.confirmed_at IS NOT NULL AND o.status='VERIFIED' AND o.verified_at IS NOT NULL)
        OR (u.confirmed_at IS NULL AND o.status IN ('PENDING','QUARANTINED')
          AND o.uploaded_at IS NULL AND o.verified_at IS NULL
          AND NOT EXISTS (SELECT FROM public.file_permissions p WHERE p.s3_object_id=o.id)
          AND NOT EXISTS (SELECT FROM public.file_audit_logs a WHERE a.s3_object_id=o.id)
          AND NOT EXISTS (SELECT FROM public.homework_submission_attachments a WHERE a.file_id=o.id)
          AND NOT EXISTS (SELECT FROM public.homework_assignment_attachments a WHERE a.file_id=o.id)
          AND NOT EXISTS (SELECT FROM public.students s WHERE s.avatar_file_id=o.id))
      )`;
}

function cleanupKey(fileId: string) {
  return `storage:upload-cleanup:${fileId}`;
}

export class ExpiredUploadCleanup {
  private nextPoll = 0;

  constructor(
    private readonly db: PrismaClient,
    private readonly storage: Storage,
  ) {}

  async enqueueDue(): Promise<void> {
    const now = Date.now();
    if (now < this.nextPoll) return;
    this.nextPoll = now + POLL_INTERVAL_MS;
    const bucket = this.storage.bucket();
    await this.db.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Row[]>(Prisma.sql`
        ${expiredTargets(bucket)}
        AND o.status IN ('PENDING','VERIFIED')
        AND NOT EXISTS (SELECT FROM public.outbox_events e WHERE e.event_key='storage:upload-cleanup:' || o.id::text)
        ORDER BY u.expires_at, o.id LIMIT ${BATCH_SIZE} FOR UPDATE OF o SKIP LOCKED`);
      for (const row of rows) {
        const key = cleanupKey(row.fileId);
        const audit = await tx.auditEvent.create({
          data: {
            actor_kind: 'SYSTEM',
            system_actor_ref: 'upload-cleanup-worker',
            action: 'storage.upload-cleanup-queued',
            resource_type: 'S3Object',
            resource_id: row.fileId,
            request_id: randomUUID(),
            source_operation_id: row.operationId,
            result: 'SUCCESS',
            event_key: key,
          },
        });
        await tx.outboxEvent.create({
          data: {
            topic: UPLOAD_CLEANUP_TOPIC,
            event_key: key,
            aggregate_type: 'S3Object',
            aggregate_id: row.fileId,
            source_operation_id: row.operationId,
            audit_event_id: audit.id,
            payload: { schemaVersion: 1, mode: row.mode },
          },
        });
        if (row.mode === 'ABANDONED') {
          await tx.s3Object.update({ where: { id: row.fileId }, data: { status: 'QUARANTINED' } });
        }
      }
    });
  }
}

export function expiredUploadHandler(storage: Storage): Handler {
  return async (tx, event) => {
    const payload = event.payload;
    if (
      event.aggregate_type !== 'S3Object' ||
      event.event_key !== cleanupKey(event.aggregate_id) ||
      payload === null ||
      typeof payload !== 'object' ||
      Array.isArray(payload)
    ) {
      return err({ code: 'UPLOAD_CLEANUP_INVALID_EVENT' });
    }
    const [target] = await tx.$queryRaw<Row[]>(Prisma.sql`
      ${expiredTargets(storage.bucket())} AND o.id=${event.aggregate_id}::uuid
      AND o.status IN ('VERIFIED','QUARANTINED')
      AND EXISTS (SELECT FROM public.audit_events a WHERE a.id=${event.audit_event_id}::uuid
        AND a.actor_kind='SYSTEM' AND a.system_actor_ref='upload-cleanup-worker'
        AND a.action='storage.upload-cleanup-queued' AND a.result='SUCCESS'
        AND a.resource_type='S3Object' AND a.resource_id=o.id::text
        AND a.source_operation_id=o.source_operation_id AND a.event_key=${event.event_key})
      FOR UPDATE OF o`);
    if (
      !target ||
      target.mode !== payload.mode ||
      target.operationId !== event.source_operation_id ||
      target.status !== (target.mode === 'ABANDONED' ? 'QUARANTINED' : 'VERIFIED')
    ) {
      return err({ code: 'UPLOAD_CLEANUP_INELIGIBLE' });
    }
    try {
      await storage.deleteExpiredUpload(target);
    } catch {
      return err({ code: 'UPLOAD_CLEANUP_STORAGE_UNAVAILABLE' });
    }
    if (target.mode === 'ABANDONED') {
      await tx.s3Object.update({ where: { id: target.fileId }, data: { status: 'DELETED' } });
    }
    await systemAudit(tx, {
      key: `worker:upload-cleaned:${target.fileId}`,
      action: 'worker.upload-cleaned',
      resourceType: 'S3Object',
      resourceId: target.fileId,
      operationId: target.operationId,
    });
    return ok(undefined);
  };
}
