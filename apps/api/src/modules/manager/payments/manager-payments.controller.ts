import {
  applyDecorators,
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiServiceUnavailableResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import {
  CriticalCommand,
  CurrentTransaction,
} from '../../../core/idempotency/idempotency.module.js';
import type { CriticalContext } from '../../../core/http.js';
import { unwrap } from '../../../core/errors/domain-error.js';
import { ApiError } from '../../../openapi/dtos.js';
import { ManagerRoute } from '../guards/manager-route.decorator.js';
import type { ManagerRequest } from '../context/manager-context.js';
import {
  CreateManagerPaymentDto,
  ConfirmManagerPaymentDto,
  RejectManagerPaymentDto,
  ListManagerPaymentsQueryDto,
  PrepareManagerDistributionDto,
  AllocateManagerPaymentDto,
  ManagerPaymentDto,
  ManagerPaymentPageDto,
  ManagerDistributionDto,
  ManagerDistributionPageDto,
} from '../dto/manager-payment.dto.js';
import { ManagerPaymentsGuard } from './manager-payments.guard.js';
import { ManagerPaymentsService } from './manager-payments.service.js';
import { StaffActionEligibilityDto } from '../../../core/actor/actor-context.dto.js';
const command = (type: string, topic: string, status: 200 | 201 = 200) =>
  applyDecorators(
    ApiHeader({
      name: 'Idempotency-Key',
      required: true,
      schema: { type: 'string', format: 'uuid' },
    }),
    ApiHeader({ name: 'X-CSRF-Token', required: true }),
    CriticalCommand({
      type,
      resourceType: 'PaymentReceipt',
      topic,
      resultIdField: 'id',
      successStatus: status,
      conflictOnPayloadMismatch: true,
    }),
  );
@UseGuards(ManagerPaymentsGuard)
@ManagerRoute()
@ApiBadRequestResponse({ type: ApiError, description: 'INVALID_INPUT, IDEMPOTENCY_KEY_REQUIRED' })
@ApiNotFoundResponse({
  type: ApiError,
  description: 'PAYMENT_NOT_FOUND, STUDENT_NOT_FOUND, SUBSCRIPTION_NOT_FOUND',
})
@ApiConflictResponse({
  type: ApiError,
  description: 'PAYMENT_DUPLICATE, PAYMENT_IMMUTABLE, PAYMENT_NOT_PENDING',
})
@ApiUnprocessableEntityResponse({
  type: ApiError,
  description: 'INVALID_MONEY, CURRENCY_NOT_SUPPORTED, INVALID_RECEIVED_AT',
})
@ApiServiceUnavailableResponse({ type: ApiError })
@Controller('api/v1/manager')
export class ManagerPaymentsController {
  constructor(private readonly payments: ManagerPaymentsService) {}

  @Get('payments/:paymentId/approval-eligibility')
  @ApiParam({ name: 'paymentId', schema: { type: 'string', format: 'uuid' } })
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    operationId: 'getManagerPaymentApprovalEligibility',
    summary: 'Own approval request policy; never director receipt confirmation',
  })
  @ApiOkResponse({ type: StaffActionEligibilityDto })
  async approvalEligibility(
    @Req() req: ManagerRequest,
    @Param('paymentId') id: string,
  ): Promise<StaffActionEligibilityDto> {
    return unwrap(
      await this.payments.approvalEligibility(req.managerCtx!, id, req.account!, req.requestId!),
    );
  }
  @Post('students/:studentId/payments')
  @ApiOperation({ operationId: 'createManagerPayment' })
  @ApiCreatedResponse({ type: ManagerPaymentDto })
  @command('manager.payment.create', 'manager.payment.command-created.v1', 201)
  async create(
    @Req() r: ManagerRequest,
    @Param('studentId') id: string,
    @Body() dto: CreateManagerPaymentDto,
    @CurrentTransaction() c: CriticalContext,
  ): Promise<ManagerPaymentDto> {
    return unwrap(await this.payments.create(r.managerCtx!, id, dto, c));
  }
  @Get('students/:studentId/payments')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({ operationId: 'listManagerPayments' })
  @ApiOkResponse({ type: ManagerPaymentPageDto })
  async list(
    @Req() r: ManagerRequest,
    @Param('studentId') id: string,
    @Query() q: ListManagerPaymentsQueryDto,
  ): Promise<ManagerPaymentPageDto> {
    return unwrap(await this.payments.list(r.managerCtx!, id, q));
  }
  @Get('payments/:paymentId')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({ operationId: 'getManagerPayment' })
  @ApiOkResponse({ type: ManagerPaymentDto })
  async get(@Req() r: ManagerRequest, @Param('paymentId') id: string): Promise<ManagerPaymentDto> {
    return unwrap(await this.payments.get(r.managerCtx!, id));
  }
  @Post('payments/:paymentId/confirm')
  @ApiOperation({
    operationId: 'confirmManagerPayment',
    description:
      'Submits director approval under current Finance policy. Never grants the manager director publication authority.',
  })
  @ApiOkResponse({ type: ManagerPaymentDto })
  @ApiBody({
    required: false,
    schema: { type: 'object', additionalProperties: false, maxProperties: 0 },
  })
  @command('manager.payment.confirm', 'manager.payment.command-confirmed.v1')
  async confirm(
    @Req() r: ManagerRequest,
    @Param('paymentId') id: string,
    @Body() _dto: ConfirmManagerPaymentDto,
    @CurrentTransaction() c: CriticalContext,
  ): Promise<ManagerPaymentDto> {
    return unwrap(await this.payments.confirm(r.managerCtx!, id, c));
  }
  @Post('payments/:paymentId/reject')
  @ApiOperation({ operationId: 'rejectManagerPayment' })
  @ApiOkResponse({ type: ManagerPaymentDto })
  @command('manager.payment.reject', 'manager.payment.command-rejected.v1')
  async reject(
    @Req() r: ManagerRequest,
    @Param('paymentId') id: string,
    @Body() dto: RejectManagerPaymentDto,
    @CurrentTransaction() c: CriticalContext,
  ): Promise<ManagerPaymentDto> {
    return unwrap(await this.payments.reject(r.managerCtx!, id, dto.reason, c));
  }
  @Post('payments/:paymentId/prepare-subscription')
  @ApiOperation({
    operationId: 'prepareManagerPaymentSubscription',
    description:
      'Creates a financial purchase and a proposed allocation. Director approval/publication is still required.',
  })
  @ApiCreatedResponse({ type: ManagerDistributionDto })
  @command('manager.payment.prepare', 'manager.payment.command-prepared.v1', 201)
  async prepare(
    @Req() r: ManagerRequest,
    @Param('paymentId') id: string,
    @Body() dto: PrepareManagerDistributionDto,
    @CurrentTransaction() c: CriticalContext,
  ): Promise<ManagerDistributionDto> {
    return unwrap(await this.payments.prepare(r.managerCtx!, id, dto, c));
  }
  @Post('payments/:paymentId/distributions')
  @ApiOperation({
    operationId: 'allocateManagerPayment',
    description:
      'Proposes another receipt allocation to an existing purchase, including installment top-ups. No automatic admission.',
  })
  @ApiCreatedResponse({ type: ManagerDistributionDto })
  @command('manager.payment.allocate', 'manager.payment.command-allocated.v1', 201)
  async allocate(
    @Req() r: ManagerRequest,
    @Param('paymentId') id: string,
    @Body() dto: AllocateManagerPaymentDto,
    @CurrentTransaction() c: CriticalContext,
  ): Promise<ManagerDistributionDto> {
    return unwrap(await this.payments.allocate(r.managerCtx!, id, dto, c));
  }
  @Get('students/:studentId/distributions')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    operationId: 'listManagerDistributions',
    description:
      'Recipient-owned allocations only; does not expose contact receipts or household totals.',
  })
  @ApiOkResponse({ type: ManagerDistributionPageDto })
  async distributions(
    @Req() r: ManagerRequest,
    @Param('studentId') id: string,
    @Query() q: ListManagerPaymentsQueryDto,
  ): Promise<ManagerDistributionPageDto> {
    return unwrap(await this.payments.distributions(r.managerCtx!, id, q));
  }
}
