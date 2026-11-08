import { Module } from '@nestjs/common';
import { AuditModule } from '../../core/audit/audit.service.js';
import { DatabaseModule } from '../../core/database/database.module.js';
import { PolicyModule } from '../../core/policy/policy.service.js';
import {
  ContextualLedgerPublicationPolicy,
  LedgerPublicationPolicy,
  LedgerPublicationService,
} from './ledger-publication.service.js';
import { FinanceAccess } from './finance-access.service.js';
import { FinanceEvents } from './finance-events.service.js';
import { FinanceLedger } from './finance-ledger.service.js';
import { PaymentsService } from './payments.service.js';
import { ManagerPaymentWorkflow } from './manager-payments/workflow.service.js';
import { EntitlementsService } from './entitlements.service.js';
import { ManagerLessonRights } from './manager-payments/lesson-rights.service.js';
import { DisputeFinanceService } from './manager-disputes/dispute.service.js';
// Shared domain providers have explicit dependencies and no HTTP controllers.
@Module({
  imports: [DatabaseModule, AuditModule, PolicyModule],
  providers: [
    DisputeFinanceService,
    EntitlementsService,
    ManagerLessonRights,
    LedgerPublicationService,
    { provide: LedgerPublicationPolicy, useClass: ContextualLedgerPublicationPolicy },
    FinanceAccess,
    FinanceEvents,
    FinanceLedger,
    PaymentsService,
    ManagerPaymentWorkflow,
  ],
  exports: [
    DisputeFinanceService,
    LedgerPublicationService,
    FinanceAccess,
    FinanceEvents,
    FinanceLedger,
    PaymentsService,
    ManagerPaymentWorkflow,
    EntitlementsService,
    ManagerLessonRights,
  ],
})
export class FinanceInfrastructureModule {}
