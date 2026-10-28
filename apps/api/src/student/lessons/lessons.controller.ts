import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBody,
  ApiCookieAuth,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CriticalCommand, CurrentTransaction } from '../../core/idempotency/idempotency.module.js';
import type { CriticalContext } from '../../core/http.js';
import { RequireRole } from '../../core/rbac/decorators.js';
import { domainError, fail, unwrap } from '../../core/errors/domain-error.js';
import { ProblemDetails } from '../../core/errors/error-mapper.js';
import { uuid } from '../../modules/identity/input.js';
import { StudentCtx } from '../student-context.decorator.js';
import type { IStudentContext } from '../student-context.interface.js';
import {
  LessonsQueryDto,
  LessonCardDto,
  LessonsResponseDto,
  RescheduleRequestDto,
  RescheduleRequestResponseDto,
} from './lessons.dto.js';
import { LessonsQueryPipe } from './lesson-period.js';
import type { ParsedLessonsQuery } from './lesson-period.js';
import { StudentLessonsService } from './lessons.service.js';
import { StudentLessonScopeGuard } from './student-lesson-scope.guard.js';

@ApiTags('Student')
@ApiCookieAuth('sessionCookie')
@RequireRole('STUDENT')
@ApiResponse({ status: 401, type: ProblemDetails })
@ApiResponse({ status: 402, type: ProblemDetails })
@ApiResponse({ status: 403, type: ProblemDetails })
@ApiResponse({ status: 400, type: ProblemDetails })
@ApiResponse({ status: 422, type: ProblemDetails })
@ApiResponse({ status: 503, type: ProblemDetails })
@Controller('api/v1/student/lessons')
export class StudentLessonsController {
  constructor(private readonly lessons: StudentLessonsService) {}
  @Get('upcoming')
  @ApiOperation({
    operationId: 'getStudentUpcomingLessons',
    summary: 'Next five owned scheduled lessons, including across month boundaries',
  })
  @ApiResponse({ status: 200, type: LessonsResponseDto })
  async upcoming(@StudentCtx() student: IStudentContext) {
    return unwrap(
      await this.lessons.list(student, { period: 'month', page: 1, pageSize: 5 }, undefined, true),
    );
  }
  @Get(':lessonId')
  @ApiOperation({
    operationId: 'getStudentLesson',
    summary: 'Read one owned lesson independently of its month',
  })
  @ApiParam({ name: 'lessonId', format: 'uuid', type: String })
  @ApiResponse({ status: 200, type: LessonCardDto })
  @ApiResponse({ status: 404, type: ProblemDetails })
  async detail(@StudentCtx() student: IStudentContext, @Param('lessonId') id: string) {
    const result = unwrap(
      await this.lessons.list(student, { period: 'month', page: 1, pageSize: 1 }, uuid(id)),
    );
    return result.items[0] ?? fail(domainError('LESSON_NOT_FOUND', 404));
  }
  @Get()
  @ApiOperation({
    operationId: 'getStudentLessons',
    summary: 'Student lesson list or monthly calendar',
    description:
      'Student timezone, ISO Monday-start week, stable pagination. month=YYYY-MM returns an unpaginated calendar capped at 62; overflow is an explicit 422. Unresolved CRM statuses remain explicit.',
  })
  @ApiResponse({ status: 200, type: LessonsResponseDto })
  async list(
    @StudentCtx() student: IStudentContext,
    @Query(LessonsQueryPipe) query: LessonsQueryDto,
  ): Promise<LessonsResponseDto> {
    return unwrap(await this.lessons.list(student, query as ParsedLessonsQuery));
  }
  @Post(':lessonId/reschedule-request')
  @HttpCode(201)
  @UseGuards(StudentLessonScopeGuard)
  @ApiOperation({
    operationId: 'requestStudentLessonReschedule',
    summary: 'Ask the assigned manager to reschedule a particular lesson',
    description:
      'Creates one CRM task/audit/outbox atomically; does not move the lesson. Requires >=24 exact hours and revalidates ownership/access inside the transaction.',
  })
  @ApiParam({ name: 'lessonId', format: 'uuid', type: String })
  @ApiBody({ type: RescheduleRequestDto })
  @ApiHeader({ name: 'X-CSRF-Token', required: true })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiResponse({ status: 201, type: RescheduleRequestResponseDto })
  @CriticalCommand({
    type: 'student.lesson.reschedule-request',
    resourceType: 'CrmTask',
    topic: 'student.lesson.reschedule-requested.v1',
    successStatus: 201,
    resultIdField: 'crmTaskId',
  })
  async request(
    @CurrentTransaction() ctx: CriticalContext,
    @StudentCtx() student: IStudentContext,
    @Param('lessonId') id: string,
    @Body() body: RescheduleRequestDto,
  ): Promise<RescheduleRequestResponseDto> {
    return this.lessons.request(ctx, student, uuid(id), body);
  }
}
