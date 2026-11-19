import { applyDecorators, Body, Controller, Get, Header, Param, Post, Query } from '@nestjs/common';
import { ApiHeader, ApiOkResponse, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import type { AccountContext, CriticalContext } from '../../../core/http.js';
import {
  CriticalCommand,
  CurrentTransaction,
} from '../../../core/idempotency/idempotency.module.js';
import {
  CurrentAccount,
  RequireStudentAccess,
  RequireVerifiedMfa,
} from '../../../core/rbac/decorators.js';
import { ApiError } from '../../../openapi/dtos.js';
import { DirectorRoute } from '../../director/guards/director-route.decorator.js';
import { ManagerRoute } from '../../manager/guards/manager-route.decorator.js';
import {
  DecideRefundDto,
  PrepareRefundDto,
  RefundCasesDto,
  RefundDecisionDto,
  RefundTransferDto,
  RefundViewDto,
  ReportRefundTransferDto,
  ReviewRefundTransferDto,
} from './refunds.dto.js';
import { RefundsService } from './refunds.service.js';

const command = (type: string, resourceType: 'RefundRecord' | 'RefundTransfer') =>
  applyDecorators(
    Header('Cache-Control', 'private, no-store'),
    ApiHeader({
      name: 'Idempotency-Key',
      required: true,
      schema: { type: 'string', format: 'uuid' },
    }),
    ApiHeader({ name: 'X-CSRF-Token', required: true }),
    ApiResponse({ status: 409, type: ApiError }),
    ApiResponse({ status: 422, type: ApiError }),
    CriticalCommand({ type, resourceType, topic: `${type}.v1`, conflictOnPayloadMismatch: true }),
  );

@ManagerRoute()
@RequireStudentAccess('studentId')
@ApiResponse({ status: 404, type: ApiError })
@Controller('api/v1/manager/students/:studentId/requests/:requestId/refund')
export class ManagerRefundsController {
  constructor(private readonly refunds: RefundsService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    operationId: 'getManagerRefund',
    summary: 'Read the refund calculation and external transfer register',
  })
  @ApiOkResponse({ type: RefundViewDto })
  view(
    @CurrentAccount() actor: AccountContext,
    @Param('studentId') studentId: string,
    @Param('requestId') requestId: string,
  ) {
    return this.refunds.view(actor, requestId, studentId);
  }

  @Post('prepare')
  @command('manager.refund.prepared', 'RefundRecord')
  @ApiOperation({
    operationId: 'prepareManagerRefund',
    summary: 'Submit the refund calculation for director approval',
  })
  @ApiOkResponse({ type: RefundDecisionDto })
  prepare(
    @CurrentTransaction() ctx: CriticalContext,
    @Param('studentId') studentId: string,
    @Param('requestId') requestId: string,
    @Body() dto: PrepareRefundDto,
  ) {
    return this.refunds.prepare(ctx, studentId, requestId, dto);
  }

  @Post('transfers')
  @command('manager.refund.transfer-reported', 'RefundTransfer')
  @ApiOperation({
    operationId: 'reportManagerRefundTransfer',
    summary: 'Report evidence of an external transfer or return',
  })
  @ApiOkResponse({ type: RefundTransferDto })
  report(
    @CurrentTransaction() ctx: CriticalContext,
    @Param('studentId') studentId: string,
    @Param('requestId') requestId: string,
    @Body() dto: ReportRefundTransferDto,
  ) {
    return this.refunds.report(ctx, studentId, requestId, dto);
  }
}

@DirectorRoute()
@RequireVerifiedMfa()
@ApiResponse({ status: 404, type: ApiError })
@Controller('api/v1/director')
export class DirectorRefundsController {
  constructor(private readonly refunds: RefundsService) {}

  @Get('refunds')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    operationId: 'listDirectorRefundCases',
    summary: 'List accepted refund requests, decisions and pending transfer reviews',
  })
  @ApiQuery({ name: 'after', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: RefundCasesDto })
  cases(@CurrentAccount() actor: AccountContext, @Query('after') after?: string) {
    return this.refunds.cases(actor, after);
  }

  @Get('requests/:requestId/refund')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    operationId: 'getDirectorRefund',
    summary: 'Review the documented refund calculation and transfer evidence',
  })
  @ApiOkResponse({ type: RefundViewDto })
  view(@CurrentAccount() actor: AccountContext, @Param('requestId') requestId: string) {
    return this.refunds.view(actor, requestId);
  }

  @Post('requests/:requestId/refund/decide')
  @command('director.refund.decided', 'RefundRecord')
  @ApiOperation({
    operationId: 'decideDirectorRefund',
    summary: 'Approve the evidenced amount or decline the refund project',
  })
  @ApiOkResponse({ type: RefundDecisionDto })
  decide(
    @CurrentTransaction() ctx: CriticalContext,
    @Param('requestId') requestId: string,
    @Body() dto: DecideRefundDto,
  ) {
    return this.refunds.decide(ctx, requestId, dto);
  }

  @Post('requests/:requestId/refund/transfers/:transferId/review')
  @command('director.refund.transfer-reviewed', 'RefundTransfer')
  @ApiOperation({
    operationId: 'reviewDirectorRefundTransfer',
    summary: 'Verify or reject a reported external transfer or return',
  })
  @ApiOkResponse({ type: RefundTransferDto })
  review(
    @CurrentTransaction() ctx: CriticalContext,
    @Param('requestId') requestId: string,
    @Param('transferId') transferId: string,
    @Body() dto: ReviewRefundTransferDto,
  ) {
    return this.refunds.reviewTransfer(ctx, requestId, transferId, dto);
  }
}
