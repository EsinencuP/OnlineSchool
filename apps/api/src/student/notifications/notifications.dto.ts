import { Injectable } from '@nestjs/common';
import type { PipeTransform } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Min, Max } from 'class-validator';
import { HistoryQueryPipe } from '../history/history.dto.js';
import type { HistoryPage } from '../history/history.dto.js';
import { object } from '../../modules/identity/input.js';
import { domainError, fail } from '../../core/errors/domain-error.js';
export type NotificationsQuery = HistoryPage & { locale?: 'ru' | 'ro' };
export const NOTIFICATION_TYPES = [
  'LESSON_SCHEDULED',
  'RESCHEDULE_DECLINED',
  'DISPUTE_ACCEPTED',
  'DISPUTE_REJECTED',
  'MANUAL_MESSAGE',
  'SUBSCRIPTION_CREATED',
  'SUBSCRIPTION_RENEWED',
  'SUBSCRIPTION_FROZEN',
  'SUBSCRIPTION_UNFROZEN',
  'SUBSCRIPTION_EXPIRED',
  'ACCOUNT_CREATED',
  'HOMEWORK_REVIEWED',
  'HOMEWORK_NEEDS_REVISION',
  'LESSON_RESCHEDULED',
  'LESSON_CANCELLED',
  'REPORT_READY',
  'SUBSCRIPTION_EXPIRING',
  'PAYMENT_CONFIRMED',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
export class NotificationsQueryDto {
  @ApiPropertyOptional({ enum: ['ru', 'ro'], default: 'ru' }) locale?: 'ru' | 'ro';
  @ApiPropertyOptional({ type: 'integer', minimum: 1, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;
  @ApiPropertyOptional({ type: 'integer', minimum: 1, maximum: 100, default: 30 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
@Injectable()
export class NotificationsQueryPipe implements PipeTransform {
  transform(value: unknown): NotificationsQuery {
    const input = object(value, ['page', 'pageSize', 'locale']);
    if (input.locale !== undefined && input.locale !== 'ru' && input.locale !== 'ro')
      return fail(domainError('INVALID_INPUT', 400));
    const { locale, ...paging } = input;
    const query = new HistoryQueryPipe().transform(paging);
    // The common parser validates unknown keys, number strings and bounds first.
    return {
      ...query,
      ...(locale === undefined ? {} : { locale: locale as 'ru' | 'ro' }),
      pageSize: (value as { pageSize?: unknown })?.pageSize === undefined ? 30 : query.pageSize,
    };
  }
}
export class NotificationItemDto {
  @ApiProperty({ format: 'uuid' }) notificationId!: string;
  @ApiProperty({ enum: NOTIFICATION_TYPES }) type!: NotificationType;
  @ApiProperty() title!: string;
  @ApiProperty() body!: string;
  @ApiProperty() isRead!: boolean;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'Public entity identifiers only; never capability URLs or private notes',
  })
  payload!: Record<string, unknown>;
}
export class NotificationsResponseDto {
  @ApiProperty({ type: [NotificationItemDto] }) items!: NotificationItemDto[];
  @ApiProperty({ type: 'integer' }) total!: number;
  @ApiProperty({ type: 'integer' }) unreadCount!: number;
  @ApiProperty({ type: 'integer' }) page!: number;
  @ApiProperty({ type: 'integer' }) pageSize!: number;
}
export class UnreadCountDto {
  @ApiProperty({ type: 'integer' }) unreadCount!: number;
}
