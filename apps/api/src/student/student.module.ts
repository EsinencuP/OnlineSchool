import { Injectable, Module } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { CacheModule } from '@nestjs/cache-manager';
import { CoreModule } from '../core/core.module.js';
import { SessionGuard } from '../core/rbac/rbac.guard.js';
import { CsrfGuard } from '../core/csrf/csrf.module.js';
import { isStudentRequest } from './student-context.interface.js';
import type { StudentRequest } from './student-context.interface.js';
import { StudentContextGuard } from './student-context.guard.js';
import { ActiveSubscriptionGuard } from './active-subscription.guard.js';
import { MeController } from './me/me.controller.js';
import { MeService } from './me/me.service.js';
import { IdentityModule } from '../modules/identity/identity.module.js';
import { ChangeStudentPasswordController } from './security/change-password.controller.js';
import { ChangeStudentPasswordService } from './security/change-password.service.js';
import { DashboardController } from './dashboard/dashboard.controller.js';
import { DashboardService } from './dashboard/dashboard.service.js';
import { DashboardCacheInterceptor } from './dashboard/dashboard-cache.interceptor.js';

// APP_GUARD is application-global in Nest, including when declared in a feature module.
// These adapters enforce the student pipeline only inside its namespace and reuse core checks.
@Injectable()
export class StudentSessionGuard implements CanActivate {
  constructor(private readonly session: SessionGuard) {}
  canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    const req = context.switchToHttp().getRequest<StudentRequest>();
    return !isStudentRequest(req) || !!req.account || this.session.canActivate(context);
  }
}
@Injectable()
export class StudentCsrfGuard implements CanActivate {
  constructor(private readonly csrf: CsrfGuard) {}
  canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    const req = context.switchToHttp().getRequest<StudentRequest>();
    return !isStudentRequest(req) || req.csrfValidated === true || this.csrf.canActivate(context);
  }
}
@Module({
  imports: [CoreModule, IdentityModule, CacheModule.register({ ttl: 30000 })],
  controllers: [MeController, ChangeStudentPasswordController, DashboardController],
  providers: [
    DashboardService,
    DashboardCacheInterceptor,
    MeService,
    ChangeStudentPasswordService,
    StudentSessionGuard,
    StudentCsrfGuard,
    StudentContextGuard,
    ActiveSubscriptionGuard,
    { provide: APP_GUARD, useExisting: StudentSessionGuard },
    { provide: APP_GUARD, useExisting: StudentCsrfGuard },
    { provide: APP_GUARD, useExisting: StudentContextGuard },
    { provide: APP_GUARD, useExisting: ActiveSubscriptionGuard },
  ],
  exports: [MeService, StudentContextGuard, ActiveSubscriptionGuard],
})
export class StudentModule {}
