import { Body, Controller, Get, Header, Param, Post } from '@nestjs/common';
import { ApiHeader, ApiOkResponse, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import type { CriticalContext } from '../../core/http.js';
import { CriticalCommand, CurrentTransaction } from '../../core/idempotency/idempotency.module.js';
import { RequireVerifiedMfa } from '../../core/rbac/decorators.js';
import { ApiError } from '../../openapi/dtos.js';
import { DirectorLessonDisputeService } from './director-lesson-dispute.service.js';
import {
  LessonDisputeDecisionDto,
  LessonDisputeReviewDto,
  ResolveLessonDisputeDto,
} from './dto/director-lesson-dispute.dto.js';
import { DirectorRoute } from './guards/director-route.decorator.js';

@DirectorRoute()
@RequireVerifiedMfa()
@Controller('api/v1/director/lessons/:id/outcome-dispute')
export class DirectorLessonDisputeController {
  constructor(private readonly disputes: DirectorLessonDisputeService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOperation({
    operationId: 'getDirectorLessonOutcomeDispute',
    summary: 'Review the confirmed disputed report and any later director decision',
  })
  @ApiOkResponse({ type: LessonDisputeReviewDto })
  @ApiResponse({ status: 404, type: ApiError, description: 'LESSON_DISPUTE_NOT_FOUND' })
  async review(@Param('id') id: string) {
    return this.disputes.review(id);
  }

  @Post('resolve')
  @Header('Cache-Control', 'private, no-store')
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @CriticalCommand({
    type: 'director.lesson-outcome-dispute.resolve',
    resourceType: 'LessonOutcomeDisputeDecision',
    topic: 'director.lesson-outcome-dispute.resolved.v1',
    conflictOnPayloadMismatch: true,
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiHeader({ name: 'X-CSRF-Token', required: true })
  @ApiOperation({
    operationId: 'resolveDirectorLessonOutcomeDispute',
    summary: 'Record the evidenced lesson result. Payroll remains a separate decision.',
  })
  @ApiOkResponse({ type: LessonDisputeDecisionDto })
  @ApiResponse({ status: 404, type: ApiError, description: 'LESSON_DISPUTE_NOT_FOUND' })
  @ApiResponse({
    status: 409,
    type: ApiError,
    description: 'LESSON_DISPUTE_ALREADY_RESOLVED or LESSON_DISPUTE_REPORT_CHANGED',
  })
  @ApiResponse({
    status: 422,
    type: ApiError,
    description: 'Insufficient or inconsistent evidence',
  })
  async resolve(
    @Param('id') id: string,
    @Body() body: ResolveLessonDisputeDto,
    @CurrentTransaction() ctx: CriticalContext,
  ) {
    return this.disputes.resolve(ctx, id, body);
  }
}
