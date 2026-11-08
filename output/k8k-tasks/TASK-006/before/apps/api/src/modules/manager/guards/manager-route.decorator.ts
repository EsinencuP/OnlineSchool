import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ACCESS, RequireRole } from '../../../core/rbac/decorators.js';
import { ApiError } from '../../../openapi/dtos.js';
import { ManagerContextGuard } from './manager-context.guard.js';

// Core global Session/RBAC/CSRF guards always run before this controller guard.
export function ManagerRoute() {
  return applyDecorators(
    RequireRole('MANAGER'),
    SetMetadata(ACCESS.roleErrorCode, 'FORBIDDEN_ROLE'),
    SetMetadata(ACCESS.managerProfileErrors, true),
    UseGuards(ManagerContextGuard),
    ApiTags('manager'),
    ApiCookieAuth('sessionCookie'),
    ApiUnauthorizedResponse({ type: ApiError, description: 'UNAUTHENTICATED' }),
    ApiForbiddenResponse({
      type: ApiError,
      description:
        'FORBIDDEN_ROLE, MANAGER_INACTIVE, MANAGER_PROFILE_NOT_FOUND or core security denial',
    }),
  );
}
