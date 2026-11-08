import { Module } from '@nestjs/common';
import { FinanceInfrastructureModule } from './finance-infrastructure.module.js';
import { AuditModule } from '../../core/audit/audit.service.js';
import { FinanceController } from './finance.controller.js';
import { PayrollService } from './payroll.service.js';
import { PeriodsService } from './periods.service.js';
import { TeacherRateService } from './teacher-rate.service.js';
import { FinanceExpiryModule } from './expiry.module.js';
import { FinanceScopeGuard } from './finance-scope.guard.js';
import { DirectorCrmDisputesController } from './manager-disputes/director.controller.js';
import { TransactionModule } from '../../core/transaction/transaction.service.js';

@Module({
  imports: [FinanceInfrastructureModule, FinanceExpiryModule, AuditModule, TransactionModule],
  controllers: [FinanceController, DirectorCrmDisputesController],
  providers: [PayrollService, PeriodsService, TeacherRateService, FinanceScopeGuard],
  exports: [FinanceInfrastructureModule, TeacherRateService],
})
export class FinanceModule {}
