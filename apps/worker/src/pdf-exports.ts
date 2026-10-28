import { createHash, randomUUID } from 'node:crypto';
import type { JobRecord, PdfExportJob, Prisma, PrismaClient } from '@online-school/db';
import {
  EducationExportSupportModule,
  MeService,
  PrivateUploads,
  PDF_EXPORT_JOB_TYPE,
  PDF_READ_TTL_SECONDS,
  calendarDate,
  educationPdfDataSql,
  exportSelection,
  normalizeReport,
} from '@online-school/api/education-export';
import type { EducationPdfData } from '@online-school/api/education-export';
import { dbNow, retryDelay, rollback, systemAudit, WorkerFailure } from './contracts.js';
import type { Tx } from './contracts.js';
import { renderEducationPdf } from './education-pdf.js';
export { EducationExportSupportModule, MeService, PrivateUploads };
export const PDF_LEASE_MS = 120000;
export type PdfClaim = { job: JobRecord; export: PdfExportJob; token: string; attemptKey: string };
type PdfProjection = Pick<EducationPdfData, 'skills' | 'reports' | 'lessons'> & {
  forbidden: boolean;
};
const txOptions = { isolationLevel: 'ReadCommitted', timeout: 15000, maxWait: 5000 } as const;
const terminalCodes = new Set([
  'PDF_EXPORT_ACCESS_REVOKED',
  'PDF_SOURCE_INVALID',
  'PDF_EXPORT_SIZE_LIMIT',
]);

