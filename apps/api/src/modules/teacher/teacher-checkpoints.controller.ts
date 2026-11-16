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
  CompleteCheckpointDto,
  CompleteCheckpointResponseDto,
  PublishReportResponseDto,
  SaveReportDto,
  SaveReportResponseDto,
  TeacherCheckpointCardDto,
  TeacherCheckpointPageDto,
  TeacherCheckpointsQueryDto,
} from './dto/teacher-checkpoints.dto.js';
import { TeacherRoute } from './guards/teacher-route.decorator.js';
import { TeacherCheckpointsService } from './teacher-checkpoints.service.js';

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
@Controller('api/v1/teacher/checkpoints')
export class TeacherCheckpointsController {
  constructor(private readonly checkpoints: TeacherCheckpointsService) {}

  @Get()
  @ApiOperation({
    operationId: 'getTeacherCheckpoints',
    summary: 'Skill reviews (4 lessons) and education reports (8 lessons) of taught students',
  })
  @ApiOkResponse({ type: TeacherCheckpointPageDto })
  @ApiUnprocessableEntityResponse({
    type: ApiError,
    description: 'INVALID_INPUT or INVALID_CURSOR',
  })
  @ApiServiceUnavailableResponse({ type: ApiError, description: 'Data store unavailable' })
  async list(
    @Req() req: TeacherRequest,
    @Query() query: TeacherCheckpointsQueryDto,
  ): Promise<TeacherCheckpointPageDto> {
    return unwrap(await this.checkpoints.list(req.teacherCtx!, query));
  }

  @Get(':checkpointId')
  @ApiOperation({
    operationId: 'getTeacherCheckpoint',
    summary: 'One checkpoint with its summary, frozen snapshot and report draft',
  })
  @ApiParam({ name: 'checkpointId', type: String, format: 'uuid' })
  @ApiOkResponse({ type: TeacherCheckpointCardDto })
  @ApiNotFoundResponse({ type: ApiError, description: 'Not found or not taught by this teacher' })
  async card(
    @Req() req: TeacherRequest,
    @Param('checkpointId') id: string,
  ): Promise<TeacherCheckpointCardDto> {
    return unwrap(await this.checkpoints.card(req.teacherCtx!, id));
  }

  @Post(':checkpointId/complete')
  @RequirePermission('education:teacher')
  @CriticalCommand({
    type: 'teacher.checkpoint.complete',
    resourceType: 'ProgressCheckpoint',
    topic: 'teacher.checkpoint.complete.v1',
  })
  @commandHeaders()
  @ApiOperation({
    operationId: 'completeTeacherCheckpoint',
    summary: 'Finish a 4-lesson skill review; freezes the skill snapshot the student sees',
  })
  @ApiParam({ name: 'checkpointId', type: String, format: 'uuid' })
  @ApiBody({ type: CompleteCheckpointDto })
  @ApiOkResponse({ type: CompleteCheckpointResponseDto })
  @ApiConflictResponse({
    type: ApiError,
    description: 'Already completed or not a LESSON_4 checkpoint',
  })
  async complete(
    @CurrentTransaction() ctx: CriticalContext,
    @Param('checkpointId') id: string,
    @Body() body: CompleteCheckpointDto,
  ): Promise<unknown> {
    return serialize(await this.checkpoints.complete(ctx, id, body));
  }

  @Post(':checkpointId/report')
  @RequirePermission('education:teacher')
  @CriticalCommand({
    type: 'teacher.report.save',
    resourceType: 'EducationReport',
    topic: 'teacher.report.save.v1',
  })
  @commandHeaders()
  @ApiOperation({
    operationId: 'saveTeacherReportDraft',
    summary: 'Create or update the draft education report of an 8-lesson checkpoint',
  })
  @ApiParam({ name: 'checkpointId', type: String, format: 'uuid' })
  @ApiBody({ type: SaveReportDto })
  @ApiOkResponse({ type: SaveReportResponseDto })
  @ApiConflictResponse({ type: ApiError, description: 'Published, other author or no report here' })
  async saveReport(
    @CurrentTransaction() ctx: CriticalContext,
    @Param('checkpointId') id: string,
    @Body() body: SaveReportDto,
  ): Promise<unknown> {
    return serialize(await this.checkpoints.saveReport(ctx, id, body));
  }

  @Post(':checkpointId/report/publish')
  @RequirePermission('education:teacher')
  @CriticalCommand({
    type: 'teacher.report.publish',
    resourceType: 'EducationReport',
    topic: 'teacher.report.publish.v1',
  })
  @commandHeaders()
  @ApiOperation({
    operationId: 'publishTeacherReport',
    summary: 'Publish the draft report to the student (immutable afterwards)',
  })
  @ApiParam({ name: 'checkpointId', type: String, format: 'uuid' })
  @ApiOkResponse({ type: PublishReportResponseDto })
  @ApiConflictResponse({
    type: ApiError,
    description: 'No draft, already published or other author',
  })
  async publishReport(
    @CurrentTransaction() ctx: CriticalContext,
    @Param('checkpointId') id: string,
  ): Promise<unknown> {
    return serialize(await this.checkpoints.publishReport(ctx, id));
  }
}
