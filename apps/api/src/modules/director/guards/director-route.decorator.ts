import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ACCESS, RequireRole } from '../../../core/rbac/decorators.js';
import { ApiError } from '../../../openapi/dtos.js';
import { DirectorContextGuard } from './director-context.guard.js';

// Core global Session/RBAC/CSRF/MFA guards always run before this controller guard.
export function DirectorRoute() {
  return applyDecorators(
    RequireRole('DIRECTOR'),
    SetMetadata(ACCESS.roleErrorCode, 'FORBIDDEN_ROLE'),
    UseGuards(DirectorContextGuard),
    ApiTags('director'),
    ApiCookieAuth('sessionCookie'),
    ApiUnauthorizedResponse({ type: ApiError, description: 'UNAUTHENTICATED' }),
    ApiForbiddenResponse({
      type: ApiError,
      description:
        'FORBIDDEN_ROLE, DIRECTOR_INACTIVE, DIRECTOR_PROFILE_NOT_FOUND or core security denial',
    }),
  );
}
