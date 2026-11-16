import { SetMetadata } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { STRICT_INPUT_DTO } from '../../../openapi/dto-validation.pipe.js';

export const NOTIFICATION_TYPES = [
  'LESSON_SCHEDULED',
  'LESSON_RESCHEDULED',
  'LESSON_CANCELLED',
  'HOMEWORK_SUBMITTED',
  'CHECKPOINT_DUE',
  'SCHEDULE_REQUEST_RESOLVED',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
export const TARGET_KINDS = ['LESSON', 'HOMEWORK', 'CHECKPOINT', 'SCHEDULE_REQUEST'] as const;

@SetMetadata(STRICT_INPUT_DTO, true)
export class TeacherNotificationsQueryDto {
  @ApiPropertyOptional({ enum: ['ALL', 'UNREAD'], default: 'ALL' })
  @IsOptional()
  @IsIn(['ALL', 'UNREAD'])
  state?: 'ALL' | 'UNREAD';
  @ApiPropertyOptional({ type: 'integer', minimum: 1, maximum: 50, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
  @ApiPropertyOptional({ description: 'Opaque cursor from the previous page' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  cursor?: string;
}

export class TeacherNotificationDto {
  @ApiProperty({ description: 'Stable event key; use it to mark the event read' }) key!: string;
  @ApiProperty({ enum: NOTIFICATION_TYPES }) type!: NotificationType;
  @ApiProperty({ format: 'date-time' }) occurredAt!: string;
  @ApiProperty() read!: boolean;
  @ApiProperty() studentName!: string;
  @ApiProperty() subjectName!: string;
  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'Lesson time when the event is about a lesson',
  })
  lessonAt!: string | null;
  @ApiProperty({ enum: TARGET_KINDS, description: 'Where the notification leads' })
  targetKind!: (typeof TARGET_KINDS)[number];
  @ApiProperty({ format: 'uuid' }) targetId!: string;
}
export class TeacherNotificationPageDto {
  @ApiProperty({ type: [TeacherNotificationDto] }) @IsArray() items!: TeacherNotificationDto[];
  @ApiProperty({ type: String, nullable: true }) nextCursor!: string | null;
}
export class TeacherNotificationSummaryDto {
  @ApiProperty({
    type: 'integer',
    minimum: 0,
    description: 'Unread events of the last 90 days (capped at 500)',
  })
  unreadCount!: number;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) latestAt!: string | null;
}

@SetMetadata(STRICT_INPUT_DTO, true)
export class MarkReadDto {
  @ApiProperty({ type: [String], minItems: 1, maxItems: 50 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ArrayUnique()
  @Matches(/^[a-z-]+:[0-9a-f-]{36}$/, { each: true })
  keys!: string[];
}
export class MarkReadResponseDto {
  @ApiProperty({ type: 'integer', description: 'Events newly marked read' }) marked!: number;
}
