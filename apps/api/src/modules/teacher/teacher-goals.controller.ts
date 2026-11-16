import { applyDecorators, Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import {
  ApiBody,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
} from '@nestjs/swagger';
import type { CriticalContext } from '../../core/http.js';
import { unwrap } from '../../core/errors/domain-error.js';
import { CriticalCommand, CurrentTransaction } from '../../core/idempotency/idempotency.module.js';
import { RequirePermission } from '../../core/rbac/decorators.js';
import { ApiError } from '../../openapi/dtos.js';
import { serialize } from '../finance/finance-common.js';
import type { TeacherRequest } from './context/teacher-context.js';
import {
  CreateGoalDto,
  GoalCommandResponseDto,
  TeacherGoalsResponseDto,
  UpdateGoalDto,
} from './dto/teacher-goals.dto.js';
import { TeacherRoute } from './guards/teacher-route.decorator.js';
import { TeacherGoalsService } from './teacher-goals.service.js';

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
@Controller('api/v1/teacher/enrollments/:enrollmentId/goals')
export class TeacherGoalsController {
  constructor(private readonly goals: TeacherGoalsService) {}

  @Get()
  @ApiOperation({ operationId: 'getTeacherGoals', summary: "A taught student's learning goals" })
  @ApiParam({ name: 'enrollmentId', type: String, format: 'uuid' })
  @ApiOkResponse({ type: TeacherGoalsResponseDto })
  @ApiNotFoundResponse({ type: ApiError, description: 'Not found or not taught by this teacher' })
  async list(
    @Req() req: TeacherRequest,
    @Param('enrollmentId') enrollmentId: string,
  ): Promise<TeacherGoalsResponseDto> {
    return unwrap(await this.goals.list(req.teacherCtx!, enrollmentId));
  }

  @Post()
  @RequirePermission('education:teacher')
  @CriticalCommand({
    type: 'teacher.goal.create',
    resourceType: 'LearningGoal',
    topic: 'teacher.goal.create.v1',
  })
  @commandHeaders()
  @ApiOperation({
    operationId: 'createTeacherGoal',
    summary: 'Set a learning goal for a taught student',
  })
  @ApiParam({ name: 'enrollmentId', type: String, format: 'uuid' })
  @ApiBody({ type: CreateGoalDto })
  @ApiOkResponse({ type: GoalCommandResponseDto })
  async create(
    @CurrentTransaction() ctx: CriticalContext,
    @Param('enrollmentId') enrollmentId: string,
    @Body() body: CreateGoalDto,
  ): Promise<unknown> {
    return serialize(await this.goals.create(ctx, enrollmentId, body));
  }

  @Patch(':goalId')
  @RequirePermission('education:teacher')
  @CriticalCommand({
    type: 'teacher.goal.update',
    resourceType: 'LearningGoal',
    topic: 'teacher.goal.update.v1',
  })
  @commandHeaders()
  @ApiOperation({
    operationId: 'updateTeacherGoal',
    summary: 'Edit a goal, mark it achieved, pause or archive it (history is kept by the database)',
  })
  @ApiParam({ name: 'enrollmentId', type: String, format: 'uuid' })
  @ApiParam({ name: 'goalId', type: String, format: 'uuid' })
  @ApiBody({ type: UpdateGoalDto })
  @ApiOkResponse({ type: GoalCommandResponseDto })
  async update(
    @CurrentTransaction() ctx: CriticalContext,
    @Param('enrollmentId') enrollmentId: string,
    @Param('goalId') goalId: string,
    @Body() body: UpdateGoalDto,
  ): Promise<unknown> {
    return serialize(await this.goals.update(ctx, enrollmentId, goalId, body));
  }
}