export class PdfExportWorker {
  private stopped = false;
  private active: AbortController | undefined;
  constructor(
    private readonly db: PrismaClient,
    private readonly me: MeService,
    private readonly storage: PrivateUploads,
    private readonly render: (
      data: EducationPdfData,
      signal?: AbortSignal,
    ) => Promise<Buffer> = renderEducationPdf,
  ) {}
  stop(): void {
    this.stopped = true;
    this.active?.abort();
  }
  async processDue(): Promise<number> {
    if (this.stopped) return 0;
    const claim = await this.claim();
    if (!claim) return 0;
    await this.deliver(claim);
    return 1;
  }
  async claim(): Promise<PdfClaim | null> {
    return this.db.$transaction(async (tx) => {
      const [row] = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM job_records WHERE type=${PDF_EXPORT_JOB_TYPE}
          AND next_run_at<=clock_timestamp() AND (status IN ('PENDING','RETRY_WAIT') OR (status='RUNNING' AND locked_until<=clock_timestamp()))
        ORDER BY next_run_at,id FOR UPDATE SKIP LOCKED LIMIT 1`;
      if (!row) return null;
      const job = await tx.jobRecord.findUniqueOrThrow({ where: { id: row.id } }),
        now = await dbNow(tx);
      if (job.status === 'RUNNING')
        await tx.jobAttempt.updateMany({
          where: { job_id: job.id, finished_at: null },
          data: { finished_at: now, result: 'FAILED', error: 'LEASE_EXPIRED' },
        });
      const exp = await tx.pdfExportJob.findUnique({ where: { id: job.id } });
      const payload = job.payload as { schemaVersion?: unknown; exportJobId?: unknown };
      if (
        !exp ||
        payload?.schemaVersion !== 1 ||
        payload.exportJobId !== job.id ||
        job.attempts >= job.max_attempts
      ) {
        await tx.jobRecord.update({
          where: { id: job.id },
          data: {
            status: 'FAILED',
            finished_at: now,
            locked_by: null,
            locked_until: null,
            last_error_code:
              !exp || payload?.schemaVersion !== 1 || payload.exportJobId !== job.id
                ? 'PDF_SOURCE_INVALID'
                : 'PDF_ATTEMPTS_EXHAUSTED',
          },
        });
        await systemAudit(tx, {
          key: `pdf:dead:${job.id}`,
          action: 'student.pdf.failed',
          resourceType: 'PdfExportJob',
          resourceId: job.id,
          operationId: job.source_operation_id,
          error: true,
        });
        return null;
      }
      const token = randomUUID();
      const reserved = await tx.jobRecord.update({
        where: { id: job.id },
        data: {
          status: 'RUNNING',
          attempts: { increment: 1 },
          started_at: now,
          locked_by: token,
          locked_until: new Date(+now + PDF_LEASE_MS),
        },
      });
      await tx.jobAttempt.create({
        data: { job_id: job.id, attempt_no: reserved.attempts, started_at: now },
      });
      return {
        job: reserved,
        export: exp,
        token,
        attemptKey: `student-exports/${job.id}/${token}.pdf`,
      };
    }, txOptions);
  }
  private async owned(tx: Tx, claim: PdfClaim): Promise<Date | null> {
    await tx.$queryRaw`SELECT id FROM job_records WHERE id=${claim.job.id}::uuid FOR UPDATE`;
    const job = await tx.jobRecord.findUniqueOrThrow({ where: { id: claim.job.id } });
    const now = await dbNow(tx);
    return job.status === 'RUNNING' &&
      job.locked_by === claim.token &&
      job.attempts === claim.job.attempts &&
      !!job.locked_until &&
      job.locked_until > now
      ? now
      : null;
  }
  private async access(tx: Tx, exp: PdfExportJob) {
    const loaded = await this.me.load(exp.requested_by, tx);
    if (!loaded.ok)
      return rollback(
        loaded.error.status === 503 ? 'PDF_SOURCE_UNAVAILABLE' : 'PDF_EXPORT_ACCESS_REVOKED',
      );
    if (
      loaded.value.context.studentProfileId !== exp.student_id ||
      loaded.value.context.mustChangePassword ||
      !loaded.value.context.hasActiveAccess
    )
      return rollback('PDF_EXPORT_ACCESS_REVOKED');
    return loaded.value;
  }
  async freeze(claim: PdfClaim): Promise<EducationPdfData> {
    return this.db.$transaction(async (tx) => {
      const now = await this.owned(tx, claim);
      if (!now) return rollback('PDF_LEASE_LOST');
      const exp = await tx.pdfExportJob.findUniqueOrThrow({ where: { id: claim.job.id } }),
        loaded = await this.access(tx, exp);
      if (exp.source_data) {
        const data = exp.source_data as unknown as EducationPdfData;
        if (
          data.schemaVersion !== 1 ||
          !Array.isArray(data.skills) ||
          !Array.isArray(data.reports) ||
          !Array.isArray(data.lessons)
        )
          return rollback('PDF_SOURCE_INVALID');
        return data;
      }
      const selection = exportSelection(exp.selection);
      const [row] = await tx.$queryRaw<PdfProjection[]>(
        educationPdfDataSql(exp.student_id, selection, now, exp.time_zone),
      );
      if (!row || row.forbidden) return rollback('PDF_SOURCE_INVALID');
      const reports = row.reports.map((r) => normalizeReport(r, exp.time_zone));
      const days = [
        ...row.lessons.map((l) => calendarDate(l.date, exp.time_zone)),
        ...reports.map((r) => r.periodFrom),
      ].sort();
      const data: EducationPdfData = {
        schemaVersion: 1,
        studentName: loaded.me.displayName,
        asOf: now.toISOString(),
        timeZone: exp.time_zone,
        periodFrom:
          selection.periodFrom ?? days[0] ?? calendarDate(now.toISOString(), exp.time_zone),
        periodTo: selection.periodTo ?? calendarDate(now.toISOString(), exp.time_zone),
        skills: row.skills,
        reports,
        lessons: row.lessons,
      };
      await tx.pdfExportJob.update({
        where: { id: exp.id },
        data: { source_data: data as unknown as Prisma.InputJsonObject, source_as_of: now },
      });
      return data;
    }, txOptions);
  }
  async finish(claim: PdfClaim, bucket: string, size: number, sha256: string): Promise<boolean> {
    return this.db.$transaction(async (tx) => {
      const now = await this.owned(tx, claim);
      if (!now) return false;
      const exp = await tx.pdfExportJob.findUniqueOrThrow({ where: { id: claim.job.id } });
      await this.access(tx, exp);
      await tx.pdfExportJob.update({
        where: { id: claim.job.id },
        data: {
          bucket,
          object_key: claim.attemptKey,
          size_bytes: BigInt(size),
          sha256,
          ready_at: now,
          expires_at: new Date(+now + PDF_READ_TTL_SECONDS * 1000),
        },
      });
      await tx.jobAttempt.updateMany({
        where: { job_id: claim.job.id, attempt_no: claim.job.attempts, finished_at: null },
        data: { finished_at: now, result: 'SUCCEEDED' },
      });
      await tx.jobRecord.update({
        where: { id: claim.job.id },
        data: {
          status: 'SUCCEEDED',
          finished_at: now,
          locked_by: null,
          locked_until: null,
          last_error_code: null,
        },
      });
      await systemAudit(tx, {
        key: `pdf:ready:${claim.job.id}`,
        action: 'student.pdf.ready',
        resourceType: 'PdfExportJob',
        resourceId: claim.job.id,
        operationId: claim.job.source_operation_id,
      });
      return true;
    }, txOptions);
  }
  async fail(claim: PdfClaim, code: string): Promise<void> {
    await this.db.$transaction(async (tx) => {
      const now = await this.owned(tx, claim);
      if (!now) return;
      const failed = claim.job.attempts >= claim.job.max_attempts || terminalCodes.has(code);
      await tx.jobAttempt.updateMany({
        where: { job_id: claim.job.id, attempt_no: claim.job.attempts, finished_at: null },
        data: { finished_at: now, result: 'FAILED', error: code },
      });
      await tx.jobRecord.update({
        where: { id: claim.job.id },
        data: {
          status: failed ? 'FAILED' : 'RETRY_WAIT',
          finished_at: failed ? now : null,
          next_run_at: new Date(+now + retryDelay(claim.job.attempts)),
          locked_by: null,
          locked_until: null,
          last_error_code: code,
        },
      });
      await systemAudit(tx, {
        key: `pdf:failure:${claim.job.id}:${claim.job.attempts}`,
        action: failed ? 'student.pdf.failed' : 'student.pdf.retry-scheduled',
        resourceType: 'PdfExportJob',
        resourceId: claim.job.id,
        operationId: claim.job.source_operation_id,
        error: true,
      });
    }, txOptions);
  }
  private async cleanupAttempt(claim: PdfClaim, bucket: string): Promise<void> {
    try {
      // A lost commit response may mean READY was committed. Never delete an
      // advertised object unless PostgreSQL proves this attempt is unpublished.
      const current = await this.db.pdfExportJob.findUnique({
        where: { id: claim.job.id },
        select: { object_key: true },
      });
      if (current && current.object_key !== claim.attemptKey)
        await this.storage.deletePdf(bucket, claim.attemptKey);
    } catch {
      /* Retain ambiguous objects for the storage retention process; no unsafe deletion. */
    }
  }
  async deliver(claim: PdfClaim): Promise<void> {
    this.active = new AbortController();
    const signal = AbortSignal.any([this.active.signal, AbortSignal.timeout(60000)]);
    let bucket: string | undefined;
    try {
      if (this.stopped) return await this.fail(claim, 'WORKER_STOPPED');
      const data = await this.freeze(claim);
      const bytes = await this.render(data, signal);
      if (signal.aborted) await rollback('PDF_GENERATION_TIMEOUT');
      bucket = this.storage.bucket();
      const sha256 = createHash('sha256').update(bytes).digest('hex');
      try {
        await this.storage.putPdf(bucket, claim.attemptKey, bytes, sha256, signal);
      } catch {
        await rollback('PDF_STORAGE_UNAVAILABLE');
      }
      if (!(await this.finish(claim, bucket, bytes.length, sha256)))
        await this.cleanupAttempt(claim, bucket);
    } catch (error) {
      const code = this.stopped
        ? 'WORKER_STOPPED'
        : signal.aborted
          ? 'PDF_GENERATION_TIMEOUT'
          : error instanceof WorkerFailure
            ? error.code
            : error instanceof Error && error.message === 'PDF_EXPORT_SIZE_LIMIT'
              ? 'PDF_EXPORT_SIZE_LIMIT'
              : 'PDF_GENERATION_FAILED';
      await this.fail(claim, code);
      if (bucket) await this.cleanupAttempt(claim, bucket);
    } finally {
      this.active = undefined;
    }
  }
}
