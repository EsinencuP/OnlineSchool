import { applyDecorators, Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import {
  ApiBody,
  ApiConflictResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiServiceUnavailableResponse,
} from '@nestjs/swagger';
import type { CriticalContext } from '../../core/http.js';
import { unwrap } from '../../core/errors/domain-error.js';
import { CriticalCommand, CurrentTransaction } from '../../core/idempotency/idempotency.module.js';
import { RequirePermission } from '../../core/rbac/decorators.js';
import { ApiError } from '../../openapi/dtos.js';
import { serialize } from '../finance/finance-common.js';
import type { TeacherRequest } from './context/teacher-context.js';
import {
  AssessSkillDto,
  AssessSkillResponseDto,
  TeacherEnrollmentsResponseDto,
  TeacherSkillHistoryDto,
  TeacherSkillMapDto,
} from './dto/teacher-skills.dto.js';
import { TeacherRoute } from './guards/teacher-route.decorator.js';
import { TeacherSkillsService } from './teacher-skills.service.js';

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
@Controller('api/v1/teacher/enrollments')
export class TeacherSkillsController {
  constructor(private readonly skills: TeacherSkillsService) {}

  @Get()
  @ApiOperation({
    operationId: 'getTeacherEnrollments',
    summary: 'Active enrollments the teacher currently teaches (roster)',
  })
  @ApiOkResponse({ type: TeacherEnrollmentsResponseDto })
  @ApiServiceUnavailableResponse({ type: ApiError, description: 'Data store unavailable' })
  async roster(@Req() req: TeacherRequest): Promise<TeacherEnrollmentsResponseDto> {
    return unwrap(await this.skills.enrollments(req.teacherCtx!));
  }

  @Get(':enrollmentId/skills')
  @ApiOperation({
    operationId: 'getTeacherSkillMap',
    summary: "A taught student's skill map with current public statuses",
  })
  @ApiParam({ name: 'enrollmentId', type: String, format: 'uuid' })
  @ApiOkResponse({ type: TeacherSkillMapDto })
  @ApiNotFoundResponse({ type: ApiError, description: 'Not found or not taught by this teacher' })
  async map(
    @Req() req: TeacherRequest,
    @Param('enrollmentId') enrollmentId: string,
  ): Promise<TeacherSkillMapDto> {
    return unwrap(await this.skills.map(req.teacherCtx!, enrollmentId));
  }

  @Get(':enrollmentId/skills/:skillId/history')
  @ApiOperation({
    operationId: 'getTeacherSkillHistory',
    summary: 'Status changes of one skill, newest first (last 50)',
  })
  @ApiParam({ name: 'enrollmentId', type: String, format: 'uuid' })
  @ApiParam({ name: 'skillId', type: String, format: 'uuid' })
  @ApiOkResponse({ type: TeacherSkillHistoryDto })
  @ApiNotFoundResponse({ type: ApiError, description: 'Not found or not taught by this teacher' })
  async history(
    @Req() req: TeacherRequest,
    @Param('enrollmentId') enrollmentId: string,
    @Param('skillId') skillId: string,
  ): Promise<TeacherSkillHistoryDto> {
    return unwrap(await this.skills.history(req.teacherCtx!, enrollmentId, skillId));
  }

  @Post(':enrollmentId/skills/:skillId/assessments')
  @RequirePermission('education:teacher')
  @CriticalCommand({
    type: 'teacher.skill.assess',
    resourceType: 'SkillAssessment',
    topic: 'teacher.skill.assess.v1',
  })
  @commandHeaders()
  @ApiOperation({
    operationId: 'assessTeacherSkill',
    summary: 'Record a new level of a skill for a taught student',
  })
  @ApiParam({ name: 'enrollmentId', type: String, format: 'uuid' })
  @ApiParam({ name: 'skillId', type: String, format: 'uuid' })
  @ApiBody({ type: AssessSkillDto })
  @ApiOkResponse({ type: AssessSkillResponseDto })
  @ApiConflictResponse({
    type: ApiError,
    description: 'SKILL_LEVEL_UNCHANGED or concurrent change',
  })
  @ApiNotFoundResponse({ type: ApiError, description: 'Not found or not taught by this teacher' })
  async assess(
    @CurrentTransaction() ctx: CriticalContext,
    @Param('enrollmentId') enrollmentId: string,
    @Param('skillId') skillId: string,
    @Body() body: AssessSkillDto,
  ): Promise<unknown> {
    return serialize(await this.skills.assess(ctx, enrollmentId, skillId, body));
  }
}
