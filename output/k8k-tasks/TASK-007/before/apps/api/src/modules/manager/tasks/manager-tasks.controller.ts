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
  ApiConflictResponse,
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
  ClaimManagerTaskDto,
  ListManagerTasksDto,
  ManagerTaskDetailDto,
  ManagerTaskDto,
  ManagerTaskPageDto,
  ResolveManagerDisputeDto,
  ResolveManagerRescheduleDto,
} from '../dto/manager-task.dto.js';
import { ManagerTasksService } from './manager-tasks.service.js';
import { ManagerTasksGuard } from './manager-tasks.guard.js';
const command = (kind: string) =>
  applyDecorators(
    ApiHeader({
      name: 'Idempotency-Key',
      required: true,
      schema: { type: 'string', format: 'uuid' },
    }),
    ApiHeader({ name: 'X-CSRF-Token', required: true }),
    CriticalCommand({
      type: `manager.task.${kind}`,
      resourceType: 'CrmTask',
      topic: `manager.task.command-${kind}.v1`,
      resultIdField: 'taskId',
      conflictOnPayloadMismatch: true,
      errorCodeMap: { CALENDAR_CONFLICT: 'SLOT_CONFLICT' },
    }),
  );
@UseGuards(ManagerTasksGuard)
@ManagerRoute()
@ApiBadRequestResponse({ type: ApiError })
@ApiNotFoundResponse({ type: ApiError, description: 'TASK_NOT_FOUND' })
@ApiConflictResponse({
  type: ApiError,
  description:
    'TASK_ALREADY_RESOLVED, TASK_VERSION_CONFLICT, TASK_TYPE_MISMATCH, TASK_NOT_IN_PROGRESS, SLOT_CONFLICT, DISPUTE_REFUND_EXCEEDS_CHARGE',
})
@ApiUnprocessableEntityResponse({
  type: ApiError,
  description: 'REFUND_REQUIRED, INVALID_CURSOR, INVALID_INPUT',
})
@ApiServiceUnavailableResponse({ type: ApiError })
@Controller('api/v1/manager/tasks')
export class ManagerTasksController {
  constructor(private readonly tasks: ManagerTasksService) {}
  @Get()
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({ operationId: 'listManagerTasks' })
  @ApiOkResponse({ type: ManagerTaskPageDto })
  async list(
    @Req() r: ManagerRequest,
    @Query() q: ListManagerTasksDto,
  ): Promise<ManagerTaskPageDto> {
    return unwrap(await this.tasks.list(r.managerCtx!, q));
  }
  @Get(':taskId')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({ operationId: 'getManagerTask' })
  @ApiOkResponse({ type: ManagerTaskDetailDto })
  async get(@Req() r: ManagerRequest, @Param('taskId') id: string): Promise<ManagerTaskDetailDto> {
    return unwrap(await this.tasks.get(r.managerCtx!, id));
  }
  @Post(':taskId/claim')
  @ApiOperation({ operationId: 'claimManagerTask' })
  @ApiOkResponse({ type: ManagerTaskDto })
  @command('claim')
  async claim(
    @Req() r: ManagerRequest,
    @Param('taskId') id: string,
    @Body() body: ClaimManagerTaskDto,
    @CurrentTransaction() c: CriticalContext,
  ): Promise<ManagerTaskDto> {
    return unwrap(await this.tasks.claim(r.managerCtx!, id, body.version, c));
  }
  @Post(':taskId/resolve-reschedule')
  @ApiOperation({
    operationId: 'resolveManagerTaskReschedule',
    description:
      'A pending director schedule exception keeps the task IN_PROGRESS. Retry after approval using current task version and a new command key.',
  })
  @ApiOkResponse({ type: ManagerTaskDto })
  @command('reschedule')
  async reschedule(
    @Req() r: ManagerRequest,
    @Param('taskId') id: string,
    @Body() body: ResolveManagerRescheduleDto,
    @CurrentTransaction() c: CriticalContext,
  ): Promise<ManagerTaskDto> {
    return unwrap(await this.tasks.resolveReschedule(r.managerCtx!, id, body, c));
  }
  @Post(':taskId/resolve-dispute')
  @ApiOperation({
    operationId: 'resolveManagerTaskDispute',
    description:
      'ACCEPT proposes a bounded Finance correction. Full reversal requires director execution; partial requests remain in manual review. No cash payout.',
  })
  @ApiOkResponse({ type: ManagerTaskDto })
  @command('dispute')
  async dispute(
    @Req() r: ManagerRequest,
    @Param('taskId') id: string,
    @Body() body: ResolveManagerDisputeDto,
    @CurrentTransaction() c: CriticalContext,
  ): Promise<ManagerTaskDto> {
    return unwrap(await this.tasks.resolveDispute(r.managerCtx!, id, body, c));
  }
}
