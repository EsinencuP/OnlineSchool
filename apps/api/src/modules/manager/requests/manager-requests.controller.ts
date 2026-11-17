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
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { CriticalContext } from '../../../core/http.js';
import {
  CriticalCommand,
  CurrentTransaction,
} from '../../../core/idempotency/idempotency.module.js';
import { unwrap } from '../../../core/errors/domain-error.js';
import { ApiError } from '../../../openapi/dtos.js';
import type { ManagerRequest } from '../context/manager-context.js';
import { ManagerRoute } from '../guards/manager-route.decorator.js';
import {
  CreateRequestDto,
  ListRequestsQueryDto,
  ManagerRequestDto,
  ManagerRequestPageDto,
  WithdrawRequestDto,
} from './manager-requests.dto.js';
import { ManagerRequestsService } from './manager-requests.service.js';

const command = (type: string, status: 200 | 201 = 200) =>
  applyDecorators(
    Header('Cache-Control', 'private, no-store'),
    ApiHeader({
      name: 'Idempotency-Key',
      required: true,
      schema: { type: 'string', format: 'uuid' },
    }),
    ApiHeader({ name: 'X-CSRF-Token', required: true }),
    CriticalCommand({
      type: `manager.request.${type}`,
      resourceType: 'ManagerRequest',
      resultIdField: 'requestId',
      topic: `manager.request.${type}.v1`,
      successStatus: status,
      conflictOnPayloadMismatch: true,
    }),
  );

@ManagerRoute()
@Controller('api/v1/manager')
export class ManagerRequestsController {
  constructor(private readonly requests: ManagerRequestsService) {}

  @Get('requests')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    operationId: 'listManagerRequests',
    summary: 'Requests to the director for the own portfolio, newest first',
  })
  @ApiOkResponse({ type: ManagerRequestPageDto })
  @ApiUnprocessableEntityResponse({ type: ApiError, description: 'INVALID_CURSOR' })
  async list(@Req() r: ManagerRequest, @Query() q: ListRequestsQueryDto) {
    return unwrap(await this.requests.list(r.managerCtx!, q));
  }

  @Post('students/:studentId/requests')
  @ApiOperation({
    operationId: 'createManagerRequest',
    summary:
      'Formalise a family request for the director: temporary access (partial payment) or a refund calculation',
  })
  @ApiCreatedResponse({ type: ManagerRequestDto })
  @ApiNotFoundResponse({ type: ApiError, description: 'STUDENT_NOT_FOUND, SUBSCRIPTION_NOT_FOUND' })
  @ApiConflictResponse({ type: ApiError, description: 'REQUEST_ALREADY_PENDING' })
  @ApiUnprocessableEntityResponse({
    type: ApiError,
    description: 'FULLY_PAID_USES_NORMAL_ACCESS, NOTHING_TO_REFUND, INVALID_ACCESS_EXPIRY',
  })
  @command('create', 201)
  async create(
    @Req() r: ManagerRequest,
    @Param('studentId') studentId: string,
    @Body() dto: CreateRequestDto,
    @CurrentTransaction() c: CriticalContext,
  ) {
    return unwrap(await this.requests.create(r.managerCtx!, studentId, dto, c));
  }

  @Post('requests/:requestId/withdraw')
  @ApiOperation({
    operationId: 'withdrawManagerRequest',
    summary: 'Take back a request the director has not decided yet',
  })
  @ApiOkResponse({ type: ManagerRequestDto })
  @ApiNotFoundResponse({ type: ApiError, description: 'REQUEST_NOT_FOUND' })
  @ApiConflictResponse({ type: ApiError, description: 'REQUEST_NOT_PENDING' })
  @command('withdraw')
  async withdraw(
    @Req() r: ManagerRequest,
    @Param('requestId') requestId: string,
    @Body() dto: WithdrawRequestDto,
    @CurrentTransaction() c: CriticalContext,
  ) {
    return unwrap(await this.requests.withdraw(r.managerCtx!, requestId, dto.note, c));
  }
}
