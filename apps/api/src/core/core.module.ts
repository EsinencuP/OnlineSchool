import { Global, Module, RequestMethod } from '@nestjs/common';
import type { MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { DtoValidationPipe } from '../openapi/dto-validation.pipe.js';
import { DatabaseModule } from './database/database.module.js';
import { AuditModule } from './audit/audit.service.js';
import { TransactionModule } from './transaction/transaction.service.js';
import { SessionModule } from './session/session.service.js';
import {
  WebAuthnChallengeGuard,
  WebAuthnChallengeModule,
} from './session/webauthn-challenge.store.js';
import { CsrfGuard, CsrfModule } from './csrf/csrf.module.js';
import { PolicyModule } from './policy/policy.service.js';
import { RbacModule, RbacGuard, SessionGuard } from './rbac/rbac.guard.js';
import {
  CriticalCommandInterceptor,
  IdempotencyGuard,
  IdempotencyModule,
} from './idempotency/idempotency.module.js';
import { AppExceptionFilter } from './errors/app-exception.filter.js';
import { RequestIdMiddleware } from './request-id/request-id.middleware.js';

@Global()
@Module({
  imports: [
    DatabaseModule,
    AuditModule,
    TransactionModule,
    SessionModule,
    WebAuthnChallengeModule,
    CsrfModule,
    PolicyModule,
    RbacModule,
    IdempotencyModule,
  ],
  providers: [
    { provide: APP_PIPE, useClass: DtoValidationPipe },
    RequestIdMiddleware,
    { provide: APP_FILTER, useClass: AppExceptionFilter },
    { provide: APP_GUARD, useExisting: SessionGuard },
    { provide: APP_GUARD, useExisting: RbacGuard },
    { provide: APP_GUARD, useExisting: CsrfGuard },
    { provide: APP_GUARD, useExisting: WebAuthnChallengeGuard },
    { provide: APP_GUARD, useExisting: IdempotencyGuard },
    { provide: APP_INTERCEPTOR, useExisting: CriticalCommandInterceptor },
  ],
  exports: [
    DatabaseModule,
    AuditModule,
    TransactionModule,
    SessionModule,
    WebAuthnChallengeModule,
    CsrfModule,
    PolicyModule,
    RbacModule,
    IdempotencyModule,
  ],
})
export class CoreModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes({ path: '{*path}', method: RequestMethod.ALL });
  }
}
