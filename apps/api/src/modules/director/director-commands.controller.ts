import { applyDecorators, Body, Controller, Param, Post } from '@nestjs/common';
import {
  ApiBody,
  ApiConflictResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
} from '@nestjs/swagger';
import type { CriticalContext } from '../../core/http.js';
import { CriticalCommand, CurrentTransaction } from '../../core/idempotency/idempotency.module.js';
import { ApiError } from '../../openapi/dtos.js';
import { serialize } from '../finance/finance-common.js';
import { DirectorCommandsService } from './director-commands.service.js';
import {
  ApproveDisputeCommandDto,
  ApproveRequestCommandDto,
  DeclineRequestCommandDto,
  DecisionResultDto,
  DirectorEmptyCommandDto,
  RejectPaymentCommandDto,
} from './dto/director-commands.dto.js';
import { DirectorRoute } from './guards/director-route.decorator.js';

const headers = () =>
  applyDecorators(
    ApiHeader({
      name: 'Idempotency-Key',
      required: true,
      schema: { type: 'string', format: 'uuid' },
    }),
    ApiHeader({ name: 'X-CSRF-Token', required: true, schema: { type: 'string' } }),
    ApiOkResponse({ type: DecisionResultDto }),
    ApiNotFoundResponse({ type: ApiError, description: 'Not pending or unknown' }),
    ApiConflictResponse({ type: ApiError, description: 'Already decided, stale or not ready' }),
    ApiParam({ name: 'id', type: String, format: 'uuid' }),
  );

// Same command types, resource types and topics as the generic commands they wrap, so audit,
// outbox handlers (payment follow-up, notifications) and idempotency scopes behave identically.
@DirectorRoute()
@Controller('api/v1/director')
export class DirectorCommandsController {
  constructor(private readonly commands: DirectorCommandsService) {}

  @Post('payments/:id/confirm')
  @CriticalCommand({
    type: 'payment.confirm',
    resourceType: 'PaymentReceipt',
    topic: 'payment.confirmed.v1',
  })
  @headers()
  @ApiBody({ type: DirectorEmptyCommandDto, required: false })
  @ApiOperation({
    operationId: 'directorConfirmPayment',
    summary:
      'Confirm a received payment: posts it to the ledger once; allocation is a separate decision',
  })
  async confirmPayment(
    @CurrentTransaction() ctx: CriticalContext,
    @Param('id') paymentId: string,
    // Body is validated (strict, no fields) by the DTO pipe; nothing to read from it.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    @Body() _body: DirectorEmptyCommandDto,
  ): Promise<unknown> {
    return serialize(await this.commands.confirmPayment(ctx, paymentId));
  }

  @Post('payments/:id/reject')
  @CriticalCommand({
    type: 'director.payment.reject',
    resourceType: 'PaymentReceipt',
    topic: 'manager.payment.command-rejected.v1',
    conflictOnPayloadMismatch: true,
  })
  @headers()
  @ApiBody({ type: RejectPaymentCommandDto })
  @ApiOperation({
    operationId: 'directorRejectPayment',
    summary: 'Reject a pending payment receipt with a reason (not possible after confirmation)',
  })
  async rejectPayment(
    @CurrentTransaction() ctx: CriticalContext,
    @Param('id') paymentId: string,
    @Body() body: RejectPaymentCommandDto,
  ): Promise<unknown> {
    return serialize(await this.commands.rejectPayment(ctx, paymentId, body.reason));
  }

  @Post('distributions/:id/approve')
  @CriticalCommand({
    type: 'distribution.approve',
    resourceType: 'PaymentDistribution',
    topic: 'payment.distribution-approved.v1',
  })
  @headers()
  @ApiBody({ type: DirectorEmptyCommandDto, required: false })
  @ApiOperation({
    operationId: 'directorApproveDistribution',
    summary: 'Approve the allocation of a confirmed payment to a subscription',
  })
  async approveDistribution(
    @CurrentTransaction() ctx: CriticalContext,
    @Param('id') distributionId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    @Body() _body: DirectorEmptyCommandDto,
  ): Promise<unknown> {
    return serialize(await this.commands.approveDistribution(ctx, distributionId));
  }

  @Post('schedule-exceptions/:id/approve')
  @CriticalCommand({
    type: 'schedule.change.approve',
    resourceType: 'ScheduleChangeApproval',
    topic: 'schedule.change.approved.v1',
    conflictOnPayloadMismatch: true,
  })
  @headers()
  @ApiBody({ type: DirectorEmptyCommandDto, required: false })
  @ApiOperation({
    operationId: 'directorApproveScheduleException',
    summary: 'Approve one exact lesson version and change; the manager then applies it',
  })
  async approveScheduleException(
    @CurrentTransaction() ctx: CriticalContext,
    @Param('id') approvalId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    @Body() _body: DirectorEmptyCommandDto,
  ): Promise<unknown> {
    return serialize(await this.commands.approveScheduleException(ctx, approvalId));
  }

  @Post('requests/:id/approve')
  @CriticalCommand({
    type: 'director.request.approve',
    resourceType: 'ManagerRequest',
    topic: 'director.request.approved.v1',
    conflictOnPayloadMismatch: true,
  })
  @headers()
  @ApiBody({ type: ApproveRequestCommandDto, required: false })
  @ApiOperation({
    operationId: 'directorApproveRequest',
    summary:
      'Approve a manager request: temporary access (limit and expiry, not a payment) or a refund calculation (no money moves)',
  })
  async approveRequest(
    @CurrentTransaction() ctx: CriticalContext,
    @Param('id') requestId: string,
    @Body() body: ApproveRequestCommandDto,
  ): Promise<unknown> {
    return serialize(await this.commands.approveRequest(ctx, requestId, body));
  }

  @Post('requests/:id/decline')
  @CriticalCommand({
    type: 'director.request.decline',
    resourceType: 'ManagerRequest',
    topic: 'director.request.declined.v1',
    conflictOnPayloadMismatch: true,
  })
  @headers()
  @ApiBody({ type: DeclineRequestCommandDto })
  @ApiOperation({
    operationId: 'directorDeclineRequest',
    summary: 'Decline a manager request with a reason the manager sees',
  })
  async declineRequest(
    @CurrentTransaction() ctx: CriticalContext,
    @Param('id') requestId: string,
    @Body() body: DeclineRequestCommandDto,
  ): Promise<unknown> {
    return serialize(await this.commands.declineRequest(ctx, requestId, body.reason));
  }

  @Post('disputes/:id/approve')
  @CriticalCommand({
    type: 'finance.crm-dispute.approve',
    resourceType: 'CrmTask',
    topic: 'finance.crm-dispute.approved.v1',
    conflictOnPayloadMismatch: true,
  })
  @headers()
  @ApiBody({ type: ApproveDisputeCommandDto })
  @ApiOperation({
    operationId: 'directorApproveDispute',
    summary: 'Execute the full-reversal proposal of an escalated attendance dispute',
  })
  async approveDispute(
    @CurrentTransaction() ctx: CriticalContext,
    @Param('id') taskId: string,
    @Body() body: ApproveDisputeCommandDto,
  ): Promise<unknown> {
    return serialize(await this.commands.approveDispute(ctx, taskId, body.version));
  }
}
