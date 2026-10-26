import * as ApiDto from '../../openapi/dtos.js';
import {
  ApiBody,
  ApiCookieAuth,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Body, Controller, Delete, Param, Patch, Post, UseGuards } from '@nestjs/common';
import type { CriticalContext } from '../../core/http.js';
import { CriticalCommand, CurrentTransaction } from '../../core/idempotency/idempotency.module.js';
import { RequireMfa, RequirePermission, RequireRole } from '../../core/rbac/decorators.js';
import { serialize } from '../finance/finance-common.js';
import { ScheduleRegistry } from './registry.service.js';
import { BookingService } from './booking.service.js';
import { OutcomesService } from './outcomes.service.js';
import { ScheduleScopeGuard } from './schedule-scope.guard.js';

@Controller('api/v1')
@RequireMfa()
@RequireRole('DIRECTOR', 'MANAGER')
@UseGuards(ScheduleScopeGuard)
export class ScheduleController {
  constructor(
    private readonly registry: ScheduleRegistry,
    private readonly booking: BookingService,
    private readonly outcomes: OutcomesService,
  ) {}
  @ApiOperation({
    operationId: 'createSubject',
    summary: 'Create subject',
    description: 'MFA required. MANAGER/DIRECTOR; creates catalog subject, no account or rights.',
  })
  @ApiResponse({
    status: 200,
    type: ApiDto.SubjectResponse,
    description: 'Successful response',
    headers: { 'X-Request-ID': { schema: { type: 'string', format: 'uuid' } } },
  })
  @ApiResponse({ status: 400, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 401, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 403, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 409, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 422, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 503, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', format: 'uuid' },
    description: 'Required for critical business commands; reuse only for identical payload',
  })
  @ApiHeader({ name: 'X-Request-ID', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({ name: 'X-CSRF-Token', required: true, schema: { type: 'string' } })
  @ApiCookieAuth('sessionCookie')
  @ApiBody({ type: ApiDto.SubjectCreateRequest, required: true })
  @ApiTags('Schedule')
  @Post('subjects')
  @RequirePermission('schedule:manage')
  @CriticalCommand({
    type: 'schedule.subject.create',
    resourceType: 'Subject',
    topic: 'schedule.subject.create.v1',
  })
  async subject(
    @CurrentTransaction() ctx: CriticalContext,
    @Body() body: ApiDto.SubjectCreateRequest,
  ) {
    return serialize(await this.registry.subject(ctx, body));
  }
  @ApiOperation({
    operationId: 'createEnrollment',
    summary: 'Create enrollment',
    description:
      'MFA required. MANAGER/DIRECTOR, assigned student; subject enrollment is separate from payment/access.',
  })
  @ApiResponse({
    status: 200,
    type: ApiDto.EnrollmentResponse,
    description: 'Successful response',
    headers: { 'X-Request-ID': { schema: { type: 'string', format: 'uuid' } } },
  })
  @ApiResponse({ status: 400, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 401, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 403, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 409, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 422, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 503, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', format: 'uuid' },
    description: 'Required for critical business commands; reuse only for identical payload',
  })
  @ApiHeader({ name: 'X-Request-ID', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({ name: 'X-CSRF-Token', required: true, schema: { type: 'string' } })
  @ApiCookieAuth('sessionCookie')
  @ApiBody({ type: ApiDto.EnrollmentCreateRequest, required: true })
  @ApiTags('Schedule')
  @Post('enrollments')
  @RequirePermission('schedule:manage')
  @CriticalCommand({
    type: 'schedule.enrollment.create',
    resourceType: 'StudentSubjectEnrollment',
    topic: 'schedule.enrollment.create.v1',
  })
  async enrollment(
    @CurrentTransaction() ctx: CriticalContext,
    @Body() body: ApiDto.EnrollmentCreateRequest,
  ) {
    return serialize(await this.registry.enrollment(ctx, body));
  }
  @ApiOperation({
    operationId: 'createTeachingAssignment',
    summary: 'Create teaching assignment',
    description:
      'MFA required. MANAGER/DIRECTOR, assigned student; explicit teacher period and basis.',
  })
  @ApiResponse({
    status: 200,
    type: ApiDto.TeachingAssignmentResponse,
    description: 'Successful response',
    headers: { 'X-Request-ID': { schema: { type: 'string', format: 'uuid' } } },
  })
  @ApiResponse({ status: 400, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 401, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 403, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 409, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 422, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 503, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', format: 'uuid' },
    description: 'Required for critical business commands; reuse only for identical payload',
  })
  @ApiHeader({ name: 'X-Request-ID', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({ name: 'X-CSRF-Token', required: true, schema: { type: 'string' } })
  @ApiCookieAuth('sessionCookie')
  @ApiBody({ type: ApiDto.TeachingAssignmentCreateRequest, required: true })
  @ApiTags('Schedule')
  @Post('teaching-assignments')
  @RequirePermission('schedule:manage')
  @CriticalCommand({
    type: 'schedule.assignment.create',
    resourceType: 'TeachingAssignment',
    topic: 'schedule.assignment.create.v1',
  })
  async assign(
    @CurrentTransaction() ctx: CriticalContext,
    @Body() body: ApiDto.TeachingAssignmentCreateRequest,
  ) {
    return serialize(await this.registry.assignment(ctx, body));
  }
  @ApiOperation({
    operationId: 'revokeTeachingAssignment',
    summary: 'Revoke teaching assignment',
    description:
      'MFA required. MANAGER/DIRECTOR; ends period, creates internal follow-up for held future lessons; never overwrites historical teacher.',
  })
  @ApiResponse({
    status: 200,
    type: ApiDto.TeachingAssignmentResponse,
    description: 'Successful response',
    headers: { 'X-Request-ID': { schema: { type: 'string', format: 'uuid' } } },
  })
  @ApiResponse({ status: 400, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 401, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 403, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 409, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 422, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 503, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', format: 'uuid' },
    description: 'Required for critical business commands; reuse only for identical payload',
  })
  @ApiHeader({ name: 'X-Request-ID', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({ name: 'X-CSRF-Token', required: true, schema: { type: 'string' } })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiCookieAuth('sessionCookie')
  @ApiBody({ type: ApiDto.ScheduleReasonRequest, required: true })
  @ApiTags('Schedule')
  @Delete('teaching-assignments/:id')
  @RequirePermission('schedule:manage')
  @CriticalCommand({
    type: 'schedule.assignment.revoke',
    resourceType: 'TeachingAssignment',
    topic: 'schedule.assignment.revoke.v1',
  })
  async revoke(
    @CurrentTransaction() ctx: CriticalContext,
    @Param('id') id: string,
    @Body() body: ApiDto.ScheduleReasonRequest,
  ) {
    return serialize(await this.registry.revoke(ctx, id, body));
  }
  @ApiOperation({
    operationId: 'createRecurringSlot',
    summary: 'Create recurring slot',
    description:
      'MFA required. MANAGER/DIRECTOR; explicit finite period up to 366 days, weekly rule and IANA zone. Materializes and reserves every occurrence atomically. Ambiguous/nonexistent DST wall times require a new manager choice.',
  })
  @ApiResponse({
    status: 200,
    type: ApiDto.RecurringSlotResponse,
    description: 'Successful response',
    headers: { 'X-Request-ID': { schema: { type: 'string', format: 'uuid' } } },
  })
  @ApiResponse({ status: 400, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 401, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 403, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 409, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 422, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 503, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', format: 'uuid' },
    description: 'Required for critical business commands; reuse only for identical payload',
  })
  @ApiHeader({ name: 'X-Request-ID', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({ name: 'X-CSRF-Token', required: true, schema: { type: 'string' } })
  @ApiCookieAuth('sessionCookie')
  @ApiBody({ type: ApiDto.RecurringSlotCreateRequest, required: true })
  @ApiTags('Schedule')
  @Post('recurring-slots')
  @RequirePermission('schedule:manage')
  @CriticalCommand({
    type: 'schedule.slot.create',
    resourceType: 'RecurringSlot',
    topic: 'schedule.slot.create.v1',
  })
  async createSlot(
    @CurrentTransaction() ctx: CriticalContext,
    @Body() body: ApiDto.RecurringSlotCreateRequest,
  ) {
    return serialize(await this.booking.createSlot(ctx, body));
  }
  @ApiOperation({
    operationId: 'changeRecurringSlot',
    summary: 'Change recurring slot',
    description:
      'MFA required. MANAGER/DIRECTOR; future-only template revision, immutable slot/lesson events; individual exceptions require separate handling.',
  })
  @ApiResponse({
    status: 200,
    type: ApiDto.RecurringSlotResponse,
    description: 'Successful response',
    headers: { 'X-Request-ID': { schema: { type: 'string', format: 'uuid' } } },
  })
  @ApiResponse({ status: 400, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 401, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 403, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 409, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 422, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 503, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', format: 'uuid' },
    description: 'Required for critical business commands; reuse only for identical payload',
  })
  @ApiHeader({ name: 'X-Request-ID', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({ name: 'X-CSRF-Token', required: true, schema: { type: 'string' } })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiCookieAuth('sessionCookie')
  @ApiBody({ type: ApiDto.RecurringSlotPatchRequest, required: true })
  @ApiTags('Schedule')
  @Patch('recurring-slots/:id')
  @RequirePermission('schedule:manage')
  @CriticalCommand({
    type: 'schedule.slot.change',
    resourceType: 'RecurringSlot',
    topic: 'schedule.slot.change.v1',
  })
  async patchSlot(
    @CurrentTransaction() ctx: CriticalContext,
    @Param('id') id: string,
    @Body() body: ApiDto.RecurringSlotPatchRequest,
  ) {
    return serialize(await this.booking.patchSlot(ctx, id, body));
  }
  @ApiOperation({
    operationId: 'generateSlotOccurrences',
    summary: 'Generate slot occurrences',
    description:
      'MFA required. MANAGER/DIRECTOR; stable slot/local-calendar-day identity. Existing cancelled/rescheduled occurrences are never duplicated or resurrected.',
  })
  @ApiResponse({
    status: 200,
    type: ApiDto.SlotGenerationResponse,
    description: 'Successful response',
    headers: { 'X-Request-ID': { schema: { type: 'string', format: 'uuid' } } },
  })
  @ApiResponse({ status: 400, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 401, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 403, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 409, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 422, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 503, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', format: 'uuid' },
    description: 'Required for critical business commands; reuse only for identical payload',
  })
  @ApiHeader({ name: 'X-Request-ID', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({ name: 'X-CSRF-Token', required: true, schema: { type: 'string' } })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiCookieAuth('sessionCookie')
  @ApiBody({ type: ApiDto.GenerateSlotOccurrencesRequest, required: true })
  @ApiTags('Schedule')
  @Post('recurring-slots/:id/generate')
  @RequirePermission('schedule:manage')
  @CriticalCommand({
    type: 'schedule.slot.generate',
    resourceType: 'RecurringSlot',
    topic: 'schedule.slot.generate.v1',
  })
  async generate(
    @CurrentTransaction() ctx: CriticalContext,
    @Param('id') id: string,
    @Body() body: ApiDto.GenerateSlotOccurrencesRequest,
  ) {
    return serialize(await this.booking.generateById(ctx, id, body));
  }
  @ApiOperation({
    operationId: 'createLesson',
    summary: 'Create lesson',
    description:
      'MFA required. MANAGER/DIRECTOR; locks teacher availability and enforces SQL resource exclusion. Missing paid/director access produces held STAR_PENDING.',
  })
  @ApiResponse({
    status: 200,
    type: ApiDto.LessonResponse,
    description: 'Successful response',
    headers: { 'X-Request-ID': { schema: { type: 'string', format: 'uuid' } } },
  })
  @ApiResponse({ status: 400, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 401, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 403, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 409, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 422, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 503, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', format: 'uuid' },
    description: 'Required for critical business commands; reuse only for identical payload',
  })
  @ApiHeader({ name: 'X-Request-ID', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({ name: 'X-CSRF-Token', required: true, schema: { type: 'string' } })
  @ApiCookieAuth('sessionCookie')
  @ApiBody({ type: ApiDto.LessonCreateRequest, required: true })
  @ApiTags('Schedule')
  @Post('lessons')
  @RequirePermission('schedule:manage')
  @CriticalCommand({
    type: 'schedule.lesson.create',
    resourceType: 'LessonOccurrence',
    topic: 'schedule.lesson.create.v1',
  })
  async one(@CurrentTransaction() ctx: CriticalContext, @Body() body: ApiDto.LessonCreateRequest) {
    return serialize(await this.booking.one(ctx, body));
  }
  @ApiOperation({
    operationId: 'rescheduleLesson',
    summary: 'Reschedule lesson',
    description:
      'MFA required. MANAGER/DIRECTOR; same lesson ID and original key, old/new event; conflicting booking returns 409.',
  })
  @ApiResponse({
    status: 200,
    type: ApiDto.LessonResponse,
    description: 'Successful response',
    headers: { 'X-Request-ID': { schema: { type: 'string', format: 'uuid' } } },
  })
  @ApiResponse({ status: 400, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 401, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 403, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 409, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 422, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 503, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', format: 'uuid' },
    description: 'Required for critical business commands; reuse only for identical payload',
  })
  @ApiHeader({ name: 'X-Request-ID', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({ name: 'X-CSRF-Token', required: true, schema: { type: 'string' } })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiCookieAuth('sessionCookie')
  @ApiBody({ type: ApiDto.LessonRescheduleRequest, required: true })
  @ApiTags('Schedule')
  @Patch('lessons/:id/reschedule')
  @RequirePermission('schedule:manage')
  @CriticalCommand({
    type: 'schedule.lesson.reschedule',
    resourceType: 'LessonOccurrence',
    topic: 'schedule.lesson.reschedule.v1',
  })
  async reschedule(
    @CurrentTransaction() ctx: CriticalContext,
    @Param('id') id: string,
    @Body() body: ApiDto.LessonRescheduleRequest,
  ) {
    return serialize(await this.booking.reschedule(ctx, id, body));
  }
  @ApiOperation({
    operationId: 'cancelLesson',
    summary: 'Cancel lesson',
    description:
      'MFA required. MANAGER/DIRECTOR; explicit cancellation only before reported/started actual fact. No financial side effects.',
  })
  @ApiResponse({
    status: 200,
    type: ApiDto.LessonResponse,
    description: 'Successful response',
    headers: { 'X-Request-ID': { schema: { type: 'string', format: 'uuid' } } },
  })
  @ApiResponse({ status: 400, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 401, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 403, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 409, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 422, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 503, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', format: 'uuid' },
    description: 'Required for critical business commands; reuse only for identical payload',
  })
  @ApiHeader({ name: 'X-Request-ID', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({ name: 'X-CSRF-Token', required: true, schema: { type: 'string' } })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiCookieAuth('sessionCookie')
  @ApiBody({ type: ApiDto.ScheduleReasonRequest, required: true })
  @ApiTags('Schedule')
  @Delete('lessons/:id')
  @RequirePermission('schedule:manage')
  @CriticalCommand({
    type: 'schedule.lesson.cancel',
    resourceType: 'LessonOccurrence',
    topic: 'schedule.lesson.cancel.v1',
  })
  async cancel(
    @CurrentTransaction() ctx: CriticalContext,
    @Param('id') id: string,
    @Body() body: ApiDto.ScheduleReasonRequest,
  ) {
    return serialize(await this.booking.cancel(ctx, id, body));
  }
  @ApiOperation({
    operationId: 'startLesson',
    summary: 'Start lesson',
    description:
      'MFA required. Assigned TEACHER; server clock in planned interval, paid rights or limited director permission required. Freezes rate at actual start without consumption.',
  })
  @ApiResponse({
    status: 200,
    type: ApiDto.LessonResponse,
    description: 'Successful response',
    headers: { 'X-Request-ID': { schema: { type: 'string', format: 'uuid' } } },
  })
  @ApiResponse({ status: 400, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 401, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 403, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 409, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 422, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 503, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', format: 'uuid' },
    description: 'Required for critical business commands; reuse only for identical payload',
  })
  @ApiHeader({ name: 'X-Request-ID', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({ name: 'X-CSRF-Token', required: true, schema: { type: 'string' } })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiCookieAuth('sessionCookie')
  @ApiBody({ type: ApiDto.StartLessonRequest, required: true })
  @ApiTags('Schedule')
  @Post('lessons/:id/start')
  @RequireRole('TEACHER')
  @RequirePermission('schedule:teacher')
  @CriticalCommand({
    type: 'schedule.lesson.start',
    resourceType: 'LessonOccurrence',
    topic: 'schedule.lesson.start.v1',
  })
  async start(
    @CurrentTransaction() ctx: CriticalContext,
    @Param('id') id: string,
    @Body() body: ApiDto.StartLessonRequest,
  ) {
    return serialize(await this.outcomes.start(ctx, id, body));
  }
  @ApiOperation({
    operationId: 'reportLessonOutcome',
    summary: 'Report lesson outcome',
    description:
      'MFA required. Assigned TEACHER after planned end; immutable versioned report is not confirmed conduction. Late reports preserve the fact and create internal deadline task.',
  })
  @ApiResponse({
    status: 200,
    type: ApiDto.LessonOutcomeReportResponse,
    description: 'Successful response',
    headers: { 'X-Request-ID': { schema: { type: 'string', format: 'uuid' } } },
  })
  @ApiResponse({ status: 400, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 401, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 403, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 409, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 422, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 503, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', format: 'uuid' },
    description: 'Required for critical business commands; reuse only for identical payload',
  })
  @ApiHeader({ name: 'X-Request-ID', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({ name: 'X-CSRF-Token', required: true, schema: { type: 'string' } })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiCookieAuth('sessionCookie')
  @ApiBody({ type: ApiDto.LessonOutcomeReportRequest, required: true })
  @ApiTags('Schedule')
  @Post('lessons/:id/outcome')
  @RequireRole('TEACHER')
  @RequirePermission('schedule:teacher')
  @CriticalCommand({
    type: 'schedule.lesson.report',
    resourceType: 'LessonOutcomeReport',
    topic: 'schedule.lesson.report.v1',
  })
  async report(
    @CurrentTransaction() ctx: CriticalContext,
    @Param('id') id: string,
    @Body() body: ApiDto.LessonOutcomeReportRequest,
  ) {
    return serialize(await this.outcomes.report(ctx, id, body));
  }
  @ApiOperation({
    operationId: 'confirmLessonOutcome',
    summary: 'Confirm lesson outcome',
    description:
      'MFA required. Assigned MANAGER/DIRECTOR verifies latest report. Actual outcome reuses frozen snapshot, with verified historical backfill if start was not recorded. Unpaid conducted fact routes to director review, no automatic debt/accrual/consumption.',
  })
  @ApiResponse({
    status: 200,
    type: ApiDto.ConfirmedLessonOutcomeResponse,
    description: 'Successful response',
    headers: { 'X-Request-ID': { schema: { type: 'string', format: 'uuid' } } },
  })
  @ApiResponse({ status: 400, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 401, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 403, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 409, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 422, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 503, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', format: 'uuid' },
    description: 'Required for critical business commands; reuse only for identical payload',
  })
  @ApiHeader({ name: 'X-Request-ID', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({ name: 'X-CSRF-Token', required: true, schema: { type: 'string' } })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiCookieAuth('sessionCookie')
  @ApiBody({ type: ApiDto.ConfirmLessonOutcomeRequest, required: true })
  @ApiTags('Schedule')
  @Post('lessons/:id/confirm-outcome')
  @RequirePermission('schedule:manage')
  @CriticalCommand({
    type: 'schedule.lesson.confirm',
    resourceType: 'LessonOccurrence',
    topic: 'schedule.lesson.confirm.v1',
  })
  async confirm(
    @CurrentTransaction() ctx: CriticalContext,
    @Param('id') id: string,
    @Body() body: ApiDto.ConfirmLessonOutcomeRequest,
  ) {
    return serialize(await this.outcomes.confirm(ctx, id, body));
  }
  @ApiOperation({
    operationId: 'manageTeacherAvailability',
    summary: 'Manage teacher availability',
    description:
      'MFA required. TEACHER only, own free future interval. Occupied availability requires manager request, not direct editing.',
  })
  @ApiResponse({
    status: 200,
    type: ApiDto.TeacherAvailabilityResponse,
    description: 'Successful response',
    headers: { 'X-Request-ID': { schema: { type: 'string', format: 'uuid' } } },
  })
  @ApiResponse({ status: 400, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 401, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 403, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 409, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 422, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 503, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', format: 'uuid' },
    description: 'Required for critical business commands; reuse only for identical payload',
  })
  @ApiHeader({ name: 'X-Request-ID', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({ name: 'X-CSRF-Token', required: true, schema: { type: 'string' } })
  @ApiCookieAuth('sessionCookie')
  @ApiBody({ type: ApiDto.TeacherAvailabilityRequest, required: true })
  @ApiTags('Schedule')
  @Post('teacher-availability')
  @RequireRole('TEACHER')
  @RequirePermission('schedule:teacher')
  @CriticalCommand({
    type: 'schedule.availability.manage',
    resourceType: 'TeacherAvailability',
    topic: 'schedule.availability.manage.v1',
  })
  async availability(
    @CurrentTransaction() ctx: CriticalContext,
    @Body() body: ApiDto.TeacherAvailabilityRequest,
  ) {
    return serialize(await this.registry.availability(ctx, body));
  }
  @ApiOperation({
    operationId: 'requestScheduleChange',
    summary: 'Request schedule change',
    description:
      'MFA required. TEACHER only, exactly one own lessonId/slotId. Creates internal manager task without changing booking or notifying family.',
  })
  @ApiResponse({
    status: 200,
    type: ApiDto.ScheduleChangeRequestResponse,
    description: 'Successful response',
    headers: { 'X-Request-ID': { schema: { type: 'string', format: 'uuid' } } },
  })
  @ApiResponse({ status: 400, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 401, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 403, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 409, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 422, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 503, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', format: 'uuid' },
    description: 'Required for critical business commands; reuse only for identical payload',
  })
  @ApiHeader({ name: 'X-Request-ID', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({ name: 'X-CSRF-Token', required: true, schema: { type: 'string' } })
  @ApiCookieAuth('sessionCookie')
  @ApiBody({ type: ApiDto.ScheduleChangeRequestInput, required: true })
  @ApiTags('Schedule')
  @Post('schedule-requests')
  @RequireRole('TEACHER')
  @RequirePermission('schedule:teacher')
  @CriticalCommand({
    type: 'schedule.schedule.request',
    resourceType: 'ScheduleChangeRequest',
    topic: 'schedule.schedule.request.v1',
  })
  async request(
    @CurrentTransaction() ctx: CriticalContext,
    @Body() body: ApiDto.ScheduleChangeRequestInput,
  ) {
    return serialize(await this.registry.request(ctx, body));
  }
}
