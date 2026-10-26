import { Module } from '@nestjs/common';
import { FinanceModule } from '../finance/finance.module.js';
import { ScheduleAccess } from './schedule-access.service.js';
import { ScheduleEvents } from './schedule-events.service.js';
import { ScheduleRegistry } from './registry.service.js';
import { BookingService } from './booking.service.js';
import { OutcomesService } from './outcomes.service.js';
import { ScheduleScopeGuard } from './schedule-scope.guard.js';
import { ScheduleController } from './schedule.controller.js';
import { ScheduleDeadlineModule } from './deadline.module.js';
@Module({
  imports: [FinanceModule, ScheduleDeadlineModule],
  controllers: [ScheduleController],
  providers: [
    ScheduleAccess,
    ScheduleEvents,
    ScheduleRegistry,
    BookingService,
    OutcomesService,
    ScheduleScopeGuard,
  ],
})
export class ScheduleModule {}
