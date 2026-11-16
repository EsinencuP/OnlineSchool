import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { unwrap } from '../../core/errors/domain-error.js';
import { ApiError } from '../../openapi/dtos.js';
import type { TeacherRequest } from './context/teacher-context.js';
import {
  TeacherMeResponseDto,
  TeacherTodayQueryDto,
  TeacherTodayResponseDto,
} from './dto/teacher.dto.js';
import {
  TeacherJournalPageDto,
  TeacherJournalQueryDto,
  TeacherLessonCardDto,
} from './dto/teacher-journal.dto.js';
import {
  TeacherAvailabilityQueryDto,
  TeacherAvailabilityResponseDto,
  TeacherRequestsQueryDto,
  TeacherScheduleRequestPageDto,
} from './dto/teacher-availability.dto.js';
import { TeacherAvailabilityService } from './teacher-availability.service.js';
import { TeacherJournalService } from './teacher-journal.service.js';
import { TeacherRoute } from './guards/teacher-route.decorator.js';
import { TeacherService } from './teacher.service.js';

@TeacherRoute()
@Controller('api/v1/teacher')
export class TeacherController {
  constructor(
    private readonly teacher: TeacherService,
    private readonly journal: TeacherJournalService,
    private readonly availability: TeacherAvailabilityService,
  ) {}

  @Get('me')
  @ApiOperation({ operationId: 'getTeacherMe', summary: 'Current teacher profile' })
  @ApiOkResponse({ type: TeacherMeResponseDto })
  @ApiServiceUnavailableResponse({ type: ApiError, description: 'Data store unavailable' })
  async me(@Req() req: TeacherRequest): Promise<TeacherMeResponseDto> {
    return unwrap(await this.teacher.me(req.teacherCtx!, req.account!));
  }

  @Get('today')
  @ApiOperation({
    operationId: 'getTeacherToday',
    summary: "The teacher's own lessons for one school-timezone calendar day",
  })
  @ApiOkResponse({ type: TeacherTodayResponseDto })
  @ApiUnprocessableEntityResponse({ type: ApiError, description: 'INVALID_INPUT or INVALID_DATE' })
  @ApiServiceUnavailableResponse({ type: ApiError, description: 'Data store unavailable' })
  async today(
    @Req() req: TeacherRequest,
    @Query() query: TeacherTodayQueryDto,
  ): Promise<TeacherTodayResponseDto> {
    return unwrap(await this.teacher.today(req.teacherCtx!, req.account!, query.date));
  }

  @Get('journal')
  @ApiOperation({
    operationId: 'getTeacherJournal',
    summary: "The teacher's ended lessons with their outcome-report state, newest first",
  })
  @ApiOkResponse({ type: TeacherJournalPageDto })
  @ApiUnprocessableEntityResponse({
    type: ApiError,
    description: 'INVALID_INPUT or INVALID_CURSOR',
  })
  @ApiServiceUnavailableResponse({ type: ApiError, description: 'Data store unavailable' })
  async journalPage(
    @Req() req: TeacherRequest,
    @Query() query: TeacherJournalQueryDto,
  ): Promise<TeacherJournalPageDto> {
    return unwrap(await this.journal.list(req.teacherCtx!, query));
  }

  @Get('lessons/:id')
  @ApiOperation({
    operationId: 'getTeacherLesson',
    summary: 'Own lesson card with report history and the confirmed outcome',
  })
  @ApiOkResponse({ type: TeacherLessonCardDto })
  @ApiNotFoundResponse({ type: ApiError, description: 'Not found or not the teacher’s lesson' })
  @ApiServiceUnavailableResponse({ type: ApiError, description: 'Data store unavailable' })
  async lesson(@Req() req: TeacherRequest, @Param('id') id: string): Promise<TeacherLessonCardDto> {
    return unwrap(await this.journal.card(req.teacherCtx!, id));
  }

  @Get('availability')
  @ApiOperation({
    operationId: 'getTeacherAvailability',
    summary: "The teacher's own availability windows with an occupied flag",
  })
  @ApiOkResponse({ type: TeacherAvailabilityResponseDto })
  @ApiUnprocessableEntityResponse({ type: ApiError, description: 'INVALID_INPUT or INVALID_RANGE' })
  @ApiServiceUnavailableResponse({ type: ApiError, description: 'Data store unavailable' })
  async availabilityWindows(
    @Req() req: TeacherRequest,
    @Query() query: TeacherAvailabilityQueryDto,
  ): Promise<TeacherAvailabilityResponseDto> {
    return unwrap(await this.availability.windows(req.teacherCtx!, query));
  }

  @Get('schedule-requests')
  @ApiOperation({
    operationId: 'getTeacherScheduleRequests',
    summary: 'Schedule change requests the teacher sent to the manager, newest first',
  })
  @ApiOkResponse({ type: TeacherScheduleRequestPageDto })
  @ApiUnprocessableEntityResponse({
    type: ApiError,
    description: 'INVALID_INPUT or INVALID_CURSOR',
  })
  @ApiServiceUnavailableResponse({ type: ApiError, description: 'Data store unavailable' })
  async scheduleRequests(
    @Req() req: TeacherRequest,
    @Query() query: TeacherRequestsQueryDto,
  ): Promise<TeacherScheduleRequestPageDto> {
    return unwrap(await this.availability.requests(req.teacherCtx!, query));
  }
}
