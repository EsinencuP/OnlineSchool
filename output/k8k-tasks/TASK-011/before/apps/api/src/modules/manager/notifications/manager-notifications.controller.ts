import { Body, Controller, Get, Header, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiHeader,
  ApiResponse,
  ApiExtraModels,
} from '@nestjs/swagger';
import {
  CriticalCommand,
  CurrentTransaction,
} from '../../../core/idempotency/idempotency.module.js';
import type { CriticalContext } from '../../../core/http.js';
import { unwrap } from '../../../core/errors/domain-error.js';
import { ApiError } from '../../../openapi/dtos.js';
import type { ManagerRequest } from '../context/manager-context.js';
import { ManagerRoute } from '../guards/manager-route.decorator.js';
import { ManagerNotificationsService } from './manager-notifications.service.js';
import { ManagerNotificationsGuard } from './manager-notifications.guard.js';
import {
  ListManagerNotificationsDto,
  SendManagerNotificationDto,
  ManagerNotificationDto,
  ManagerNotificationPageDto,
} from '../dto/manager-notification.dto.js';
@UseGuards(ManagerNotificationsGuard)
@ManagerRoute()
@ApiExtraModels(ListManagerNotificationsDto)
@Controller('api/v1/manager/students/:studentId/notifications')
@ApiResponse({ status: 404, type: ApiError })
@ApiResponse({ status: 409, type: ApiError })
@ApiResponse({ status: 422, type: ApiError })
@ApiResponse({ status: 429, type: ApiError })
@ApiResponse({ status: 503, type: ApiError })
export class ManagerNotificationsController {
  constructor(private readonly notifications: ManagerNotificationsService) {}
  @Get()
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({ operationId: 'listManagerStudentNotifications' })
  @ApiOkResponse({ type: ManagerNotificationPageDto })
  async list(
    @Req() r: ManagerRequest,
    @Param('studentId') id: string,
    @Query() q: ListManagerNotificationsDto,
  ): Promise<ManagerNotificationPageDto> {
    return unwrap(await this.notifications.list(r.managerCtx!, id, q));
  }
  @Post()
  @ApiOperation({ operationId: 'sendManagerStudentNotification' })
  @ApiAcceptedResponse({ type: ManagerNotificationDto })
  @ApiHeader({ name: 'X-CSRF-Token', required: true })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', format: 'uuid' },
  })
  @CriticalCommand({
    type: 'manager.notification.send',
    resourceType: 'Student',
    topic: 'manager.notification.queued.v1',
    successStatus: 202,
    resultIdField: 'notificationId',
    conflictOnPayloadMismatch: true,
  })
  async send(
    @Req() r: ManagerRequest,
    @Param('studentId') id: string,
    @Body() body: SendManagerNotificationDto,
    @CurrentTransaction() c: CriticalContext,
  ): Promise<ManagerNotificationDto> {
    return unwrap(await this.notifications.send(r.managerCtx!, id, body, c));
  }
}
