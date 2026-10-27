import { Injectable } from '@nestjs/common';
import type { PipeTransform } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { object, uuid } from '../../modules/identity/input.js';
import { HistoryQueryPipe } from '../history/history.dto.js';

export type SubscriptionSelection = { subscriptionId?: string };
export type SubscriptionPage = SubscriptionSelection & { page: number; pageSize: number };
export class SubscriptionQueryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Owned subscription. Defaults to the most recent current plan, then latest expired plan.',
  })
  subscriptionId?: string;
}
export class SubscriptionHistoryQueryDto extends SubscriptionQueryDto {
  @ApiPropertyOptional({ type: 'integer', minimum: 1, default: 1 }) page?: number;
  @ApiPropertyOptional({ type: 'integer', minimum: 1, maximum: 100, default: 20 })
  pageSize?: number;
}
@Injectable()
export class SubscriptionQueryPipe implements PipeTransform {
  transform(value: unknown): SubscriptionSelection {
    const input = object(value, ['subscriptionId']);
    return input.subscriptionId === undefined ? {} : { subscriptionId: uuid(input.subscriptionId) };
  }
}
@Injectable()
export class SubscriptionHistoryQueryPipe implements PipeTransform {
  transform(value: unknown): SubscriptionPage {
    const input = object(value, ['subscriptionId', 'page', 'pageSize']);
    const page = new HistoryQueryPipe().transform({
      ...(input.page === undefined ? {} : { page: input.page }),
      ...(input.pageSize === undefined ? {} : { pageSize: input.pageSize }),
    });
    return {
      ...page,
      ...(input.subscriptionId === undefined ? {} : { subscriptionId: uuid(input.subscriptionId) }),
    };
  }
}
export class SubscriptionDetailsDto {
  @ApiProperty({ type: String, nullable: true, format: 'uuid' }) subscriptionId!: string | null;
  @ApiProperty({ type: String, nullable: true }) planName!: string | null;
  @ApiProperty({ type: 'integer', nullable: true }) lessonsTotal!: number | null;
  @ApiProperty({
    type: 'integer',
    nullable: true,
    description: 'Confirmed paid rights only, never future bookings or temporary admission limits',
  })
  lessonsRemaining!: number | null;
  @ApiProperty({ type: String, nullable: true, format: 'date' }) validFrom!: string | null;
  @ApiProperty({ type: String, nullable: true, format: 'date' }) validUntil!: string | null;
  @ApiProperty() isFrozen!: boolean;
  @ApiProperty({ type: String, nullable: true, format: 'date' }) frozenFrom!: string | null;
  @ApiProperty({ type: String, nullable: true, format: 'date' }) frozenUntil!: string | null;
  @ApiProperty({ enum: ['ACTIVE', 'EXPIRED', 'FROZEN', 'NONE'] }) status!:
    'ACTIVE' | 'EXPIRED' | 'FROZEN' | 'NONE';
}
export class PaymentHistoryItemDto {
  @ApiProperty({ format: 'uuid' }) paymentId!: string;
  @ApiProperty({ format: 'date-time' }) confirmedAt!: string;
  @ApiProperty({
    type: String,
    description:
      'Exact Decimal allocated to this subscription, at least two and up to four fraction digits',
  })
  amount!: string;
  @ApiProperty({
    pattern: '^[A-Z]{3}$',
    example: 'MDL',
    description: 'Actual CRM currency, including MDL; no conversion',
  })
  currency!: string;
  @ApiProperty() description!: string;
  @ApiProperty({ type: 'integer', nullable: true }) lessonsAdded!: number | null;
}
export class PaymentHistoryResponseDto {
  @ApiProperty({ type: [PaymentHistoryItemDto] }) items!: PaymentHistoryItemDto[];
  @ApiProperty({ type: 'integer' }) total!: number;
  @ApiProperty({ type: 'integer' }) page!: number;
  @ApiProperty({ type: 'integer' }) pageSize!: number;
}
export class StudentSubscriptionLedgerEntryDto {
  @ApiProperty({
    format: 'uuid',
    description:
      'Source operation ID; deduction uses the published LedgerEntry ID; freeze IDs are deterministic view IDs',
  })
  entryId!: string;
  @ApiProperty({ format: 'date' }) entryDate!: string;
  @ApiProperty({ enum: ['DEDUCTION', 'CREDIT', 'FREEZE', 'UNFREEZE'] }) type!:
    'DEDUCTION' | 'CREDIT' | 'FREEZE' | 'UNFREEZE';
  @ApiProperty({ type: String, description: 'Lesson quantities, not monetary account totals' })
  balanceBefore!: string;
  @ApiProperty({ type: String }) balanceAfter!: string;
  @ApiProperty() description!: string;
  @ApiProperty({ type: String, nullable: true, format: 'uuid' }) lessonId!: string | null;
}
export class StudentSubscriptionLedgerResponseDto {
  @ApiProperty({ type: [StudentSubscriptionLedgerEntryDto] })
  items!: StudentSubscriptionLedgerEntryDto[];
  @ApiProperty({ type: 'integer' }) total!: number;
  @ApiProperty({ type: 'integer' }) page!: number;
  @ApiProperty({ type: 'integer' }) pageSize!: number;
}
