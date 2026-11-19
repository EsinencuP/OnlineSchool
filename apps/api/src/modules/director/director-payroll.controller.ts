import { applyDecorators, Body, Controller, Get, Header, Param, Post, Query } from '@nestjs/common';
import {
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { CriticalContext } from '../../core/http.js';
import { CriticalCommand, CurrentTransaction } from '../../core/idempotency/idempotency.module.js';
import { unwrap } from '../../core/errors/domain-error.js';
import { ApiError, CloseFinancialPeriodRequest } from '../../openapi/dtos.js';
import { DirectorPayrollService } from './director-payroll.service.js';
import {
  CreatePeriodDto,
  PayrollQueryDto,
  PayrollSummaryDto,
  PayrollTeacherDto,
  PeriodDto,
  PeriodDisputesDto,
  PeriodDisputesQueryDto,
  PeriodListDto,
  UnresolvedDto,
} from './dto/director-payroll.dto.js';
import { DirectorRoute } from './guards/director-route.decorator.js';

const command = () =>
  applyDecorators(
    Header('Cache-Control', 'private, no-store'),
    ApiHeader({
      name: 'Idempotency-Key',
      required: true,
      schema: { type: 'string', format: 'uuid' },
    }),
    ApiHeader({ name: 'X-CSRF-Token', required: true, schema: { type: 'string' } }),
  );

@DirectorRoute()
@Controller('api/v1/director')
export class DirectorPayrollController {
  constructor(private readonly payroll: DirectorPayrollService) {}

  @Get('payroll/summary')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    operationId: 'getDirectorPayrollSummary',
    summary:
      'What teachers earned, what was actually paid and what is still owed, per currency and teacher',
  })
  @ApiOkResponse({ type: PayrollSummaryDto })
  @ApiNotFoundResponse({ type: ApiError, description: 'PERIOD_NOT_FOUND' })
  async summary(@Query() q: PayrollQueryDto) {
    return unwrap(await this.payroll.summary(q.periodId));
  }

  @Get('payroll/teachers/:teacherId')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    operationId: 'getDirectorPayrollTeacher',
    summary: 'Obligations of one teacher with paid and outstanding amounts',
  })
  @ApiParam({ name: 'teacherId', type: String, format: 'uuid' })
  @ApiOkResponse({ type: PayrollTeacherDto })
  @ApiNotFoundResponse({ type: ApiError, description: 'TEACHER_NOT_FOUND' })
  async teacher(@Param('teacherId') teacherId: string) {
    return unwrap(await this.payroll.teacher(teacherId));
  }

  @Get('finance/unresolved')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    operationId: 'getDirectorUnresolvedFinance',
    summary: 'Open financial items: unaccrued or disputed lessons, open payouts and draft entries',
  })
  @ApiOkResponse({ type: UnresolvedDto })
  @ApiNotFoundResponse({ type: ApiError, description: 'PERIOD_NOT_FOUND' })
  async unresolved(@Query() q: PayrollQueryDto) {
    return unwrap(await this.payroll.unresolved(q.periodId));
  }

  @Get('periods')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    operationId: 'listDirectorPeriods',
    summary: 'Financial periods with the number of blockers and readiness to close',
  })
  @ApiOkResponse({ type: PeriodListDto })
  async periods() {
    return unwrap(await this.payroll.list());
  }

  @Get('periods/:id/disputes')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    operationId: 'getDirectorPeriodDisputes',
    summary: 'Preview open disputes or read the register preserved at period closure',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ type: PeriodDisputesDto })
  @ApiNotFoundResponse({ type: ApiError, description: 'PERIOD_NOT_FOUND' })
  async disputes(@Param('id') id: string, @Query() q: PeriodDisputesQueryDto) {
    return unwrap(await this.payroll.disputes(id, Number(q.page ?? 1)));
  }

  @Post('periods')
  @command()
  @CriticalCommand({
    type: 'director.period.create',
    resourceType: 'FinancialPeriod',
    topic: 'director.period.create.v1',
    successStatus: 201,
    conflictOnPayloadMismatch: true,
  })
  @ApiOperation({
    operationId: 'createDirectorPeriod',
    summary:
      'Open a financial period (UTC bounds chosen by the director). Without one no accrual or posting is possible',
  })
  @ApiCreatedResponse({ type: PeriodDto })
  @ApiConflictResponse({ type: ApiError, description: 'PERIOD_OVERLAP' })
  @ApiUnprocessableEntityResponse({ type: ApiError, description: 'INVALID_PERIOD' })
  async create(@CurrentTransaction() ctx: CriticalContext, @Body() dto: CreatePeriodDto) {
    return unwrap(await this.payroll.create(ctx, dto));
  }

  @Post('periods/:id/close')
  @command()
  @CriticalCommand({
    type: 'period.close',
    resourceType: 'FinancialPeriod',
    topic: 'period.closed.v1',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiBody({ type: CloseFinancialPeriodRequest, required: false })
  @ApiOperation({
    operationId: 'closeDirectorPeriod',
    summary: 'Close a finished period with confirmation of any outstanding dispute register',
  })
  @ApiOkResponse({ type: PeriodDto })
  @ApiNotFoundResponse({ type: ApiError, description: 'NOT_FOUND' })
  @ApiConflictResponse({
    type: ApiError,
    description:
      'PERIOD_ALREADY_CLOSED, PERIOD_DISPUTES_CONFIRMATION_REQUIRED, PERIOD_DISPUTES_CHANGED',
  })
  @ApiUnprocessableEntityResponse({
    type: ApiError,
    description: 'PERIOD_NOT_FINISHED, PERIOD_HAS_DRAFT_ENTRIES, PERIOD_HAS_UNRESOLVED_FACTS',
  })
  async close(
    @CurrentTransaction() ctx: CriticalContext,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return unwrap(await this.payroll.close(ctx, id, body));
  }
}
