import { SetMetadata } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { STRICT_INPUT_DTO } from '../../../openapi/dto-validation.pipe.js';

export const JOURNAL_STATES = [
  'AWAITING_REPORT',
  'AWAITING_CONFIRMATION',
  'CONDUCTED',
  'CANCELLED',
  'DISPUTED',
] as const;
export type JournalState = (typeof JOURNAL_STATES)[number];
export const REPORT_RESULTS = ['CONDUCTED', 'NOT_CONDUCTED', 'DISPUTED'] as const;

@SetMetadata(STRICT_INPUT_DTO, true)
export class TeacherJournalQueryDto {
  @ApiPropertyOptional({ enum: JOURNAL_STATES })
  @IsOptional()
  @IsIn(JOURNAL_STATES)
  state?: JournalState;
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
  @MaxLength(200)
  cursor?: string;
}

export class TeacherJournalItemDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() lessonId!: string;
  @ApiProperty({ format: 'date-time' }) startsAt!: string;
  @ApiProperty({ format: 'date-time' }) endsAt!: string;
  @ApiProperty({ enum: JOURNAL_STATES }) state!: JournalState;
  @ApiProperty({ enum: ['REGULAR', 'TRIAL'] }) kind!: 'REGULAR' | 'TRIAL';
  @ApiProperty({ format: 'uuid' }) @IsUUID() studentId!: string;
  @ApiProperty() @IsString() studentName!: string;
  @ApiProperty() @IsString() subjectName!: string;
  @ApiProperty({ format: 'date-time', description: 'Lesson end + 24 hours' })
  reportDeadlineAt!: string;
  @ApiProperty({ description: 'AWAITING_REPORT and past the 24 hour deadline' })
  @IsBoolean()
  overdue!: boolean;
  @ApiProperty({
    enum: REPORT_RESULTS,
    nullable: true,
    description: 'Latest report of this lesson version',
  })
  latestReportResult!: (typeof REPORT_RESULTS)[number] | null;
}

export class TeacherJournalPageDto {
  @ApiProperty({ type: [TeacherJournalItemDto] }) @IsArray() items!: TeacherJournalItemDto[];
  @ApiProperty({ type: String, nullable: true }) nextCursor!: string | null;
  @ApiProperty({ format: 'date-time' }) asOf!: string;
}

export class TeacherLessonReportDto {
  @ApiProperty({ format: 'uuid' }) reportId!: string;
  @ApiProperty({ type: 'integer' }) version!: number;
  @ApiProperty({ enum: REPORT_RESULTS }) result!: (typeof REPORT_RESULTS)[number];
  @ApiProperty() studentNoShow!: boolean;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) actualStartedAt!:
    string | null;
  @ApiProperty({ type: 'integer', nullable: true }) durationMin!: number | null;
  @ApiProperty() note!: string;
  @ApiProperty({ format: 'date-time' }) reportedAt!: string;
  @ApiProperty({ description: 'Latest report of the current lesson version' }) current!: boolean;
}

export class TeacherConfirmedOutcomeDto {
  @ApiProperty({ format: 'date-time' }) confirmedAt!: string;
  @ApiProperty({ format: 'date-time' }) actualStartedAt!: string;
  @ApiProperty({ type: 'integer' }) durationMin!: number;
}

export class TeacherLessonCardDto extends TeacherJournalItemDto {
  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'Server-recorded actual start; a CONDUCTED report must use exactly this value',
  })
  actualStartedAt!: string | null;
  @ApiProperty({ description: 'The lesson has ended and may still receive a (new) report' })
  canReport!: boolean;
  @ApiProperty({ type: [TeacherLessonReportDto] }) reports!: TeacherLessonReportDto[];
  @ApiProperty({ type: TeacherConfirmedOutcomeDto, nullable: true })
  confirmedOutcome!: TeacherConfirmedOutcomeDto | null;
}
