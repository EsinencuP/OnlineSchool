import { Injectable } from '@nestjs/common';
import type { PipeTransform } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Min, Max } from 'class-validator';
import { HistoryQueryPipe } from '../history/history.dto.js';
import type { HistoryPage } from '../history/history.dto.js';
export const NOTIFICATION_TYPES = [
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
  transform(value: unknown): HistoryPage {
    const query = new HistoryQueryPipe().transform(value);
    // The common parser validates unknown keys, number strings and bounds first.
    return {
      ...query,
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
