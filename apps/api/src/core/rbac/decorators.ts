import { createParamDecorator, SetMetadata } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { RoleCode } from '@online-school/db';
import type { HttpRequest } from '../http.js';

export const Role = RoleCode;
export const ACCESS = {
  public: 'core.public',
  authenticated: 'core.authenticated',
  roles: 'core.roles',
  permissions: 'core.permissions',
  mfa: 'core.mfa',
  preMfa: 'core.preMfa',
  student: 'core.student',
} as const;
export const Public = () => SetMetadata(ACCESS.public, true);
export const Authenticated = () => SetMetadata(ACCESS.authenticated, true);
export const RequireRole = (...roles: RoleCode[]) => SetMetadata(ACCESS.roles, roles);
export const RequirePermission = (...permissions: string[]) =>
  SetMetadata(ACCESS.permissions, permissions);
export const RequireMfa = () => SetMetadata(ACCESS.mfa, true);
export const AllowPreMfa = () => SetMetadata(ACCESS.preMfa, true);
export const RequireStudentAccess = (parameter = 'id') => SetMetadata(ACCESS.student, parameter);
export const CurrentAccount = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<HttpRequest>().account,
);
