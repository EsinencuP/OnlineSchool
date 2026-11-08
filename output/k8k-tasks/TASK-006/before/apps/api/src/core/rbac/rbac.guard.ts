import { Injectable, Module } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Prisma, RoleCode } from '@online-school/db';
import { err, ok } from '@online-school/shared';
import type { Result } from '@online-school/shared';
import { AuditModule, AuditService } from '../audit/audit.service.js';
import { PolicyModule, PolicyService } from '../policy/policy.service.js';
import { SessionModule } from '../session/session.service.js';
import { SESSION_COOKIE, SessionStore } from '../session/session.store.js';
import { domainError, fail, unwrap } from '../errors/domain-error.js';
import type { DomainError } from '../errors/domain-error.js';
import { cookie } from '../http.js';
import type { AccountContext, HttpRequest } from '../http.js';
import { ACCESS } from './decorators.js';
import { managerPasswordOnlyLogin } from '../session/manager-password-policy.js';
import { qaPasswordOnlyLogin } from '../session/qa-password-policy.js';
import {
  studentPasswordChangeRoute,
  studentLogoutRoute,
} from '../session/student-password-policy.js';

@Injectable()
export class AccessService {
  constructor(
    private readonly reflector: Reflector,
    private readonly policy: PolicyService,
  ) {}
  metadata<T>(key: string, context: ExecutionContext): T | undefined {
    return this.reflector.getAllAndOverride<T>(key, [context.getHandler(), context.getClass()]);
  }
  async authorize(
    context: ExecutionContext,
    actor: AccountContext | undefined,
    tx?: Prisma.TransactionClient,
  ): Promise<Result<void, DomainError>> {
    const publicRoute = this.metadata<boolean>(ACCESS.public, context);
    const roles = this.metadata<RoleCode[]>(ACCESS.roles, context);
    const permissions = this.metadata<string[]>(ACCESS.permissions, context);
    const authenticated = this.metadata<boolean>(ACCESS.authenticated, context);
    const student = this.metadata<string>(ACCESS.student, context);
    const request = context.switchToHttp().getRequest<HttpRequest>();
    const path = context
      .switchToHttp()
      .getRequest<HttpRequest>()
      .originalUrl.split('?')[0]
      ?.toLowerCase()
      .replace(/\/+$/, '');
    if (
      actor?.recoveryOnly &&
      !/^\/api\/v1\/auth\/webauthn\/register\/(start|finish)$/.test(path ?? '') &&
      path !== '/api/v1/auth/session' &&
      path !== '/api/v1/auth/csrf'
    )
      return err(domainError('RECOVERY_REGISTRATION_ONLY', 403));
    if (actor?.kind === 'STUDENT' && path?.startsWith('/api/v1/auth/webauthn/'))
      return err(domainError('STUDENT_PASSKEYS_NOT_ALLOWED', 403));
    if (actor?.kind === 'STUDENT' && actor.mustChangePassword && !studentLogoutRoute(request)) {
      if (
        actor.temporaryPasswordExpiresAt &&
        actor.temporaryPasswordExpiresAt <= actor.lastActiveAt
      )
        return err(domainError('TEMPORARY_PASSWORD_EXPIRED', 403));
      if (!studentPasswordChangeRoute(request))
        return err(domainError('PASSWORD_CHANGE_REQUIRED', 403));
    }
    if (publicRoute) {
      if (
        roles ||
        permissions ||
        authenticated ||
        student ||
        this.metadata<boolean>(ACCESS.mfa, context)
      )
        return err(domainError('ACCESS_CONFIGURATION_ERROR', 403));
      return ok(undefined);
    }
    if (!actor) return err(domainError('UNAUTHENTICATED', 401));
    // Feature routes can use a stable role-denial code without bypassing core RBAC/MFA.
    const roleErrorCode = this.metadata<string>(ACCESS.roleErrorCode, context);
    if (roleErrorCode && roles?.length && !roles.some((role) => actor.roles.includes(role)))
      return err(domainError(roleErrorCode, 403));
    if (!roles?.length && !permissions?.length && !authenticated)
      return err(domainError('FORBIDDEN', 403));
    const req = context.switchToHttp().getRequest<HttpRequest>();
    const preMfa =
      this.metadata<boolean>(ACCESS.preMfa, context) &&
      req.method === 'POST' &&
      /^\/api\/v1\/auth\/webauthn\/(register|authenticate)\/(start|finish)$/.test(path ?? '');
    if (
      !actor.mfaCompleted &&
      !qaPasswordOnlyLogin(actor) &&
      !(
        managerPasswordOnlyLogin(actor) &&
        this.metadata<boolean>(ACCESS.managerProfileErrors, context) === true &&
        path?.startsWith('/api/v1/manager/') &&
        !this.metadata<boolean>(ACCESS.mfa, context)
      ) &&
      (this.metadata<boolean>(ACCESS.mfa, context) || (actor.kind !== 'STUDENT' && !preMfa))
    )
      return err(domainError('MFA_REQUIRED', 403));
    if (roles?.length && !roles.some((role) => actor.roles.includes(role)))
      return err(domainError('FORBIDDEN', 403));
    if (permissions?.some((permission) => !this.policy.hasPermission(actor, permission)))
      return err(domainError('FORBIDDEN', 403));
    if (student) {
      const allowed = await this.policy.canAccessStudent(actor, req.params[student] ?? '', tx);
      if (!allowed.ok) return allowed;
    }
    if (tx && req.resourceAuthorizer) return req.resourceAuthorizer(tx, actor);
    return ok(undefined);
  }
}
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly store: SessionStore,
    private readonly access: AccessService,
    private readonly audit: AuditService,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<HttpRequest>();
    const token = cookie(req, SESSION_COOKIE);
    const publicRoute = this.access.metadata<boolean>(ACCESS.public, context);
    if (publicRoute && !token) return true;
    const result = await this.store.resolve(token, undefined, {
      managerProfileErrors:
        this.access.metadata<boolean>(ACCESS.managerProfileErrors, context) === true,
    });
    if (result.ok) {
      req.account = result.value;
      return true;
    }
    if (publicRoute && result.error.status < 500) return true;
    unwrap(
      await this.audit.denial({
        requestId: req.requestId!,
        action: 'session.denied',
        code: result.error.code,
      }),
    );
    return fail(result.error);
  }
}
@Injectable()
export class RbacGuard implements CanActivate {
  constructor(
    private readonly access: AccessService,
    private readonly audit: AuditService,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<HttpRequest>();
    const result = await this.access.authorize(context, req.account);
    if (result.ok) return true;
    unwrap(
      await this.audit.denial({
        requestId: req.requestId!,
        action: 'access.denied',
        code: result.error.code,
        ...(req.account ? { actor: req.account } : {}),
      }),
    );
    return fail(result.error);
  }
}
@Module({
  imports: [SessionModule, PolicyModule, AuditModule],
  providers: [AccessService, SessionGuard, RbacGuard],
  exports: [AccessService, SessionGuard, RbacGuard],
})
export class RbacModule {}
