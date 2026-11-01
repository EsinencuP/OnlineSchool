import { Module } from '@nestjs/common';
import { DatabaseModule, TransactionModule, AuditModule } from '@online-school/server-kernel';
import { TemporaryAccessExpiry } from './finance-expiry.service.js';

@Module({
  imports: [DatabaseModule, TransactionModule, AuditModule],
  providers: [TemporaryAccessExpiry],
  exports: [TemporaryAccessExpiry],
})
export class FinanceExpiryModule {}
