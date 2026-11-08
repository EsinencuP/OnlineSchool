import {
  applyDecorators,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Post,
  Put,
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
  CancelManagerLessonDto,
  CreateManagerLessonDto,
  ListManagerScheduleDto,
  ManagerLessonDto,
  RescheduleManagerLessonDto,
  SetManagerMeetDto,
  EmptyManagerScheduleDto,
} from '../dto/manager-schedule.dto.js';
import { ManagerScheduleService } from './manager-schedule.service.js';
import { ManagerScheduleGuard } from './manager-schedule.guard.js';
const command = (type: string, status: 200 | 201 = 200) =>
  applyDecorators(
    ApiHeader({
      name: 'Idempotency-Key',
      required: true,
      schema: { type: 'string', format: 'uuid' },
    }),
    ApiHeader({ name: 'X-CSRF-Token', required: true }),
    CriticalCommand({
      type: `manager.schedule.${type}`,
      resourceType: 'LessonOccurrence',
      resultIdField: 'lessonId',
      topic: `manager.schedule.command-${type}.v1`,
      successStatus: status,
      conflictOnPayloadMismatch: true,
      errorCodeMap: { CALENDAR_CONFLICT: 'SLOT_CONFLICT' },
    }),
  );
@UseGuards(ManagerScheduleGuard)
@ManagerRoute()
@ApiBadRequestResponse({ type: ApiError })
@ApiNotFoundResponse({ type: ApiError, description: 'LESSON_NOT_FOUND, STUDENT_NOT_FOUND' })
@ApiConflictResponse({
  type: ApiError,
  description:
    'SLOT_CONFLICT, SUBSCRIPTION_NOT_ACTIVE, NO_LESSONS_REMAINING, LESSON_IMMUTABLE_STATE, LATE_RULE_OVERRIDE_REQUIRED',
})
@ApiUnprocessableEntityResponse({
  type: ApiError,
  description: 'RANGE_TOO_LARGE, LEAD_TIME_VIOLATION, INVALID_MEET_LINK, SUBSCRIPTION_REQUIRED',
})
@ApiServiceUnavailableResponse({ type: ApiError })
@Controller('api/v1/manager')
export class ManagerScheduleController {
  constructor(private readonly schedule: ManagerScheduleService) {}
  @Get('schedule')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({ operationId: 'listManagerSchedule' })
  @ApiOkResponse({ type: [ManagerLessonDto] })
  async list(
    @Req() r: ManagerRequest,
    @Query() q: ListManagerScheduleDto,
  ): Promise<ManagerLessonDto[]> {
    return unwrap(await this.schedule.list(r.managerCtx!, q));
  }
  @Post('students/:studentId/lessons')
  @ApiOperation({ operationId: 'createManagerLesson' })
  @ApiCreatedResponse({ type: ManagerLessonDto })
  @command('create', 201)
  async create(
    @Req() r: ManagerRequest,
    @Param('studentId') id: string,
    @Body() input: CreateManagerLessonDto,
    @CurrentTransaction() c: CriticalContext,
  ): Promise<ManagerLessonDto> {
    return { ...unwrap(await this.schedule.create(r.managerCtx!, id, input, c)), meetLink: null };
  }
  @Post('lessons/:lessonId/reschedule')
  @ApiOperation({
    operationId: 'rescheduleManagerLesson',
    description:
      'Late/student third changes request a specific director exception. Pending response leaves the lesson unchanged; re-submit after approval with a new command key.',
  })
  @ApiOkResponse({ type: ManagerLessonDto })
  @command('reschedule')
  async reschedule(
    @Req() r: ManagerRequest,
    @Param('lessonId') id: string,
    @Body() input: RescheduleManagerLessonDto,
    @CurrentTransaction() c: CriticalContext,
  ): Promise<ManagerLessonDto> {
    return {
      ...unwrap(await this.schedule.reschedule(r.managerCtx!, id, input, c)),
      meetLink: null,
    };
  }
  @Post('lessons/:lessonId/cancel')
  @ApiOperation({ operationId: 'cancelManagerLesson' })
  @ApiOkResponse({ type: ManagerLessonDto })
  @command('cancel')
  async cancel(
    @Req() r: ManagerRequest,
    @Param('lessonId') id: string,
    @Body() input: CancelManagerLessonDto,
    @CurrentTransaction() c: CriticalContext,
  ): Promise<ManagerLessonDto> {
    return { ...unwrap(await this.schedule.cancel(r.managerCtx!, id, input, c)), meetLink: null };
  }
  @Put('lessons/:lessonId/meet-link')
  @ApiOperation({ operationId: 'setManagerLessonMeetLink' })
  @ApiOkResponse({ type: ManagerLessonDto })
  @command('meet-set')
  async setMeet(
    @Req() r: ManagerRequest,
    @Param('lessonId') id: string,
    @Body() input: SetManagerMeetDto,
    @CurrentTransaction() c: CriticalContext,
  ): Promise<ManagerLessonDto> {
    return {
      ...unwrap(await this.schedule.setMeetLink(r.managerCtx!, id, input.url, c)),
      meetLink: null,
    };
  }
  @Delete('lessons/:lessonId/meet-link')
  @ApiOperation({ operationId: 'clearManagerLessonMeetLink' })
  @ApiOkResponse({ type: ManagerLessonDto })
  @ApiBody({
    required: false,
    schema: { type: 'object', additionalProperties: false, maxProperties: 0 },
  })
  @command('meet-clear')
  async clearMeet(
    @Req() r: ManagerRequest,
    @Param('lessonId') id: string,
    @Body() _input: EmptyManagerScheduleDto,
    @CurrentTransaction() c: CriticalContext,
  ): Promise<ManagerLessonDto> {
    return {
      ...unwrap(await this.schedule.setMeetLink(r.managerCtx!, id, null, c)),
      meetLink: null,
    };
  }
}
