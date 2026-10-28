import { Controller, Get, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RequireRole } from '../../core/rbac/decorators.js';
import { ProblemDetails } from '../../core/errors/error-mapper.js';
import { StudentCtx } from '../student-context.decorator.js';
import type { IStudentContext } from '../student-context.interface.js';
import { StudentSubscriptionService } from './subscription.service.js';
import {
  PaymentHistoryResponseDto,
  StudentSubscriptionLedgerResponseDto,
  SubscriptionDetailsDto,
  SubscriptionHistoryQueryDto,
  SubscriptionHistoryQueryPipe,
  SubscriptionQueryDto,
  SubscriptionQueryPipe,
} from './subscription.dto.js';
import type { SubscriptionPage } from './subscription.dto.js';

@ApiTags('Student')
@ApiCookieAuth('sessionCookie')
@RequireRole('STUDENT')
@ApiResponse({ status: 400, type: ProblemDetails })
@ApiResponse({ status: 401, type: ProblemDetails })
@ApiResponse({ status: 403, type: ProblemDetails })
@ApiResponse({ status: 503, type: ProblemDetails })
@Controller('api/v1/student/subscription')
export class StudentSubscriptionController {
  constructor(private readonly subscription: StudentSubscriptionService) {}
  @Get()
  @ApiOperation({
    operationId: 'getStudentSubscription',
    summary: 'Read-only CRM subscription showcase',
    description:
      'Optional owned subscriptionId; defaults to latest current plan, then most recent expired plan. Period status is separate from paid lesson rights. Temporary admission and future bookings never create paid balance. Available without active learning access; first password change remains mandatory.',
  })
  @ApiResponse({ status: 200, type: SubscriptionDetailsDto })
  details(
    @StudentCtx() student: IStudentContext,
    @Query(SubscriptionQueryPipe) query: SubscriptionQueryDto,
  ) {
    return this.subscription.details(student, query);
  }
  @Get('payments')
  @ApiOperation({
    operationId: 'getStudentSubscriptionPayments',
    summary: 'Confirmed payment allocations for the selected subscription',
    description:
      'Only director-confirmed receipts and approved, currently published allocations. Amount is the share allocated to this subscription, not another student’s share of a combined receipt. Actual ISO currency (including MDL), exact Decimal strings. No payment command or gateway.',
  })
  @ApiResponse({ status: 200, type: PaymentHistoryResponseDto })
  payments(
    @StudentCtx() student: IStudentContext,
    @Query(SubscriptionHistoryQueryPipe) query: SubscriptionHistoryQueryDto,
  ) {
    return this.subscription.payments(student, query as SubscriptionPage);
  }
  @Get('ledger')
  @ApiOperation({
    operationId: 'getStudentSubscriptionLedger',
    summary: 'Chronological paid lesson-right operations for the selected subscription',
    description:
      'Read model of grants, published deductions, explicit adjustments/cancellations and recorded freeze intervals. Balances are Decimal lesson quantities, not money. Published deduction snapshots retained; other balances replay canonical quantity events. Newest first. Missing pre-migration freeze history is not invented; no accounting entries are written.',
  })
  @ApiResponse({ status: 200, type: StudentSubscriptionLedgerResponseDto })
  ledger(
    @StudentCtx() student: IStudentContext,
    @Query(SubscriptionHistoryQueryPipe) query: SubscriptionHistoryQueryDto,
  ) {
    return this.subscription.ledger(student, query as SubscriptionPage);
  }
}
