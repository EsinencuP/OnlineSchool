import * as ApiDto from '../../openapi/dtos.js';
import {
  ApiBody,
  ApiCookieAuth,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { FinanceScopeGuard } from './finance-scope.guard.js';
import type { AccountContext, CriticalContext } from '../../core/http.js';
import { CriticalCommand, CurrentTransaction } from '../../core/idempotency/idempotency.module.js';
import {
  CurrentAccount,
  RequireMfa,
  RequirePermission,
  RequireRole,
} from '../../core/rbac/decorators.js';
import { PaymentsService } from './payments.service.js';
import { EntitlementsService } from './entitlements.service.js';
import { FinanceLedger } from './finance-ledger.service.js';
import { PeriodsService } from './periods.service.js';
import { PayrollService } from './payroll.service.js';
import { serialize } from './finance-common.js';

@Controller('api/v1')
@UseGuards(FinanceScopeGuard)
@RequireMfa()
@RequireRole('DIRECTOR', 'MANAGER')
export class FinanceController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly entitlements: EntitlementsService,
    private readonly ledger: FinanceLedger,
    private readonly periods: PeriodsService,
    private readonly payroll: PayrollService,
  ) {}
  @ApiOperation({
    operationId: 'registerPayment',
    summary: 'Register payment',
    description:
      'MFA required. MANAGER/DIRECTOR; active assigned student context. Registers a receipt without paid rights.',
  })
  @ApiResponse({
    status: 200,
    type: ApiDto.PaymentReceiptResponse,
    description: 'Successful response',
    headers: { 'X-Request-ID': { schema: { type: 'string', format: 'uuid' } } },
  })
  @ApiResponse({ status: 400, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 401, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 403, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 409, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 422, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 503, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', format: 'uuid' },
    description: 'Required for critical business commands; reuse only for identical payload',
  })
  @ApiHeader({ name: 'X-Request-ID', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({ name: 'X-CSRF-Token', required: true, schema: { type: 'string' } })
  @ApiCookieAuth('sessionCookie')
  @ApiBody({ type: ApiDto.PaymentRegisterRequest, required: true })
  @ApiTags('Finance')
  @Post('payments/register')
  @RequirePermission('payment:register')
  @CriticalCommand({
    type: 'payment.register',
    resourceType: 'PaymentReceipt',
    topic: 'payment.registered.v1',
  })
  async register(
    @CurrentTransaction() ctx: CriticalContext,
    @Body() body: ApiDto.PaymentRegisterRequest,
  ) {
    return serialize(await this.payments.register(ctx, body));
  }
  @ApiOperation({
    operationId: 'confirmPayment',
    summary: 'Confirm payment',
    description:
      'MFA required. DIRECTOR only. Confirms once and atomically posts cash/unallocated funds plus audit, outbox and internal CRM task.',
  })
  @ApiResponse({
    status: 200,
    type: ApiDto.PaymentReceiptResponse,
    description: 'Successful response',
    headers: { 'X-Request-ID': { schema: { type: 'string', format: 'uuid' } } },
  })
  @ApiResponse({ status: 400, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 401, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 403, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 409, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 422, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 503, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', format: 'uuid' },
    description: 'Required for critical business commands; reuse only for identical payload',
  })
  @ApiHeader({ name: 'X-Request-ID', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({ name: 'X-CSRF-Token', required: true, schema: { type: 'string' } })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiCookieAuth('sessionCookie')
  @ApiBody({ type: ApiDto.ConfirmPaymentRequest, required: true })
  @ApiTags('Finance')
  @Post('payments/:id/confirm')
  @RequireRole('DIRECTOR')
  @RequirePermission('payment:confirm')
  @CriticalCommand({
    type: 'payment.confirm',
    resourceType: 'PaymentReceipt',
    topic: 'payment.confirmed.v1',
  })
  async confirm(
    @CurrentTransaction() ctx: CriticalContext,
    @Param('id') id: string,
    @Body() body: ApiDto.ConfirmPaymentRequest,
  ) {
    return serialize(await this.payments.confirm(ctx, id, body));
  }
  @ApiOperation({
    operationId: 'proposePaymentDistribution',
    summary: 'Propose payment distribution',
    description:
      'MFA required. MANAGER/DIRECTOR, assigned student context for both contact and subscription; proposal is not approval.',
  })
  @ApiResponse({
    status: 200,
    type: ApiDto.PaymentDistributionResponse,
    description: 'Successful response',
    headers: { 'X-Request-ID': { schema: { type: 'string', format: 'uuid' } } },
  })
  @ApiResponse({ status: 400, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 401, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 403, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 409, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 422, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 503, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', format: 'uuid' },
    description: 'Required for critical business commands; reuse only for identical payload',
  })
  @ApiHeader({ name: 'X-Request-ID', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({ name: 'X-CSRF-Token', required: true, schema: { type: 'string' } })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiCookieAuth('sessionCookie')
  @ApiBody({ type: ApiDto.PaymentDistributionRequest, required: true })
  @ApiTags('Finance')
  @Post('payments/:id/distribute')
  @RequirePermission('payment:distribute')
  @CriticalCommand({
    type: 'payment.distribute',
    resourceType: 'PaymentDistribution',
    topic: 'payment.distribution-proposed.v1',
  })
  async distribute(
    @CurrentTransaction() ctx: CriticalContext,
    @Param('id') id: string,
    @Body() body: ApiDto.PaymentDistributionRequest,
  ) {
    return serialize(await this.payments.propose(ctx, id, body));
  }
  @ApiOperation({
    operationId: 'approveDistribution',
    summary: 'Approve distribution',
    description:
      'MFA required. DIRECTOR only, confirmed receipt required; recognizes customer advance.',
  })
  @ApiResponse({
    status: 200,
    type: ApiDto.PaymentDistributionResponse,
    description: 'Successful response',
    headers: { 'X-Request-ID': { schema: { type: 'string', format: 'uuid' } } },
  })
  @ApiResponse({ status: 400, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 401, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 403, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 409, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 422, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 503, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', format: 'uuid' },
    description: 'Required for critical business commands; reuse only for identical payload',
  })
  @ApiHeader({ name: 'X-Request-ID', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({ name: 'X-CSRF-Token', required: true, schema: { type: 'string' } })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiCookieAuth('sessionCookie')
  @ApiBody({ type: ApiDto.ApproveDistributionRequest, required: true })
  @ApiTags('Finance')
  @Post('distributions/:id/approve')
  @RequireRole('DIRECTOR')
  @RequirePermission('distribution:approve')
  @CriticalCommand({
    type: 'distribution.approve',
    resourceType: 'PaymentDistribution',
    topic: 'payment.distribution-approved.v1',
  })
  async approve(
    @CurrentTransaction() ctx: CriticalContext,
    @Param('id') id: string,
    @Body() body: ApiDto.ApproveDistributionRequest,
  ) {
    return serialize(await this.payments.approve(ctx, id, body));
  }
  @ApiOperation({
    operationId: 'createSubscription',
    summary: 'Create subscription',
    description:
      'MFA required. MANAGER/DIRECTOR, assigned student. Server sale-condition snapshots; inexact per-lesson division requires review.',
  })
  @ApiResponse({
    status: 200,
    type: ApiDto.SubscriptionResponse,
    description: 'Successful response',
    headers: { 'X-Request-ID': { schema: { type: 'string', format: 'uuid' } } },
  })
  @ApiResponse({ status: 400, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 401, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 403, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 409, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 422, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 503, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', format: 'uuid' },
    description: 'Required for critical business commands; reuse only for identical payload',
  })
  @ApiHeader({ name: 'X-Request-ID', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({ name: 'X-CSRF-Token', required: true, schema: { type: 'string' } })
  @ApiCookieAuth('sessionCookie')
  @ApiBody({ type: ApiDto.SubscriptionCreateRequest, required: true })
  @ApiTags('Finance')
  @Post('subscriptions')
  @RequirePermission('subscription:create')
  @CriticalCommand({
    type: 'subscription.create',
    resourceType: 'Subscription',
    topic: 'subscription.created.v1',
  })
  async subscription(
    @CurrentTransaction() ctx: CriticalContext,
    @Body() body: ApiDto.SubscriptionCreateRequest,
  ) {
    return serialize(await this.payments.subscription(ctx, body));
  }
  @ApiOperation({
    operationId: 'grantEntitlement',
    summary: 'Grant entitlement',
    description:
      'MFA required. MANAGER/DIRECTOR. Entire subscription price must be covered by confirmed approved allocations; no duplicate rights.',
  })
  @ApiResponse({
    status: 200,
    type: ApiDto.EntitlementGrantResponse,
    description: 'Successful response',
    headers: { 'X-Request-ID': { schema: { type: 'string', format: 'uuid' } } },
  })
  @ApiResponse({ status: 400, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 401, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 403, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 409, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 422, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 503, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', format: 'uuid' },
    description: 'Required for critical business commands; reuse only for identical payload',
  })
  @ApiHeader({ name: 'X-Request-ID', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({ name: 'X-CSRF-Token', required: true, schema: { type: 'string' } })
  @ApiCookieAuth('sessionCookie')
  @ApiBody({ type: ApiDto.EntitlementGrantRequest, required: true })
  @ApiTags('Finance')
  @Post('entitlements/grant')
  @RequirePermission('entitlement:grant')
  @CriticalCommand({
    type: 'entitlement.grant',
    resourceType: 'EntitlementGrant',
    topic: 'entitlement.granted.v1',
  })
  async grant(
    @CurrentTransaction() ctx: CriticalContext,
    @Body() body: ApiDto.EntitlementGrantRequest,
  ) {
    return serialize(await this.payments.grant(ctx, body));
  }
  @ApiOperation({
    operationId: 'consumeEntitlement',
    summary: 'Consume entitlement',
    description:
      'MFA required. MANAGER/DIRECTOR. Conducted confirmed lesson, open period, locked derived balance. SQL prevents duplicate consumption.',
  })
  @ApiResponse({
    status: 200,
    type: ApiDto.EntitlementConsumptionResponse,
    description: 'Successful response',
    headers: { 'X-Request-ID': { schema: { type: 'string', format: 'uuid' } } },
  })
  @ApiResponse({ status: 400, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 401, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 403, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 409, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 422, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 503, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', format: 'uuid' },
    description: 'Required for critical business commands; reuse only for identical payload',
  })
  @ApiHeader({ name: 'X-Request-ID', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({ name: 'X-CSRF-Token', required: true, schema: { type: 'string' } })
  @ApiCookieAuth('sessionCookie')
  @ApiBody({ type: ApiDto.EntitlementConsumeRequest, required: true })
  @ApiTags('Finance')
  @Post('entitlements/consume')
  @RequirePermission('entitlement:consume')
  @CriticalCommand({
    type: 'entitlement.consume',
    resourceType: 'EntitlementConsumption',
    topic: 'entitlement.consumed.v1',
  })
  async consume(
    @CurrentTransaction() ctx: CriticalContext,
    @Body() body: ApiDto.EntitlementConsumeRequest,
  ) {
    return serialize(await this.entitlements.consume(ctx, body));
  }
  @ApiOperation({
    operationId: 'adjustEntitlement',
    summary: 'Adjust entitlement',
    description:
      'MFA required. DIRECTOR only; original source and reason. Cancellation reverses revenue separately in an open period.',
  })
  @ApiResponse({
    status: 200,
    type: ApiDto.EntitlementAdjustmentResponse,
    description: 'Successful response',
    headers: { 'X-Request-ID': { schema: { type: 'string', format: 'uuid' } } },
  })
  @ApiResponse({ status: 400, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 401, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 403, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 409, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 422, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 503, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', format: 'uuid' },
    description: 'Required for critical business commands; reuse only for identical payload',
  })
  @ApiHeader({ name: 'X-Request-ID', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({ name: 'X-CSRF-Token', required: true, schema: { type: 'string' } })
  @ApiCookieAuth('sessionCookie')
  @ApiBody({ type: ApiDto.EntitlementAdjustRequest, required: true })
  @ApiTags('Finance')
  @Post('entitlements/adjust')
  @RequireRole('DIRECTOR')
  @RequirePermission('entitlement:adjust')
  @CriticalCommand({
    type: 'entitlement.adjust',
    resourceType: 'EntitlementAdjustment',
    topic: 'entitlement.adjusted.v1',
  })
  async adjust(
    @CurrentTransaction() ctx: CriticalContext,
    @Body() body: ApiDto.EntitlementAdjustRequest,
  ) {
    return serialize(await this.entitlements.adjust(ctx, body));
  }
  @ApiOperation({
    operationId: 'grantTemporaryAccess',
    summary: 'Grant temporary access',
    description:
      'MFA required. DIRECTOR only; limited separate decision for every partial installment. Does not create paid grants; worker creates internal expiry task.',
  })
  @ApiResponse({
    status: 200,
    type: ApiDto.TemporaryAccessResponse,
    description: 'Successful response',
    headers: { 'X-Request-ID': { schema: { type: 'string', format: 'uuid' } } },
  })
  @ApiResponse({ status: 400, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 401, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 403, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 409, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 422, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 503, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', format: 'uuid' },
    description: 'Required for critical business commands; reuse only for identical payload',
  })
  @ApiHeader({ name: 'X-Request-ID', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({ name: 'X-CSRF-Token', required: true, schema: { type: 'string' } })
  @ApiCookieAuth('sessionCookie')
  @ApiBody({ type: ApiDto.TemporaryAccessRequest, required: true })
  @ApiTags('Finance')
  @Post('temporary-access')
  @RequireRole('DIRECTOR')
  @RequirePermission('temporary-access:grant')
  @CriticalCommand({
    type: 'temporary-access.grant',
    resourceType: 'TemporaryAccessPermission',
    topic: 'temporary-access.granted.v1',
  })
  async temporary(
    @CurrentTransaction() ctx: CriticalContext,
    @Body() body: ApiDto.TemporaryAccessRequest,
  ) {
    return serialize(await this.payments.temporary(ctx, body));
  }
  @ApiOperation({
    operationId: 'publishLedgerEntry',
    summary: 'Publish ledger entry',
    description:
      'MFA required. DIRECTOR only; exactly one documentId/entryId. Existing authorized source and exact canonical balanced lines per currency required.',
  })
  @ApiResponse({
    status: 200,
    type: ApiDto.LedgerEntryResponse,
    description: 'Successful response',
    headers: { 'X-Request-ID': { schema: { type: 'string', format: 'uuid' } } },
  })
  @ApiResponse({ status: 400, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 401, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 403, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 409, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 422, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 503, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', format: 'uuid' },
    description: 'Required for critical business commands; reuse only for identical payload',
  })
  @ApiHeader({ name: 'X-Request-ID', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({ name: 'X-CSRF-Token', required: true, schema: { type: 'string' } })
  @ApiCookieAuth('sessionCookie')
  @ApiBody({ type: ApiDto.LedgerPublishRequest, required: true })
  @ApiTags('Finance')
  @Post('ledger/entries')
  @RequireRole('DIRECTOR')
  @RequirePermission('ledger:publish')
  @CriticalCommand({
    type: 'ledger.publish.command',
    resourceType: 'LedgerEntry',
    topic: 'ledger.command.published.v1',
  })
  async publish(
    @CurrentTransaction() ctx: CriticalContext,
    @Body() body: ApiDto.LedgerPublishRequest,
  ) {
    return serialize(await this.ledger.publish(ctx, body));
  }
  @ApiOperation({
    operationId: 'correctLedgerEntry',
    summary: 'Correct ledger entry',
    description:
      'MFA required. DIRECTOR only. Immutable reversal plus canonical replacement in current open period. No source rewriting or arbitrary new obligations.',
  })
  @ApiResponse({
    status: 200,
    type: ApiDto.LedgerAdjustmentResponse,
    description: 'Successful response',
    headers: { 'X-Request-ID': { schema: { type: 'string', format: 'uuid' } } },
  })
  @ApiResponse({ status: 400, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 401, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 403, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 409, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 422, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 503, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', format: 'uuid' },
    description: 'Required for critical business commands; reuse only for identical payload',
  })
  @ApiHeader({ name: 'X-Request-ID', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({ name: 'X-CSRF-Token', required: true, schema: { type: 'string' } })
  @ApiCookieAuth('sessionCookie')
  @ApiBody({ type: ApiDto.LedgerAdjustRequest, required: true })
  @ApiTags('Finance')
  @Post('ledger/adjustments')
  @RequireRole('DIRECTOR')
  @RequirePermission('ledger:adjust')
  @CriticalCommand({
    type: 'ledger.adjust',
    resourceType: 'LedgerEntry',
    topic: 'ledger.adjusted.v1',
  })
  async ledgerAdjust(
    @CurrentTransaction() ctx: CriticalContext,
    @Body() body: ApiDto.LedgerAdjustRequest,
  ) {
    return serialize(await this.ledger.correct(ctx, body));
  }
  @ApiOperation({
    operationId: 'listFinancialPeriods',
    summary: 'List financial periods',
    description: 'MFA required. MANAGER/DIRECTOR, latest 100 periods.',
  })
  @ApiResponse({
    status: 200,
    type: ApiDto.FinancialPeriodResponse,
    isArray: true,
    description: 'Successful response',
    headers: { 'X-Request-ID': { schema: { type: 'string', format: 'uuid' } } },
  })
  @ApiResponse({ status: 400, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 401, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 403, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 409, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 422, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 503, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    schema: { type: 'string', format: 'uuid' },
    description: 'Required for critical business commands; reuse only for identical payload',
  })
  @ApiHeader({ name: 'X-Request-ID', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiCookieAuth('sessionCookie')
  @ApiTags('Finance')
  @Get('periods')
  @RequirePermission('period:read')
  async list() {
    return serialize(await this.periods.list());
  }
  @ApiOperation({
    operationId: 'closeFinancialPeriod',
    summary: 'Close financial period',
    description:
      'MFA required. DIRECTOR only; past completed period without draft/unresolved financial facts.',
  })
  @ApiResponse({
    status: 200,
    type: ApiDto.FinancialPeriodResponse,
    description: 'Successful response',
    headers: { 'X-Request-ID': { schema: { type: 'string', format: 'uuid' } } },
  })
  @ApiResponse({ status: 400, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 401, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 403, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 409, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 422, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 503, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', format: 'uuid' },
    description: 'Required for critical business commands; reuse only for identical payload',
  })
  @ApiHeader({ name: 'X-Request-ID', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({ name: 'X-CSRF-Token', required: true, schema: { type: 'string' } })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiCookieAuth('sessionCookie')
  @ApiBody({ type: ApiDto.CloseFinancialPeriodRequest, required: true })
  @ApiTags('Finance')
  @Post('periods/:id/close')
  @RequireRole('DIRECTOR')
  @RequirePermission('period:close')
  @CriticalCommand({
    type: 'period.close',
    resourceType: 'FinancialPeriod',
    topic: 'period.closed.v1',
  })
  async close(
    @CurrentTransaction() ctx: CriticalContext,
    @Param('id') id: string,
    @Body() body: ApiDto.CloseFinancialPeriodRequest,
  ) {
    return serialize(await this.periods.close(ctx, id, body));
  }
  @ApiOperation({
    operationId: 'createTeacherAccrual',
    summary: 'Create teacher accrual',
    description:
      'MFA required. MANAGER/DIRECTOR, assigned student; immutable actual-start snapshot. Unpaid performed work requires explicit director amount decision.',
  })
  @ApiResponse({
    status: 200,
    type: ApiDto.TeacherAccrualResponse,
    description: 'Successful response',
    headers: { 'X-Request-ID': { schema: { type: 'string', format: 'uuid' } } },
  })
  @ApiResponse({ status: 400, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 401, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 403, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 409, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 422, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 503, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', format: 'uuid' },
    description: 'Required for critical business commands; reuse only for identical payload',
  })
  @ApiHeader({ name: 'X-Request-ID', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({ name: 'X-CSRF-Token', required: true, schema: { type: 'string' } })
  @ApiCookieAuth('sessionCookie')
  @ApiBody({ type: ApiDto.AccrualCreateRequest, required: true })
  @ApiTags('Finance')
  @Post('accruals')
  @RequirePermission('payroll:accrue')
  @CriticalCommand({
    type: 'payroll.accrue',
    resourceType: 'TeacherAccrual',
    topic: 'payroll.accrued.v1',
  })
  async accrue(
    @CurrentTransaction() ctx: CriticalContext,
    @Body() body: ApiDto.AccrualCreateRequest,
  ) {
    return serialize(await this.payroll.accrue(ctx, body));
  }
  @ApiOperation({
    operationId: 'createPayoutAttempt',
    summary: 'Create payout attempt',
    description:
      'MFA required. MANAGER/DIRECTOR, assigned student; recognizes an attempt, not a transfer. Pending/UNKNOWN reservations block another attempt.',
  })
  @ApiResponse({
    status: 200,
    type: ApiDto.PayoutAttemptResponse,
    description: 'Successful response',
    headers: { 'X-Request-ID': { schema: { type: 'string', format: 'uuid' } } },
  })
  @ApiResponse({ status: 400, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 401, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 403, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 409, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 422, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 503, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', format: 'uuid' },
    description: 'Required for critical business commands; reuse only for identical payload',
  })
  @ApiHeader({ name: 'X-Request-ID', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({ name: 'X-CSRF-Token', required: true, schema: { type: 'string' } })
  @ApiCookieAuth('sessionCookie')
  @ApiBody({ type: ApiDto.PayoutAttemptRequest, required: true })
  @ApiTags('Finance')
  @Post('payouts/attempt')
  @RequirePermission('payroll:payout')
  @CriticalCommand({
    type: 'payroll.payout.attempt',
    resourceType: 'PayoutAttempt',
    topic: 'payroll.payout.attempted.v1',
  })
  async payoutAttempt(
    @CurrentTransaction() ctx: CriticalContext,
    @Body() body: ApiDto.PayoutAttemptRequest,
  ) {
    return serialize(await this.payroll.attempt(ctx, body));
  }
  @ApiOperation({
    operationId: 'confirmPayout',
    summary: 'Confirm payout',
    description:
      'MFA required. MANAGER/DIRECTOR, assigned student; evidence reference, PENDING attempt only. UNKNOWN needs separate reconciliation.',
  })
  @ApiResponse({
    status: 200,
    type: ApiDto.ConfirmedPayoutResponse,
    description: 'Successful response',
    headers: { 'X-Request-ID': { schema: { type: 'string', format: 'uuid' } } },
  })
  @ApiResponse({ status: 400, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 401, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 403, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 409, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 422, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 503, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', format: 'uuid' },
    description: 'Required for critical business commands; reuse only for identical payload',
  })
  @ApiHeader({ name: 'X-Request-ID', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({ name: 'X-CSRF-Token', required: true, schema: { type: 'string' } })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiCookieAuth('sessionCookie')
  @ApiBody({ type: ApiDto.PayoutConfirmRequest, required: true })
  @ApiTags('Finance')
  @Post('payouts/:id/confirm')
  @RequirePermission('payroll:payout')
  @CriticalCommand({
    type: 'payroll.payout.confirm',
    resourceType: 'ConfirmedPayout',
    topic: 'payroll.payout.confirmed.v1',
  })
  async payoutConfirm(
    @CurrentTransaction() ctx: CriticalContext,
    @Param('id') id: string,
    @Body() body: ApiDto.PayoutConfirmRequest,
  ) {
    return serialize(await this.payroll.confirm(ctx, id, body));
  }
  @ApiOperation({
    operationId: 'getTeacherPayroll',
    summary: 'Get teacher payroll',
    description:
      'MFA required. DIRECTOR or the TEACHER who owns this profile. At most 100 accruals; no student prices or margin.',
  })
  @ApiResponse({
    status: 200,
    type: ApiDto.TeacherPayrollResponse,
    description: 'Successful response',
    headers: { 'X-Request-ID': { schema: { type: 'string', format: 'uuid' } } },
  })
  @ApiResponse({ status: 400, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 401, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 403, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 409, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 422, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 503, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    schema: { type: 'string', format: 'uuid' },
    description: 'Required for critical business commands; reuse only for identical payload',
  })
  @ApiHeader({ name: 'X-Request-ID', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiCookieAuth('sessionCookie')
  @ApiTags('Finance')
  @Get('teacher/:id/payroll')
  @RequireRole('DIRECTOR', 'TEACHER')
  @RequirePermission('payroll:read')
  async teacherPayroll(@CurrentAccount() actor: AccountContext, @Param('id') id: string) {
    return serialize(await this.payroll.read(actor, id));
  }
}
