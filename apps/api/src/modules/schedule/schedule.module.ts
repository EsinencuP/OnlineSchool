import { Module } from '@nestjs/common';
import { TransactionModule } from '../../core/transaction/transaction.service.js';
import { FinanceModule } from '../finance/finance.module.js';
import { ScheduleRegistry } from './registry.service.js';
import { ScheduleInfrastructureModule } from './schedule-infrastructure.module.js';
import { OutcomesService } from './outcomes.service.js';
import { ScheduleScopeGuard } from './schedule-scope.guard.js';
import { ScheduleController } from './schedule.controller.js';
import { ScheduleDeadlineModule } from './deadline.module.js';
import { ScheduleChangeApprovalController } from './manager/approval.controller.js';
@Module({
  imports: [FinanceModule, ScheduleDeadlineModule, ScheduleInfrastructureModule, TransactionModule],
  controllers: [ScheduleController, ScheduleChangeApprovalController],
  providers: [ScheduleRegistry, OutcomesService, ScheduleScopeGuard],
  exports: [OutcomesService],
})
export class ScheduleModule {}
