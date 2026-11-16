import { SetMetadata } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { STRICT_INPUT_DTO } from '../../../openapi/dto-validation.pipe.js';

export const HOMEWORK_STATES = [
  'NOT_SUBMITTED',
  'AWAITING_REVIEW',
  'NEEDS_REVISION',
  'REVIEWED',
  'CANCELLED',
] as const;
export type HomeworkState = (typeof HOMEWORK_STATES)[number];
export const REVIEW_RESULTS = ['ACCEPTED', 'NEEDS_REVISION'] as const;

@SetMetadata(STRICT_INPUT_DTO, true)
export class IssueHomeworkDto {
  @ApiProperty({ minLength: 1, maxLength: 200 }) @IsString() @Length(1, 200) title!: string;
  @ApiProperty({ minLength: 1, maxLength: 5000, description: 'Plain text instructions' })
  @IsString()
  @Length(1, 5000)
  description!: string;
  @ApiPropertyOptional({ format: 'date-time', description: 'Must be in the future' })
  @IsOptional()
  @IsISO8601({ strict: true })
  dueAt?: string;
  @ApiPropertyOptional({
    format: 'uuid',
    description: "The teacher's own lesson of one enrollment",
  })
  @IsOptional()
  @IsUUID()
  lessonId?: string;
  @ApiProperty({ type: [String], format: 'uuid', minItems: 1, maxItems: 20 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  enrollmentIds!: string[];
  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    maxItems: 5,
    description: "Verified files from the teacher's material library; students get read access",
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  attachmentFileIds?: string[];
}

export class IssuedDeliveryDto {
  @ApiProperty({ format: 'uuid' }) deliveryId!: string;
  @ApiProperty({ format: 'uuid' }) enrollmentId!: string;
  @ApiProperty({ format: 'uuid' }) studentId!: string;
}
export class IssueHomeworkResponseDto {
  @ApiProperty({ format: 'uuid', description: 'Assignment id' }) id!: string;
  @ApiProperty({ type: [IssuedDeliveryDto] }) deliveries!: IssuedDeliveryDto[];
}

@SetMetadata(STRICT_INPUT_DTO, true)
export class ReviewHomeworkDto {
  @ApiProperty({ format: 'uuid', description: 'Must be the latest submission of the delivery' })
  @IsUUID()
  submissionId!: string;
  @ApiProperty({ enum: REVIEW_RESULTS })
  @IsIn(REVIEW_RESULTS)
  result!: (typeof REVIEW_RESULTS)[number];
  @ApiPropertyOptional({
    minLength: 5,
    maxLength: 2000,
    description: 'Required for NEEDS_REVISION',
  })
  @IsOptional()
  @IsString()
  @Length(5, 2000)
  comment?: string;
}
export class ReviewHomeworkResponseDto {
  @ApiProperty({ format: 'uuid', description: 'Review id' }) id!: string;
  @ApiProperty({ format: 'uuid' }) deliveryId!: string;
  @ApiProperty({ format: 'uuid' }) submissionId!: string;
  @ApiProperty({ enum: REVIEW_RESULTS }) result!: (typeof REVIEW_RESULTS)[number];
}

@SetMetadata(STRICT_INPUT_DTO, true)
export class TeacherHomeworkQueryDto {
  @ApiPropertyOptional({ enum: HOMEWORK_STATES })
  @IsOptional()
  @IsIn(HOMEWORK_STATES)
  state?: HomeworkState;
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

export class TeacherHomeworkItemDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() deliveryId!: string;
  @ApiProperty() @IsString() title!: string;
  @ApiProperty({ format: 'date-time' }) issuedAt!: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) dueAt!: string | null;
  @ApiProperty({ enum: HOMEWORK_STATES }) state!: HomeworkState;
  @ApiProperty({ format: 'uuid' }) @IsUUID() studentId!: string;
  @ApiProperty() @IsString() studentName!: string;
  @ApiProperty() @IsString() subjectName!: string;
  @ApiProperty({ type: 'integer', minimum: 0 }) submissionCount!: number;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) latestSubmittedAt!:
    string | null;
  @ApiProperty({ description: 'The latest submission came after dueAt' })
  @IsBoolean()
  isLate!: boolean;
}
export class TeacherHomeworkPageDto {
  @ApiProperty({ type: [TeacherHomeworkItemDto] }) @IsArray() items!: TeacherHomeworkItemDto[];
  @ApiProperty({ type: String, nullable: true }) nextCursor!: string | null;
}

export class TeacherHomeworkReviewDto {
  @ApiProperty({ format: 'uuid' }) reviewId!: string;
  @ApiProperty({ enum: REVIEW_RESULTS }) result!: (typeof REVIEW_RESULTS)[number];
  @ApiProperty({ type: String, nullable: true }) comment!: string | null;
  @ApiProperty({ format: 'date-time' }) reviewedAt!: string;
}
export class TeacherHomeworkSubmissionDto {
  @ApiProperty({ format: 'uuid' }) submissionId!: string;
  @ApiProperty({ type: 'integer' }) version!: number;
  @ApiProperty({ format: 'date-time' }) submittedAt!: string;
  @ApiProperty({ description: "The student's text answer" }) text!: string;
  @ApiProperty({ type: TeacherHomeworkReviewDto, nullable: true })
  review!: TeacherHomeworkReviewDto | null;
}
export class TeacherHomeworkCardDto extends TeacherHomeworkItemDto {
  @ApiProperty() @IsString() description!: string;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) lessonId!: string | null;
  @ApiProperty({ type: [TeacherHomeworkSubmissionDto], description: 'Newest version first' })
  submissions!: TeacherHomeworkSubmissionDto[];
  @ApiProperty({ description: 'The latest submission has no review yet' }) canReview!: boolean;
}
