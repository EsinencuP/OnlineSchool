import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ACCESS, RequireRole } from '../../../core/rbac/decorators.js';
import { ApiError } from '../../../openapi/dtos.js';
import { TeacherContextGuard } from './teacher-context.guard.js';

// Core global Session/RBAC/CSRF/MFA guards always run before this controller guard.
export function TeacherRoute() {
  return applyDecorators(
    RequireRole('TEACHER'),
    SetMetadata(ACCESS.roleErrorCode, 'FORBIDDEN_ROLE'),
    UseGuards(TeacherContextGuard),
    ApiTags('teacher'),
    ApiCookieAuth('sessionCookie'),
    ApiUnauthorizedResponse({ type: ApiError, description: 'UNAUTHENTICATED' }),
    ApiForbiddenResponse({
      type: ApiError,
      description:
        'FORBIDDEN_ROLE, TEACHER_INACTIVE, TEACHER_PROFILE_NOT_FOUND or core security denial',
    }),
  );
}
