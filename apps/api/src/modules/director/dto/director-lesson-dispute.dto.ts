import { SetMetadata } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
  Max,
} from 'class-validator';
import { STRICT_INPUT_DTO } from '../../../openapi/dto-validation.pipe.js';

export const LESSON_DISPUTE_RESULTS = ['CONDUCTED', 'NOT_CONDUCTED'] as const;
export type LessonDisputeResult = (typeof LESSON_DISPUTE_RESULTS)[number];

@SetMetadata(STRICT_INPUT_DTO, true)
export class ResolveLessonDisputeDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() reportId!: string;
  @ApiProperty({ enum: LESSON_DISPUTE_RESULTS })
  @IsIn(LESSON_DISPUTE_RESULTS)
  result!: LessonDisputeResult;
  @ApiProperty({ maxLength: 200 })
  @IsString()
  @Length(1, 200)
  evidenceReference!: string;
  @ApiProperty({ minLength: 5, maxLength: 500 })
  @IsString()
  @Length(5, 500)
  reason!: string;
  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    description: 'Documented UTC start; required only when the recorded start is missing.',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  actualStartedAt?: string;
  @ApiPropertyOptional({
    type: 'integer',
    minimum: 1,
    maximum: 480,
    description: 'Documented duration for a conducted lesson.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(480)
  durationMin?: number;
  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    description: 'Existing director admission applicable at actual start.',
  })
  @IsOptional()
  @IsUUID()
  temporaryAccessPermissionId?: string;
}

export class LessonDisputeDecisionDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) lessonId!: string;
  @ApiProperty({ format: 'uuid' }) reportId!: string;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) outcomeId!: string | null;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) originPeriodId!: string | null;
  @ApiProperty({ format: 'uuid' }) directorId!: string;
  @ApiProperty({ enum: LESSON_DISPUTE_RESULTS }) result!: LessonDisputeResult;
  @ApiProperty() reconstructedSnapshot!: boolean;
  @ApiProperty({ format: 'date-time' }) decidedAt!: string;
  @ApiProperty({
    description: 'Confirmed facts will require a separate approved payroll accrual',
  })
  requiresFinancialDecision!: boolean;
}

export class LessonDisputeReviewDto {
  @ApiProperty({ format: 'uuid' }) lessonId!: string;
  @ApiProperty({ format: 'uuid' }) reportId!: string;
  @ApiProperty({ format: 'uuid' }) studentId!: string;
  @ApiProperty({ format: 'uuid' }) teacherId!: string;
  @ApiProperty({ format: 'date-time' }) scheduledAt!: string;
  @ApiProperty({ format: 'date-time' }) scheduledEndAt!: string;
  @ApiProperty({ format: 'date-time' }) reportedAt!: string;
  @ApiProperty() reportNote!: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) actualStartedAt!:
    string | null;
  @ApiProperty({ type: LessonDisputeDecisionDto, nullable: true })
  decision!: LessonDisputeDecisionDto | null;
  @ApiProperty({ type: String, nullable: true }) decisionEvidenceReference!: string | null;
  @ApiProperty({ type: String, nullable: true }) decisionReason!: string | null;
}
