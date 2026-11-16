import { applyDecorators, Body, Controller, Get, Param, Patch, Req } from '@nestjs/common';
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
import { TeacherStudentOverviewDto } from './dto/teacher-overview.dto.js';
import {
  TeacherProfileDto,
  UpdateTeacherProfileDto,
  UpdateTeacherProfileResponseDto,
} from './dto/teacher-profile.dto.js';
import { TeacherRoute } from './guards/teacher-route.decorator.js';
import { TeacherProfileService } from './teacher-profile.service.js';

@TeacherRoute()
@Controller('api/v1/teacher')
export class TeacherProfileController {
  constructor(private readonly profile: TeacherProfileService) {}

  @Get('profile')
  @ApiOperation({
    operationId: 'getTeacherProfile',
    summary: 'Own contact data and active passkeys (no credential material)',
  })
  @ApiOkResponse({ type: TeacherProfileDto })
  async get(@Req() req: TeacherRequest): Promise<TeacherProfileDto> {
    return unwrap(await this.profile.profile(req.teacherCtx!, req.account!));
  }

  @Patch('profile')
  @RequirePermission('education:teacher')
  @CriticalCommand({
    type: 'teacher.profile.update',
    resourceType: 'TeacherAccount',
    topic: 'teacher.profile.update.v1',
  })
  @applyDecorators(
    ApiHeader({
      name: 'Idempotency-Key',
      required: true,
      schema: { type: 'string', format: 'uuid' },
    }),
    ApiHeader({ name: 'X-CSRF-Token', required: true, schema: { type: 'string' } }),
  )
  @ApiOperation({
    operationId: 'updateTeacherProfile',
    summary: 'Change the own phone number (the only self-service contact field)',
  })
  @ApiBody({ type: UpdateTeacherProfileDto })
  @ApiOkResponse({ type: UpdateTeacherProfileResponseDto })
  async update(
    @CurrentTransaction() ctx: CriticalContext,
    @Body() body: UpdateTeacherProfileDto,
  ): Promise<unknown> {
    return serialize(await this.profile.updatePhone(ctx, body));
  }

  @Get('enrollments/:enrollmentId/overview')
  @ApiOperation({
    operationId: 'getTeacherStudentOverview',
    summary: 'Student card: progress counters, upcoming/recent lessons, homework, skills and goals',
  })
  @ApiParam({ name: 'enrollmentId', type: String, format: 'uuid' })
  @ApiOkResponse({ type: TeacherStudentOverviewDto })
  @ApiNotFoundResponse({ type: ApiError, description: 'Not found or not taught by this teacher' })
  async overview(
    @Req() req: TeacherRequest,
    @Param('enrollmentId') enrollmentId: string,
  ): Promise<TeacherStudentOverviewDto> {
    return unwrap(await this.profile.overview(req.teacherCtx!, enrollmentId));
  }
}
