import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@online-school/db';
import { DatabaseService } from '../../core/database/database.module.js';
import { AppException, domainError, fail, unwrap } from '../../core/errors/domain-error.js';
import type { CriticalContext } from '../../core/http.js';
import { at } from '../../modules/finance/finance-common.js';
import { object } from '../../modules/identity/input.js';
import {
  PrivateUploads,
  PDF_READ_TTL_SECONDS,
} from '../../modules/storage/private-uploads.service.js';
import type { IStudentContext } from '../student-context.interface.js';
import type { HistoryPage } from '../history/history.dto.js';
import { MeService } from '../me/me.service.js';
import { normalizeReport, PDF_EXPORT_JOB_TYPE } from './export-data.js';
import { exportSelection } from './reports.dto.js';
import type { ExportPdfResponseDto, PdfJobStatusDto, ReportsResponseDto } from './reports.dto.js';
import { publishedReportsCte, studentReportsSql } from './reports.sql.js';

@Injectable()
export class StudentReportsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly me: MeService,
    private readonly storage: PrivateUploads,
  ) {}
  async current(tx: Prisma.TransactionClient, student: IStudentContext) {
    const loaded = unwrap(await this.me.load(student.userId, tx));
    if (loaded.context.studentProfileId !== student.studentProfileId)
      return fail(domainError('REPORT_FORBIDDEN', 403));
    if (loaded.context.mustChangePassword) return fail(domainError('MUST_CHANGE_PASSWORD', 403));
    if (!loaded.context.hasActiveAccess) return fail(domainError('ACCESS_SUSPENDED', 402));
    return loaded;
  }
  async list(student: IStudentContext, query: HistoryPage): Promise<ReportsResponseDto> {
    const [row] = await this.database.client.$queryRaw<
      Pick<ReportsResponseDto, 'items' | 'total'>[]
    >(studentReportsSql(student.studentProfileId, query, new Date()));
    if (!row) return fail(domainError('REPORTS_UNAVAILABLE', 503));
    return {
      ...row,
      items: row.items.map((r) => normalizeReport(r, student.timeZone)),
      page: query.page,
      pageSize: query.pageSize,
    };
  }
  async markRead(
    ctx: CriticalContext,
    student: IStudentContext,
    id: string,
    body: unknown,
  ): Promise<boolean> {
    object(body ?? {}, []);
    await this.current(ctx.tx, student);
    const now = await at(ctx.tx);
    const [report] = await ctx.tx.$queryRaw<{ id: string }[]>(
      Prisma.sql`${publishedReportsCte(student.studentProfileId, now)} SELECT id FROM published_reports WHERE id=${id}::uuid`,
    );
    if (!report) return fail(domainError('REPORT_FORBIDDEN', 403));
    const result = await ctx.tx.educationReportRead.createMany({
      skipDuplicates: true,
      data: [
        {
          report_id: id,
          student_id: student.studentProfileId,
          read_by: student.userId,
          read_at: now,
        },
      ],
    });
    return result.count === 1;
  }
  async enqueue(
    ctx: CriticalContext,
    student: IStudentContext,
    body: unknown,
  ): Promise<ExportPdfResponseDto> {
    const selection = exportSelection(body),
      loaded = await this.current(ctx.tx, student),
      now = await at(ctx.tx);
    if (
      selection.subjectId &&
      !(await ctx.tx.studentSubjectEnrollment.findFirst({
        where: {
          student_id: student.studentProfileId,
          subject_id: selection.subjectId,
          valid_from: { lte: now },
        },
        select: { id: true },
      }))
    )
      return fail(domainError('REPORT_FORBIDDEN', 403));
    await ctx.tx
      .$queryRaw`SELECT true AS locked FROM pg_advisory_xact_lock(hashtextextended(${`student-pdf:${student.studentProfileId}`},0))`;
    const active = await ctx.tx.pdfExportJob.count({
      where: {
        student_id: student.studentProfileId,
        job_ref: { status: { in: ['PENDING', 'RUNNING', 'RETRY_WAIT'] } },
      },
    });
    if (active >= 2) return fail(domainError('PDF_EXPORT_LIMIT_REACHED', 429));
    const jobId = randomUUID();
    await ctx.tx.jobRecord.create({
      data: {
        id: jobId,
        type: PDF_EXPORT_JOB_TYPE,
        payload: { schemaVersion: 1, exportJobId: jobId },
        source_operation_id: ctx.operationId,
        deduplication_key: `education-pdf:${student.userId}:${ctx.operationId}`,
        retry_policy: 'SAFE_RETRY',
        max_attempts: 3,
        next_run_at: now,
      },
    });
    await ctx.tx.pdfExportJob.create({
      data: {
        id: jobId,
        student_id: student.studentProfileId,
        requested_by: student.userId,
        requested_at: now,
        time_zone: loaded.context.timeZone ?? 'Europe/Chisinau',
        selection: selection as Prisma.InputJsonObject,
      },
    });
    return { jobId, status: 'QUEUED', estimatedReadyAt: new Date(+now + 30000).toISOString() };
  }
  async status(student: IStudentContext, id: string): Promise<PdfJobStatusDto> {
    const job = await this.database.client.pdfExportJob.findFirst({
      where: { id, student_id: student.studentProfileId, requested_by: student.userId },
      include: { job_ref: true },
    });
    if (!job) return fail(domainError('PDF_JOB_FORBIDDEN', 403));
    const now = await at(this.database.client);
    const result: PdfJobStatusDto = {
      jobId: id,
      status: 'QUEUED',
      downloadUrl: null,
      expiresAt: job.expires_at?.toISOString() ?? null,
      failureReason: null,
    };
    if (job.job_ref.status === 'SUCCEEDED') {
      if (!job.ready_at || !job.expires_at || !job.bucket || !job.object_key)
        return fail(domainError('PDF_JOB_UNAVAILABLE', 503));
      if (now >= job.expires_at)
        return { ...result, status: 'FAILED', failureReason: 'PDF_EXPORT_EXPIRED' };
      result.status = 'READY';
      try {
        result.downloadUrl = await this.storage.signPdf({
          bucket: job.bucket,
          key: job.object_key,
          fileName: 'online-academy-history.pdf',
          signingDate: job.ready_at,
          expiresIn: PDF_READ_TTL_SECONDS,
        });
      } catch (error) {
        if (error instanceof AppException && error.domain.code === 'PDF_EXPORT_EXPIRED')
          return {
            ...result,
            status: 'FAILED',
            downloadUrl: null,
            failureReason: 'PDF_EXPORT_EXPIRED',
          };
        return fail(domainError('PDF_JOB_UNAVAILABLE', 503));
      }
    } else if (job.job_ref.status === 'RUNNING') result.status = 'PROCESSING';
    else if (['FAILED', 'CANCELLED'].includes(job.job_ref.status)) {
      result.status = 'FAILED';
      result.failureReason = 'PDF_EXPORT_FAILED';
    }
    return result;
  }
}
