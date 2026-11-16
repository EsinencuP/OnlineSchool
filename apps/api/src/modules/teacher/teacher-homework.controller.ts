import { applyDecorators, Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import {
  ApiBody,
  ApiConflictResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiServiceUnavailableResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { CriticalContext } from '../../core/http.js';
import { unwrap } from '../../core/errors/domain-error.js';
import { CriticalCommand, CurrentTransaction } from '../../core/idempotency/idempotency.module.js';
import { RequirePermission } from '../../core/rbac/decorators.js';
import { ApiError } from '../../openapi/dtos.js';
import { serialize } from '../finance/finance-common.js';
import type { TeacherRequest } from './context/teacher-context.js';
import {
  IssueHomeworkDto,
  IssueHomeworkResponseDto,
  ReviewHomeworkDto,
  ReviewHomeworkResponseDto,
  TeacherHomeworkCardDto,
  TeacherHomeworkPageDto,
  TeacherHomeworkQueryDto,
} from './dto/teacher-homework.dto.js';
import { TeacherRoute } from './guards/teacher-route.decorator.js';
import { TeacherHomeworkService } from './teacher-homework.service.js';

const commandHeaders = () =>
  applyDecorators(
    ApiHeader({
      name: 'Idempotency-Key',
      required: true,
      schema: { type: 'string', format: 'uuid' },
    }),
    ApiHeader({ name: 'X-CSRF-Token', required: true, schema: { type: 'string' } }),
  );

@TeacherRoute()
@Controller('api/v1/teacher/homework')
export class TeacherHomeworkController {
  constructor(private readonly homework: TeacherHomeworkService) {}

  @Get()
  @ApiOperation({
    operationId: 'getTeacherHomework',
    summary: 'Homework the teacher issued; state=AWAITING_REVIEW is the review queue',
  })
  @ApiOkResponse({ type: TeacherHomeworkPageDto })
  @ApiUnprocessableEntityResponse({
    type: ApiError,
    description: 'INVALID_INPUT or INVALID_CURSOR',
  })
  @ApiServiceUnavailableResponse({ type: ApiError, description: 'Data store unavailable' })
  async list(
    @Req() req: TeacherRequest,
    @Query() query: TeacherHomeworkQueryDto,
  ): Promise<TeacherHomeworkPageDto> {
    return unwrap(await this.homework.list(req.teacherCtx!, query));
  }

  @Get(':deliveryId')
  @ApiOperation({
    operationId: 'getTeacherHomeworkCard',
    summary: 'One issued homework with submission versions and reviews',
  })
  @ApiParam({ name: 'deliveryId', type: String, format: 'uuid' })
  @ApiOkResponse({ type: TeacherHomeworkCardDto })
  @ApiNotFoundResponse({ type: ApiError, description: 'Not found or issued by another teacher' })
  async card(
    @Req() req: TeacherRequest,
    @Param('deliveryId') deliveryId: string,
  ): Promise<TeacherHomeworkCardDto> {
    return unwrap(await this.homework.card(req.teacherCtx!, deliveryId));
  }

  @Post()
  @RequirePermission('education:teacher')
  @CriticalCommand({
    type: 'teacher.homework.issue',
    resourceType: 'HomeworkAssignment',
    topic: 'teacher.homework.issue.v1',
  })
  @commandHeaders()
  @ApiOperation({
    operationId: 'issueTeacherHomework',
    summary: 'Issue homework to assigned students (one delivery per enrollment)',
  })
  @ApiBody({ type: IssueHomeworkDto })
  @ApiOkResponse({ type: IssueHomeworkResponseDto })
  @ApiUnprocessableEntityResponse({ type: ApiError, description: 'Validation or subject/due rule' })
  async issue(
    @CurrentTransaction() ctx: CriticalContext,
    @Body() body: IssueHomeworkDto,
  ): Promise<unknown> {
    return serialize(await this.homework.issue(ctx, body));
  }

  @Post(':deliveryId/review')
  @RequirePermission('education:teacher')
  @CriticalCommand({
    type: 'teacher.homework.review',
    resourceType: 'SubmissionReview',
    topic: 'teacher.homework.review.v1',
  })
  @commandHeaders()
  @ApiOperation({
    operationId: 'reviewTeacherHomework',
    summary: 'Accept or return the latest submission of an issued homework',
  })
  @ApiParam({ name: 'deliveryId', type: String, format: 'uuid' })
  @ApiBody({ type: ReviewHomeworkDto })
  @ApiOkResponse({ type: ReviewHomeworkResponseDto })
  @ApiConflictResponse({ type: ApiError, description: 'Stale submission or already reviewed' })
  @ApiNotFoundResponse({ type: ApiError, description: 'Not found or issued by another teacher' })
  async review(
    @CurrentTransaction() ctx: CriticalContext,
    @Param('deliveryId') deliveryId: string,
    @Body() body: ReviewHomeworkDto,
  ): Promise<unknown> {
    return serialize(await this.homework.review(ctx, deliveryId, body));
  }
}
