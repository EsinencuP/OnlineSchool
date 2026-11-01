import { Module } from '@nestjs/common';
import { DatabaseModule, TransactionModule, AuditModule } from '@online-school/server-kernel';
import { ScheduleDeadlines } from './schedule-deadline.service.js';

@Module({
  imports: [DatabaseModule, TransactionModule, AuditModule],
  providers: [ScheduleDeadlines],
  exports: [ScheduleDeadlines],
})
export class ScheduleDeadlineModule {}
