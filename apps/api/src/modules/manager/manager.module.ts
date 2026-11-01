import { Module } from '@nestjs/common';
import { ManagerOptionsController } from './options/manager-options.controller.js';
import { ManagerOptionsService } from './options/manager-options.service.js';
import { ManagerDashboardController } from './dashboard/manager-dashboard.controller.js';
import { ManagerDashboardService } from './dashboard/manager-dashboard.service.js';
import { ManagerDashboardRead } from './dashboard/dashboard.read.js';
import { CoreModule } from '../../core/core.module.js';
import { ManagerContextGuard } from './guards/manager-context.guard.js';
import { ManagerScopeService } from './scope/manager-scope.service.js';
import { ManagerMeController } from './me/manager-me.controller.js';
import { ManagerMeService } from './me/manager-me.service.js';
import { ManagerStudentsController } from './students/manager-students.controller.js';
import { ManagerStudentsService } from './students/manager-students.service.js';
import { ManagerStudentsRead } from './students/students.read.js';
import { ManagerCreateReplayGuard } from './students/manager-create.guard.js';
import { IdentityModule } from '../identity/identity.module.js';
import { ManagerAccountsController } from './accounts/manager-accounts.controller.js';
import { ManagerAccountsService } from './accounts/manager-accounts.service.js';
import { ManagerAccountsGuard } from './accounts/manager-accounts.guard.js';
import { ManagerSubscriptionLifecycleModule } from '../finance/manager-subscriptions/lifecycle.module.js';
import { ManagerSubscriptionsController } from './subscriptions/manager-subscriptions.controller.js';
import { ManagerSubscriptionsService } from './subscriptions/manager-subscriptions.service.js';
import { ManagerSubscriptionsGuard } from './subscriptions/manager-subscriptions.guard.js';
import { FinanceInfrastructureModule } from '../finance/finance-infrastructure.module.js';
import { ManagerFinanceFacade } from './finance/manager-finance.facade.js';
import { ManagerPaymentsController } from './payments/manager-payments.controller.js';
import { ManagerPaymentsService } from './payments/manager-payments.service.js';
import { ManagerPaymentsGuard } from './payments/manager-payments.guard.js';
import { ScheduleInfrastructureModule } from '../schedule/schedule-infrastructure.module.js';
import { ManagerScheduleService } from './schedule/manager-schedule.service.js';
import { ManagerScheduleController } from './schedule/manager-schedule.controller.js';
import { ManagerScheduleGuard } from './schedule/manager-schedule.guard.js';
import { ManagerTasksService } from './tasks/manager-tasks.service.js';
import { ManagerTasksGuard } from './tasks/manager-tasks.guard.js';
import { ManagerTasksController } from './tasks/manager-tasks.controller.js';
import { NotificationOutboxPublisher } from '../notifications/notification-outbox.publisher.js';
import { ManagerNotificationsController } from './notifications/manager-notifications.controller.js';
import { ManagerNotificationsService } from './notifications/manager-notifications.service.js';
import { ManagerNotificationsGuard } from './notifications/manager-notifications.guard.js';

@Module({
  imports: [
    CoreModule,
    IdentityModule,
    ManagerSubscriptionLifecycleModule,
    FinanceInfrastructureModule,
    ScheduleInfrastructureModule,
  ],
  controllers: [
    ManagerOptionsController,
    ManagerDashboardController,
    ManagerNotificationsController,
    ManagerMeController,
    ManagerStudentsController,
    ManagerAccountsController,
    ManagerSubscriptionsController,
    ManagerPaymentsController,
    ManagerScheduleController,
    ManagerTasksController,
  ],
  providers: [
    ManagerOptionsService,
    ManagerDashboardService,
    ManagerDashboardRead,
    NotificationOutboxPublisher,
    ManagerNotificationsService,
    ManagerNotificationsGuard,
    ManagerTasksService,
    ManagerTasksGuard,
    ManagerScheduleService,
    ManagerScheduleGuard,
    ManagerFinanceFacade,
    ManagerPaymentsService,
    ManagerPaymentsGuard,
    ManagerSubscriptionsService,
    ManagerSubscriptionsGuard,
    ManagerContextGuard,
    ManagerScopeService,
    ManagerMeService,
    ManagerStudentsService,
    ManagerStudentsRead,
    ManagerCreateReplayGuard,
    ManagerAccountsService,
    ManagerAccountsGuard,
  ],
})
export class ManagerModule {}
