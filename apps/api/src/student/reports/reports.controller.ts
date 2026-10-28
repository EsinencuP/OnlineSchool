import {
  applyDecorators,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Injectable,
  HttpCode,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import {
  ApiBody,
  ApiCookieAuth,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RequireRole } from '../../core/rbac/decorators.js';
import { ProblemDetails } from '../../core/errors/error-mapper.js';
import { CriticalCommand, CurrentTransaction } from '../../core/idempotency/idempotency.module.js';
import type { CriticalContext, HttpResponse } from '../../core/http.js';
import { uuid } from '../../modules/identity/input.js';
import { StudentCtx } from '../student-context.decorator.js';
import type { IStudentContext, StudentRequest } from '../student-context.interface.js';
import type { HistoryPage } from '../history/history.dto.js';
import {
  ExportPdfRequestDto,
  ExportPdfResponseDto,
  PdfJobStatusDto,
  ReportsQueryDto,
  ReportsQueryPipe,
  ReportsResponseDto,
} from './reports.dto.js';
import { StudentReportsService } from './reports.service.js';

const Mutation = (
  type: string,
  topic: string,
  resourceType: string,
  resultIdField: string,
  successStatus: 200 | 201 | 202,
) =>
  applyDecorators(
    HttpCode(successStatus),
    ApiHeader({ name: 'X-CSRF-Token', required: true }),
    ApiHeader({
      name: 'Idempotency-Key',
      required: true,
      schema: { type: 'string', format: 'uuid' },
    }),
    CriticalCommand({ type, topic, resourceType, resultIdField, successStatus }),
  );

type ReadRequest = StudentRequest & { firstReportRead?: boolean };
// Guards execute before the global critical-command interceptor, including its
// cached replay path. This only installs presentation; core guards authorize.
@Injectable()
export class ReportReadResponseGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<ReadRequest>();
    const res = context.switchToHttp().getResponse<HttpResponse>();
    req.afterCriticalCommit = async () => {
      res.status(req.firstReportRead ? 204 : 200);
      res.end();
      return undefined;
    };
    return true;
  }
}

@ApiTags('Student')
@ApiCookieAuth('sessionCookie')
@RequireRole('STUDENT')
@ApiResponse({ status: 400, type: ProblemDetails })
@ApiResponse({ status: 401, type: ProblemDetails })
@ApiResponse({ status: 402, type: ProblemDetails })
@ApiResponse({ status: 403, type: ProblemDetails })
@ApiResponse({ status: 503, type: ProblemDetails })
@Controller('api/v1/student/reports')
export class StudentReportsController {
  constructor(private readonly reports: StudentReportsService) {}
  @Get()
  @ApiOperation({
    operationId: 'getStudentReports',
    summary: 'Read latest published teacher educational reports',
    description:
      'Newest creation date first; latest published version per checkpoint, only confirmed eight-lesson reports. Draft corrections never suppress a published version. Public content only.',
  })
  @ApiResponse({ status: 200, type: ReportsResponseDto })
  list(@StudentCtx() student: IStudentContext, @Query(ReportsQueryPipe) query: ReportsQueryDto) {
    return this.reports.list(student, query as HistoryPage);
  }
  @Post('export-pdf')
  @ApiBody({ type: ExportPdfRequestDto, required: false })
  @ApiOperation({
    operationId: 'requestStudentEducationPdf',
    summary: 'Queue a private educational history PDF',
    description:
      'CSRF and UUID Idempotency-Key required. Optional subject and inclusive date selection; omitted body exports all history. Estimated 30s is not a completion guarantee. Poll every 2s for at most 60s, then retry later. No report creation or external family message.',
  })
  @ApiResponse({ status: 202, type: ExportPdfResponseDto })
  @ApiResponse({ status: 429, type: ProblemDetails })
  @Mutation(
    'student.reports.export',
    'student.reports.export-requested.v1',
    'PdfExportJob',
    'jobId',
    202,
  )
  enqueue(
    @CurrentTransaction() ctx: CriticalContext,
    @StudentCtx() student: IStudentContext,
    @Body() body: ExportPdfRequestDto,
  ) {
    return this.reports.enqueue(ctx, student, body);
  }
  @Get('export-pdf/:jobId')
  @ApiOperation({
    operationId: 'getStudentEducationPdfStatus',
    summary: 'Read own PDF job state and a fixed-expiry signed download',
    description:
      'Every poll rechecks student access. READY signatures expire exactly one hour after ready_at; polling never extends the expiry. After expiry returns FAILED/PDF_EXPORT_EXPIRED without a URL. Foreign/nonexistent jobs return the same 403.',
  })
  @ApiResponse({ status: 200, type: PdfJobStatusDto })
  status(@StudentCtx() student: IStudentContext, @Param('jobId') id: string) {
    return this.reports.status(student, uuid(id));
  }
  @Post(':reportId/read')
  @UseGuards(ReportReadResponseGuard)
  @ApiOperation({
    operationId: 'markStudentReportRead',
    summary: 'Mark one published report version read',
    description:
      'CSRF and UUID Idempotency-Key required. First successful mark is 204; every repeat (including cached command replay) is 200. No response body and no teacher report mutation.',
  })
  @ApiResponse({ status: 204, description: 'First read recorded' })
  @ApiResponse({ status: 200, description: 'Already read; no response body' })
  @Mutation('student.reports.read', 'student.reports.read.v1', 'EducationReport', 'reportId', 200)
  async read(
    @CurrentTransaction() ctx: CriticalContext,
    @StudentCtx() student: IStudentContext,
    @Param('reportId') rawId: string,
    @Body() body: unknown,
    @Req() req: ReadRequest,
    @Res() response: HttpResponse,
  ) {
    const id = uuid(rawId);
    response.setHeader('Cache-Control', 'no-store');
    req.firstReportRead = await this.reports.markRead(ctx, student, id, body);
    return { reportId: id };
  }
}
