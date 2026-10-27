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
import { StudentLessonsController } from './lessons/lessons.controller.js';
import { StudentLessonsService } from './lessons/lessons.service.js';
import { StudentCrmTaskService } from './lessons/student-crm-task.service.js';
import { StudentLessonScopeGuard } from './lessons/student-lesson-scope.guard.js';
import { LessonsQueryPipe } from './lessons/lesson-period.js';
import { StudentHistoryController } from './history/history.controller.js';
import { StudentHistoryService } from './history/history.service.js';
import { StudentDisputeService } from './history/dispute.service.js';
import { HistoryQueryPipe } from './history/history.dto.js';
import { StorageModule } from '../modules/storage/storage.module.js';
import { StudentHomeworkController } from './homework/homework.controller.js';
import { StudentHomeworkService } from './homework/homework.service.js';
import { StudentHomeworkScopeGuard } from './homework/homework-scope.guard.js';
import { HomeworkQueryPipe } from './homework/homework.dto.js';
import { StudentMaterialsController } from './materials/materials.controller.js';
import { StudentMaterialsService } from './materials/materials.service.js';
import { MaterialsQueryPipe } from './materials/materials.dto.js';
import { StudentSubscriptionController } from './subscription/subscription.controller.js';
import { StudentSubscriptionService } from './subscription/subscription.service.js';
import {
  SubscriptionQueryPipe,
  SubscriptionHistoryQueryPipe,
} from './subscription/subscription.dto.js';

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
  imports: [CoreModule, IdentityModule, StorageModule, CacheModule.register({ ttl: 30000 })],
  controllers: [
    StudentSubscriptionController,
    StudentMaterialsController,
    StudentHomeworkController,
    MeController,
    ChangeStudentPasswordController,
    DashboardController,
    StudentLessonsController,
    StudentHistoryController,
  ],
  providers: [
    StudentSubscriptionService,
    SubscriptionQueryPipe,
    SubscriptionHistoryQueryPipe,
    StudentMaterialsService,
    MaterialsQueryPipe,
    StudentHomeworkService,
    StudentHomeworkScopeGuard,
    HomeworkQueryPipe,
    StudentHistoryService,
    StudentDisputeService,
    HistoryQueryPipe,
    StudentLessonsService,
    StudentCrmTaskService,
    StudentLessonScopeGuard,
    LessonsQueryPipe,
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
