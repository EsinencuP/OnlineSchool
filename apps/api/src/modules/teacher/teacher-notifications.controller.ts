import { Body, Controller, Get, HttpCode, Post, Query, Req } from '@nestjs/common';
import {
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { unwrap } from '../../core/errors/domain-error.js';
import { ApiError } from '../../openapi/dtos.js';
import type { TeacherRequest } from './context/teacher-context.js';
import {
  MarkReadDto,
  MarkReadResponseDto,
  TeacherNotificationPageDto,
  TeacherNotificationsQueryDto,
  TeacherNotificationSummaryDto,
} from './dto/teacher-notifications.dto.js';
import { TeacherRoute } from './guards/teacher-route.decorator.js';
import { TeacherNotificationsService } from './teacher-notifications.service.js';

@TeacherRoute()
@Controller('api/v1/teacher/notifications')
export class TeacherNotificationsController {
  constructor(private readonly notifications: TeacherNotificationsService) {}

  @Get()
  @ApiOperation({
    operationId: 'getTeacherNotifications',
    summary: 'Work notifications of the last 90 days (lessons, homework, checkpoints, requests)',
  })
  @ApiOkResponse({ type: TeacherNotificationPageDto })
  @ApiUnprocessableEntityResponse({
    type: ApiError,
    description: 'INVALID_INPUT or INVALID_CURSOR',
  })
  @ApiServiceUnavailableResponse({ type: ApiError, description: 'Data store unavailable' })
  async list(
    @Req() req: TeacherRequest,
    @Query() query: TeacherNotificationsQueryDto,
  ): Promise<TeacherNotificationPageDto> {
    return unwrap(await this.notifications.list(req.teacherCtx!, query));
  }

  @Get('summary')
  @ApiOperation({
    operationId: 'getTeacherNotificationSummary',
    summary: 'Unread indicator for the notification bell',
  })
  @ApiOkResponse({ type: TeacherNotificationSummaryDto })
  async summary(@Req() req: TeacherRequest): Promise<TeacherNotificationSummaryDto> {
    return unwrap(await this.notifications.summary(req.teacherCtx!));
  }

  @Post('read')
  @HttpCode(200)
  @ApiOperation({ operationId: 'markTeacherNotificationsRead', summary: 'Mark listed events read' })
  @ApiBody({ type: MarkReadDto })
  @ApiOkResponse({ type: MarkReadResponseDto })
  async read(@Req() req: TeacherRequest, @Body() body: MarkReadDto): Promise<MarkReadResponseDto> {
    return unwrap(await this.notifications.markRead(req.teacherCtx!, body.keys));
  }

  @Post('read-all')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'markAllTeacherNotificationsRead',
    summary: 'Mark everything up to now read; later events stay unread',
  })
  @ApiOkResponse({ type: MarkReadResponseDto })
  async readAll(@Req() req: TeacherRequest): Promise<MarkReadResponseDto> {
    return unwrap(await this.notifications.markAllRead(req.teacherCtx!));
  }
}
