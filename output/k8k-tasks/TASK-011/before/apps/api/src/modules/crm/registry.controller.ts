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
import { Body, Controller, Param, Post } from '@nestjs/common';
import type { CriticalContext } from '../../core/http.js';
import { CriticalCommand, CurrentTransaction } from '../../core/idempotency/idempotency.module.js';
import { RequirePermission, RequireRole } from '../../core/rbac/decorators.js';
import { RegistryService } from './registry.service.js';

@Controller('api/v1')
@RequireRole('DIRECTOR', 'MANAGER')
export class RegistryController {
  constructor(private readonly registry: RegistryService) {}
  @ApiOperation({
    operationId: 'createStudent',
    summary: 'Create student',
    description:
      'CRM-owned stable Student identity; no account/entitlements. A manager receives an explicit student assignment.',
  })
  @ApiResponse({
    status: 200,
    type: ApiDto.StudentCreatedResponse,
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
  @ApiBody({ type: ApiDto.StudentCreateRequest, required: true })
  @ApiTags('Registry')
  @Post('students')
  @RequirePermission('student:create')
  @CriticalCommand({ type: 'student.create', resourceType: 'Student', topic: 'student.created.v1' })
  createStudent(
    @CurrentTransaction() context: CriticalContext,
    @Body() body: ApiDto.StudentCreateRequest,
  ): Promise<unknown> {
    return this.registry.createStudent(context, body);
  }
  @ApiOperation({
    operationId: 'createHousehold',
    summary: 'Create household',
    description: 'Household grouping, without automatic rights.',
  })
  @ApiResponse({
    status: 200,
    type: ApiDto.HouseholdCreatedResponse,
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
  @ApiBody({ type: ApiDto.HouseholdCreateRequest, required: true })
  @ApiTags('Registry')
  @Post('households')
  @RequirePermission('household:manage')
  @CriticalCommand({
    type: 'household.create',
    resourceType: 'Household',
    topic: 'household.created.v1',
  })
  createHousehold(
    @CurrentTransaction() context: CriticalContext,
    @Body() body: ApiDto.HouseholdCreateRequest,
  ): Promise<unknown> {
    return this.registry.createHousehold(context, body);
  }
  @ApiOperation({
    operationId: 'addHouseholdMember',
    summary: 'Add household member',
    description: 'Add exactly one Student or Representative after role and object-context checks.',
  })
  @ApiResponse({
    status: 200,
    type: ApiDto.HouseholdMemberResponse,
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
  @ApiBody({ type: ApiDto.HouseholdMemberRequest, required: true })
  @ApiTags('Registry')
  @Post('households/:id/members')
  @RequirePermission('household:manage')
  @CriticalCommand({
    type: 'household.member.add',
    resourceType: 'HouseholdMembership',
    topic: 'household.member.added.v1',
  })
  addMember(
    @CurrentTransaction() context: CriticalContext,
    @Param('id') id: string,
    @Body() body: ApiDto.HouseholdMemberRequest,
  ): Promise<unknown> {
    return this.registry.addMember(context, id, body);
  }
}
