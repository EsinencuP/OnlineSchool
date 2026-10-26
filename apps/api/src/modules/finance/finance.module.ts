import { Module } from '@nestjs/common';
import {
  ContextualLedgerPublicationPolicy,
  LedgerPublicationPolicy,
  LedgerPublicationService,
} from './ledger-publication.service.js';
import { FinanceController } from './finance.controller.js';
import { FinanceAccess } from './finance-access.service.js';
import { FinanceEvents } from './finance-events.service.js';
import { FinanceLedger } from './finance-ledger.service.js';
import { PaymentsService } from './payments.service.js';
import { EntitlementsService } from './entitlements.service.js';
import { PayrollService } from './payroll.service.js';
import { PeriodsService } from './periods.service.js';
import { TeacherRateService } from './teacher-rate.service.js';
import { FinanceExpiryModule } from './expiry.module.js';
import { FinanceScopeGuard } from './finance-scope.guard.js';

@Module({
  imports: [FinanceExpiryModule],
  controllers: [FinanceController],
  providers: [
    LedgerPublicationService,
    { provide: LedgerPublicationPolicy, useClass: ContextualLedgerPublicationPolicy },
    FinanceAccess,
    FinanceEvents,
    FinanceLedger,
    PaymentsService,
    EntitlementsService,
    PayrollService,
    PeriodsService,
    TeacherRateService,
    FinanceScopeGuard,
  ],
  exports: [LedgerPublicationService, TeacherRateService],
})
export class FinanceModule {}
