import { Injectable } from '@nestjs/common';
import type { PipeTransform } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min, Max, MinLength, MaxLength } from 'class-validator';
import { object } from '../../modules/identity/input.js';
import { LessonsQueryPipe } from '../lessons/lesson-period.js';

export class HistoryQueryDto {
  @ApiPropertyOptional({ type: 'integer', minimum: 1, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;
  @ApiPropertyOptional({ type: 'integer', minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
export type HistoryPage = { page: number; pageSize: number };
@Injectable()
export class HistoryQueryPipe implements PipeTransform {
  transform(value: unknown): HistoryPage {
    const input = object(value, ['page', 'pageSize']),
      parsed = new LessonsQueryPipe().transform({ ...input, period: 'archive' });
    return { page: parsed.page, pageSize: parsed.pageSize };
  }
}
export class LessonHistoryItemDto {
  @ApiProperty({ format: 'uuid' }) lessonId!: string;
  @ApiProperty({ format: 'date-time' }) scheduledAt!: string;
  @ApiProperty() durationMinutes!: number;
  @ApiProperty() teacherName!: string;
  @ApiProperty() subjectName!: string;
  @ApiProperty({ enum: ['COMPLETED', 'NO_SHOW'] }) attendanceStatus!: 'COMPLETED' | 'NO_SHOW';
  @ApiProperty({
    description: 'Current uncancelled quantitative consumption backed by a published ledger entry',
  })
  lessonDeducted!: boolean;
  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'Subscription lessons before deduction, immutable Decimal string; null for unknown legacy snapshots',
  })
  balanceBefore!: string | null;
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Subscription lessons after deduction, immutable Decimal string',
  })
  balanceAfter!: string | null;
  @ApiProperty() canDispute!: boolean;
}
export class LessonHistoryResponseDto {
  @ApiProperty({ type: [LessonHistoryItemDto] }) items!: LessonHistoryItemDto[];
  @ApiProperty({ type: 'integer' }) total!: number;
  @ApiProperty({ type: 'integer' }) page!: number;
  @ApiProperty({ type: 'integer' }) pageSize!: number;
}
export class DisputeRequestDto {
  @ApiProperty({ minLength: 10, maxLength: 1000 })
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  description!: string;
}
export class DisputeResponseDto {
  @ApiProperty({ format: 'uuid' }) crmTaskId!: string;
  @ApiProperty({ enum: ['CREATED'] }) status!: 'CREATED';
}
