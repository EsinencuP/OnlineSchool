import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBody,
  ApiCookieAuth,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CriticalCommand, CurrentTransaction } from '../../core/idempotency/idempotency.module.js';
import type { CriticalContext } from '../../core/http.js';
import { RequireRole } from '../../core/rbac/decorators.js';
import { ProblemDetails } from '../../core/errors/error-mapper.js';
import { unwrap } from '../../core/errors/domain-error.js';
import { uuid } from '../../modules/identity/input.js';
import { StudentCtx } from '../student-context.decorator.js';
import type { IStudentContext } from '../student-context.interface.js';
import { StudentLessonScopeGuard } from '../lessons/student-lesson-scope.guard.js';
import { StudentHistoryService } from './history.service.js';
import { StudentDisputeService } from './dispute.service.js';
import {
  DisputeRequestDto,
  DisputeResponseDto,
  HistoryQueryDto,
  HistoryQueryPipe,
  LessonHistoryResponseDto,
} from './history.dto.js';
import type { HistoryPage } from './history.dto.js';

@ApiTags('Student')
@ApiCookieAuth('sessionCookie')
@RequireRole('STUDENT')
@ApiResponse({ status: 400, type: ProblemDetails })
@ApiResponse({ status: 401, type: ProblemDetails })
@ApiResponse({ status: 402, type: ProblemDetails })
@ApiResponse({ status: 403, type: ProblemDetails })
@ApiResponse({ status: 409, type: ProblemDetails })
@ApiResponse({ status: 422, type: ProblemDetails })
@ApiResponse({ status: 503, type: ProblemDetails })
@Controller('api/v1/student/lessons')
export class StudentHistoryController {
  constructor(
    private readonly history: StudentHistoryService,
    private readonly disputes: StudentDisputeService,
  ) {}
  @Get('history')
  @ApiOperation({
    operationId: 'getStudentLessonHistory',
    summary: 'Confirmed student attendance and quantitative deduction history',
    description:
      'Only COMPLETED/confirmed NO_SHOW. Balances are immutable subscription lesson quantities from the published LedgerEntry, Decimal strings, never monetary account totals. Legacy unknown snapshots remain null.',
  })
  @ApiResponse({ status: 200, type: LessonHistoryResponseDto })
  async list(
    @StudentCtx() student: IStudentContext,
    @Query(HistoryQueryPipe) page: HistoryQueryDto,
  ): Promise<LessonHistoryResponseDto> {
    return unwrap(await this.history.list(student, page as HistoryPage));
  }
  @Post(':lessonId/dispute')
  @HttpCode(201)
  @UseGuards(StudentLessonScopeGuard)
  @ApiOperation({
    operationId: 'disputeStudentLessonDeduction',
    summary: 'Dispute one published lesson deduction',
    description:
      'Addressed CRM task only. Requires current deduction, no OPEN/IN_PROGRESS case and <=30 elapsed days. A new command with an open case is 409; same Idempotency-Key replays the original 201 without writing again. Does not change attendance, ledger or rights.',
  })
  @ApiParam({ name: 'lessonId', type: String, format: 'uuid' })
  @ApiBody({ type: DisputeRequestDto })
  @ApiHeader({ name: 'X-CSRF-Token', required: true })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiResponse({ status: 201, type: DisputeResponseDto })
  @CriticalCommand({
    type: 'student.lesson.dispute',
    topic: 'student.lesson.dispute-requested.v1',
    resourceType: 'CrmTask',
    successStatus: 201,
    resultIdField: 'crmTaskId',
  })
  async dispute(
    @CurrentTransaction() ctx: CriticalContext,
    @StudentCtx() student: IStudentContext,
    @Param('lessonId') id: string,
    @Body() body: DisputeRequestDto,
  ): Promise<DisputeResponseDto> {
    return this.disputes.create(ctx, student, uuid(id), body);
  }
}
