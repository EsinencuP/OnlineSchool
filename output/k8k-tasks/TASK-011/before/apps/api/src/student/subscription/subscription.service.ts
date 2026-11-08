import { Injectable } from '@nestjs/common';
import { Prisma } from '@online-school/db';
import { Temporal } from '@js-temporal/polyfill';
import { DatabaseService } from '../../core/database/database.module.js';
import { domainError, fail } from '../../core/errors/domain-error.js';
import type { IStudentContext } from '../student-context.interface.js';
import type {
  PaymentHistoryResponseDto,
  StudentSubscriptionLedgerResponseDto,
  SubscriptionDetailsDto,
  SubscriptionPage,
  SubscriptionSelection,
} from './subscription.dto.js';
import {
  subscriptionDetailsSql,
  subscriptionLedgerSql,
  subscriptionPaymentsSql,
} from './subscription.sql.js';

export const noSubscription = (): SubscriptionDetailsDto => ({
  subscriptionId: null,
  planName: null,
  lessonsTotal: null,
  lessonsRemaining: null,
  validFrom: null,
  validUntil: null,
  isFrozen: false,
  frozenFrom: null,
  frozenUntil: null,
  status: 'NONE',
});
export function subscriptionDate(value: string, zone = 'Europe/Chisinau'): string {
  return Temporal.Instant.from(value).toZonedDateTimeISO(zone).toPlainDate().toString();
}
export function exactPaymentAmount(value: string): string {
  const decimal = new Prisma.Decimal(value);
  return decimal.toFixed(Math.max(2, decimal.decimalPlaces()));
}
@Injectable()
export class StudentSubscriptionService {
  constructor(private readonly database: DatabaseService) {}
  private async read<T>(query: Prisma.Sql): Promise<T> {
    const [row] = await this.database.client.$queryRaw<{ forbidden: boolean; data: T }[]>(query);
    if (!row) return fail(domainError('SUBSCRIPTION_UNAVAILABLE', 503));
    if (row.forbidden) return fail(domainError('SUBSCRIPTION_FORBIDDEN', 403));
    return row.data;
  }
  async details(
    student: IStudentContext,
    query: SubscriptionSelection,
  ): Promise<SubscriptionDetailsDto> {
    const row = await this.read<SubscriptionDetailsDto | null>(
      subscriptionDetailsSql(student.studentProfileId, query, new Date()),
    );
    if (!row) return noSubscription();
    for (const key of ['validFrom', 'validUntil', 'frozenFrom', 'frozenUntil'] as const)
      if (row[key]) row[key] = subscriptionDate(row[key], student.timeZone);
    row.isFrozen = row.status === 'FROZEN';
    return row;
  }
  async payments(
    student: IStudentContext,
    query: SubscriptionPage,
  ): Promise<PaymentHistoryResponseDto> {
    const row = await this.read<Pick<PaymentHistoryResponseDto, 'items' | 'total'>>(
      subscriptionPaymentsSql(student.studentProfileId, query, new Date()),
    );
    for (const item of row.items) {
      item.amount = exactPaymentAmount(item.amount);
      item.confirmedAt = new Date(item.confirmedAt).toISOString();
    }
    return { ...row, page: query.page, pageSize: query.pageSize };
  }
  async ledger(
    student: IStudentContext,
    query: SubscriptionPage,
  ): Promise<StudentSubscriptionLedgerResponseDto> {
    const row = await this.read<Pick<StudentSubscriptionLedgerResponseDto, 'items' | 'total'>>(
      subscriptionLedgerSql(student.studentProfileId, query, new Date()),
    );
    for (const item of row.items) {
      item.entryDate = subscriptionDate(item.entryDate, student.timeZone);
      item.balanceBefore = new Prisma.Decimal(item.balanceBefore).toFixed(0);
      item.balanceAfter = new Prisma.Decimal(item.balanceAfter).toFixed(0);
    }
    return { ...row, page: query.page, pageSize: query.pageSize };
  }
}
