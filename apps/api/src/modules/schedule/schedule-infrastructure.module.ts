import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../core/database/database.module.js';
import { AuditModule } from '../../core/audit/audit.service.js';
import { PolicyModule } from '../../core/policy/policy.service.js';
import { FinanceInfrastructureModule } from '../finance/finance-infrastructure.module.js';
import { ScheduleAccess } from './schedule-access.service.js';
import { ScheduleEvents } from './schedule-events.service.js';
import { BookingService } from './booking.service.js';
import { ManagerScheduleWorkflow } from './manager/workflow.service.js';
import { ScheduleFreezeCancellation } from './manager/freeze-cancellation.service.js';
import { MeetLinkPort, UnavailableMeetLink } from './manager/meet-link.port.js';
@Module({
  imports: [DatabaseModule, AuditModule, PolicyModule, FinanceInfrastructureModule],
  providers: [
    ScheduleAccess,
    ScheduleEvents,
    BookingService,
    ManagerScheduleWorkflow,
    ScheduleFreezeCancellation,
    { provide: MeetLinkPort, useClass: UnavailableMeetLink },
  ],
  exports: [
    ScheduleAccess,
    ScheduleEvents,
    BookingService,
    ManagerScheduleWorkflow,
    ScheduleFreezeCancellation,
    MeetLinkPort,
  ],
})
export class ScheduleInfrastructureModule {}
