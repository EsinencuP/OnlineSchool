import {
  Body,
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Res,
  UseGuards,
  Injectable,
  HttpCode,
} from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { ApiCookieAuth, ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RequireRole } from '../../core/rbac/decorators.js';
import { CriticalCommand, CurrentTransaction } from '../../core/idempotency/idempotency.module.js';
import type { CriticalContext, HttpRequest, HttpResponse } from '../../core/http.js';
import { ProblemDetails } from '../../core/errors/error-mapper.js';
import { uuid } from '../../modules/identity/input.js';
import { StudentCtx } from '../student-context.decorator.js';
import type { IStudentContext } from '../student-context.interface.js';
import type { HistoryPage } from '../history/history.dto.js';
import {
  NotificationsQueryDto,
  NotificationsQueryPipe,
  NotificationsResponseDto,
  UnreadCountDto,
} from './notifications.dto.js';
import { StudentNotificationsService } from './notifications.service.js';
@Injectable()
export class NotificationReadResponseGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<HttpRequest>(),
      res = context.switchToHttp().getResponse<HttpResponse>();
    req.afterCriticalCommit = async () => {
      res.status(204);
      res.end();
      return undefined;
    };
    return true;
  }
}
@ApiTags('Student')
@ApiCookieAuth('sessionCookie')
@RequireRole('STUDENT')
@ApiResponse({ status: 400, type: ProblemDetails })
@ApiResponse({ status: 401, type: ProblemDetails })
@ApiResponse({ status: 402, type: ProblemDetails })
@ApiResponse({ status: 403, type: ProblemDetails })
@Controller('api/v1/student/notifications')
export class StudentNotificationsController {
  constructor(private readonly notifications: StudentNotificationsService) {}
  @Get()
  @ApiOperation({
    operationId: 'getStudentNotifications',
    summary: 'Read own recent internal notifications',
    description:
      'Newest first; default30, max100. Last500 active items,90-day TTL, one shared read status. Group by returned type in the client.',
  })
  @ApiResponse({ status: 200, type: NotificationsResponseDto })
  list(
    @StudentCtx() student: IStudentContext,
    @Query(NotificationsQueryPipe) query: NotificationsQueryDto,
  ) {
    return this.notifications.list(student, query as HistoryPage);
  }
  @Get('count')
  @ApiOperation({
    operationId: 'getStudentUnreadNotificationCount',
    summary: 'Count own unread notifications without loading bodies',
  })
  @ApiResponse({ status: 200, type: UnreadCountDto })
  count(@StudentCtx() student: IStudentContext) {
    return this.notifications.count(student);
  }
  @Post('read-all')
  @HttpCode(204)
  @UseGuards(NotificationReadResponseGuard)
  @ApiOperation({
    operationId: 'markAllStudentNotificationsRead',
    summary: 'Mark all currently visible notifications read',
    description:
      'Empty response204 including replay. CSRF and UUID Idempotency-Key required. Notifications arriving after this operation remain unread.',
  })
  @ApiHeader({ name: 'X-CSRF-Token', required: true })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiResponse({ status: 204, description: 'Current notifications marked read' })
  @CriticalCommand({
    type: 'student.notifications.read-all',
    topic: 'student.notifications.read-all.v1',
    resourceType: 'Student',
    resultIdField: 'studentProfileId',
    successStatus: 200,
  })
  async readAll(
    @CurrentTransaction() ctx: CriticalContext,
    @StudentCtx() student: IStudentContext,
    @Body() body: unknown,
    @Res() res: HttpResponse,
  ) {
    res.setHeader('Cache-Control', 'no-store');
    await this.notifications.markRead(ctx, student, null, body);
    return { studentProfileId: student.studentProfileId };
  }
  @Patch(':id/read')
  @HttpCode(204)
  @UseGuards(NotificationReadResponseGuard)
  @ApiOperation({
    operationId: 'markStudentNotificationRead',
    summary: 'Mark one own notification read',
    description:
      'Idempotent204, nonexistent/foreign/archived id404. CSRF and UUID Idempotency-Key required.',
  })
  @ApiHeader({ name: 'X-CSRF-Token', required: true })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiResponse({ status: 204, description: 'Notification marked read' })
  @ApiResponse({ status: 404, type: ProblemDetails })
  @CriticalCommand({
    type: 'student.notifications.read',
    topic: 'student.notifications.read.v1',
    resourceType: 'StudentNotification',
    resultIdField: 'notificationId',
    successStatus: 200,
  })
  async read(
    @CurrentTransaction() ctx: CriticalContext,
    @StudentCtx() student: IStudentContext,
    @Param('id') raw: string,
    @Body() body: unknown,
    @Res() res: HttpResponse,
  ) {
    res.setHeader('Cache-Control', 'no-store');
    const id = uuid(raw);
    await this.notifications.markRead(ctx, student, id, body);
    return { notificationId: id };
  }
}
