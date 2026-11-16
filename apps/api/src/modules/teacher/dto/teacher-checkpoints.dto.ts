import { SetMetadata } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { STRICT_INPUT_DTO } from '../../../openapi/dto-validation.pipe.js';

export const CHECKPOINT_TYPES = ['LESSON_4', 'LESSON_8'] as const;
export const CHECKPOINT_STATES = ['PENDING', 'COMPLETED'] as const;
export type CheckpointState = (typeof CHECKPOINT_STATES)[number];

@SetMetadata(STRICT_INPUT_DTO, true)
export class TeacherCheckpointsQueryDto {
  @ApiPropertyOptional({ enum: CHECKPOINT_STATES })
  @IsOptional()
  @IsIn(CHECKPOINT_STATES)
  state?: CheckpointState;
  @ApiPropertyOptional({ enum: CHECKPOINT_TYPES })
  @IsOptional()
  @IsIn(CHECKPOINT_TYPES)
  type?: (typeof CHECKPOINT_TYPES)[number];
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

export class TeacherCheckpointItemDto {
  @ApiProperty({ format: 'uuid' }) checkpointId!: string;
  @ApiProperty({ enum: CHECKPOINT_TYPES }) type!: (typeof CHECKPOINT_TYPES)[number];
  @ApiProperty({ type: 'integer' }) confirmedLessonCount!: number;
  @ApiProperty({ format: 'date-time' }) triggeredAt!: string;
  @ApiProperty({ enum: CHECKPOINT_STATES }) state!: CheckpointState;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) completedAt!: string | null;
  @ApiProperty({ format: 'uuid' }) enrollmentId!: string;
  @ApiProperty({ format: 'uuid' }) studentId!: string;
  @ApiProperty() studentName!: string;
  @ApiProperty() subjectName!: string;
}
export class TeacherCheckpointPageDto {
  @ApiProperty({ type: [TeacherCheckpointItemDto] }) @IsArray() items!: TeacherCheckpointItemDto[];
  @ApiProperty({ type: String, nullable: true }) nextCursor!: string | null;
}

export class ReportContentDto {
  @ApiProperty({ minLength: 1, maxLength: 5000 })
  @IsString()
  @Length(1, 5000)
  achievements!: string;
  @ApiProperty({ minLength: 1, maxLength: 5000 }) @IsString() @Length(1, 5000) growthAreas!: string;
  @ApiProperty({ minLength: 1, maxLength: 5000 })
  @IsString()
  @Length(1, 5000)
  recommendations!: string;
  @ApiProperty({ minLength: 1, maxLength: 200 })
  @IsString()
  @Length(1, 200)
  teacherSignature!: string;
}
export class TeacherReportDto extends ReportContentDto {
  @ApiProperty({ format: 'uuid' }) reportId!: string;
  @ApiProperty({ enum: ['DRAFT', 'PUBLISHED'] }) status!: 'DRAFT' | 'PUBLISHED';
  @ApiProperty({ format: 'date-time' }) periodStart!: string;
  @ApiProperty({ format: 'date-time' }) periodEnd!: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) publishedAt!: string | null;
}
export class TeacherCheckpointCardDto extends TeacherCheckpointItemDto {
  @ApiProperty({ type: String, nullable: true }) teacherSummary!: string | null;
  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'Frozen skill snapshot (LESSON_4, once completed)',
  })
  snapshotId!: string | null;
  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'Suggested report period start (last eight lessons)',
  })
  suggestedPeriodStart!: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) suggestedPeriodEnd!:
    string | null;
  @ApiProperty({ type: TeacherReportDto, nullable: true }) report!: TeacherReportDto | null;
}

@SetMetadata(STRICT_INPUT_DTO, true)
export class CompleteCheckpointDto {
  @ApiProperty({
    minLength: 5,
    maxLength: 2000,
    description: 'Shown with the frozen skill snapshot',
  })
  @IsString()
  @Length(5, 2000)
  teacherSummary!: string;
}
export class CompleteCheckpointResponseDto {
  @ApiProperty({ format: 'uuid', description: 'Checkpoint id' }) id!: string;
  @ApiProperty({ format: 'date-time' }) completedAt!: string;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) snapshotId!: string | null;
}

@SetMetadata(STRICT_INPUT_DTO, true)
export class SaveReportDto extends ReportContentDto {}
export class SaveReportResponseDto {
  @ApiProperty({ format: 'uuid', description: 'Report id' }) id!: string;
  @ApiProperty({ enum: ['DRAFT'] }) status!: 'DRAFT';
}
export class PublishReportResponseDto {
  @ApiProperty({ format: 'uuid', description: 'Report id' }) id!: string;
  @ApiProperty({ enum: ['PUBLISHED'] }) status!: 'PUBLISHED';
  @ApiProperty({ format: 'date-time' }) publishedAt!: string;
}
