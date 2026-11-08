import { Body, Controller, Get, Header, Param, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBody,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
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
  CreateManagerSubscriptionDto,
  RenewManagerSubscriptionDto,
  FreezeManagerSubscriptionDto,
  UnfreezeManagerSubscriptionDto,
  ManagerSubscriptionDto,
} from '../dto/manager-subscription.dto.js';
import { ManagerSubscriptionsGuard } from './manager-subscriptions.guard.js';
import { ManagerSubscriptionsService } from './manager-subscriptions.service.js';
@UseGuards(ManagerSubscriptionsGuard)
@ManagerRoute()
@ApiBadRequestResponse({ type: ApiError, description: 'INVALID_INPUT or IDEMPOTENCY_KEY_REQUIRED' })
@ApiNotFoundResponse({
  type: ApiError,
  description: 'STUDENT_NOT_FOUND, SUBSCRIPTION_NOT_FOUND, DISTRIBUTION_NOT_FOUND, PLAN_NOT_FOUND',
})
@ApiConflictResponse({
  type: ApiError,
  description:
    'INVALID_STATE_TRANSITION, ACTIVE_SUBSCRIPTION_EXISTS, DISTRIBUTION_ALREADY_USED, FINANCIAL_PACKAGE_ALREADY_ATTACHED, PAYMENT_NOT_CONFIRMED, FREEZE_LIMIT_EXCEEDED, FREEZE_HAS_LESSONS (details.lessonIds)',
})
@ApiUnprocessableEntityResponse({ type: ApiError })
@ApiServiceUnavailableResponse({ type: ApiError })
@Controller('api/v1/manager')
export class ManagerSubscriptionsController {
  constructor(private readonly subscriptions: ManagerSubscriptionsService) {}
  @Get('students/:studentId/subscriptions')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({ operationId: 'listManagerSubscriptions' })
  @ApiOkResponse({ type: [ManagerSubscriptionDto] })
  async list(
    @Req() req: ManagerRequest,
    @Param('studentId') id: string,
  ): Promise<ManagerSubscriptionDto[]> {
    return unwrap(await this.subscriptions.list(req.managerCtx!, id));
  }
  @Post('students/:studentId/subscriptions')
  @ApiOperation({ operationId: 'createManagerSubscription' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiHeader({ name: 'X-CSRF-Token', required: true })
  @ApiCreatedResponse({ type: ManagerSubscriptionDto })
  @CriticalCommand({
    type: 'manager.subscription.create',
    resourceType: 'ManagerSubscription',
    topic: 'manager.subscription.command-created.v1',
    resultIdField: 'id',
    successStatus: 201,
    conflictOnPayloadMismatch: true,
  })
  async create(
    @Req() req: ManagerRequest,
    @Param('studentId') id: string,
    @Body() dto: CreateManagerSubscriptionDto,
    @CurrentTransaction() command: CriticalContext,
  ): Promise<ManagerSubscriptionDto> {
    return unwrap(await this.subscriptions.create(req.managerCtx!, id, dto, command));
  }
  @Post('subscriptions/:id/renew')
  @ApiOperation({ operationId: 'renewManagerSubscription' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiHeader({ name: 'X-CSRF-Token', required: true })
  @ApiOkResponse({ type: ManagerSubscriptionDto })
  @CriticalCommand({
    type: 'manager.subscription.renew',
    resourceType: 'ManagerSubscription',
    topic: 'manager.subscription.command-renewed.v1',
    resultIdField: 'id',
    successStatus: 200,
    conflictOnPayloadMismatch: true,
  })
  async renew(
    @Req() req: ManagerRequest,
    @Param('id') id: string,
    @Body() dto: RenewManagerSubscriptionDto,
    @CurrentTransaction() command: CriticalContext,
  ): Promise<ManagerSubscriptionDto> {
    return unwrap(await this.subscriptions.renew(req.managerCtx!, id, dto, command));
  }
  @Post('subscriptions/:id/freeze')
  @ApiOperation({ operationId: 'freezeManagerSubscription' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiHeader({ name: 'X-CSRF-Token', required: true })
  @ApiOkResponse({ type: ManagerSubscriptionDto })
  @CriticalCommand({
    type: 'manager.subscription.freeze',
    resourceType: 'ManagerSubscription',
    topic: 'manager.subscription.command-frozen.v1',
    resultIdField: 'id',
    successStatus: 200,
    conflictOnPayloadMismatch: true,
  })
  async freeze(
    @Req() req: ManagerRequest,
    @Param('id') id: string,
    @Body() dto: FreezeManagerSubscriptionDto,
    @CurrentTransaction() command: CriticalContext,
  ): Promise<ManagerSubscriptionDto> {
    return unwrap(await this.subscriptions.freeze(req.managerCtx!, id, dto, command));
  }
  @Post('subscriptions/:id/unfreeze')
  @ApiBody({
    required: false,
    schema: { type: 'object', additionalProperties: false, maxProperties: 0 },
  })
  @ApiOperation({ operationId: 'unfreezeManagerSubscription' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiHeader({ name: 'X-CSRF-Token', required: true })
  @ApiOkResponse({ type: ManagerSubscriptionDto })
  @CriticalCommand({
    type: 'manager.subscription.unfreeze',
    resourceType: 'ManagerSubscription',
    topic: 'manager.subscription.command-unfrozen.v1',
    resultIdField: 'id',
    successStatus: 200,
    conflictOnPayloadMismatch: true,
  })
  async unfreeze(
    @Req() req: ManagerRequest,
    @Param('id') id: string,
    @Body() _dto: UnfreezeManagerSubscriptionDto,
    @CurrentTransaction() command: CriticalContext,
  ): Promise<ManagerSubscriptionDto> {
    return unwrap(await this.subscriptions.unfreeze(req.managerCtx!, id, command));
  }
}
