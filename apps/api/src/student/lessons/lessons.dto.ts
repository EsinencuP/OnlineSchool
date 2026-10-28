import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class LessonsQueryDto {
  @ApiPropertyOptional({ enum: ['today', 'week', 'month', 'archive'], default: 'week' })
  @IsOptional()
  @IsIn(['today', 'week', 'month', 'archive'])
  period?: 'today' | 'week' | 'month' | 'archive';
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
  @ApiPropertyOptional({ pattern: '^(?!0000)[0-9]{4}-(0[1-9]|1[0-2])$', example: '2025-09' })
  @IsOptional()
  @Matches(/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/)
  month?: string;
}
// Preserve real unresolved CRM states instead of fabricating completion/cancellation.
export const STUDENT_LESSON_STATUSES = [
  'SCHEDULED',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
  'STAR_PENDING',
  'DISPUTED',
] as const;
export type StudentLessonStatus = (typeof STUDENT_LESSON_STATUSES)[number];
export class LessonCardDto {
  @ApiProperty({ format: 'uuid' }) lessonId!: string;
  @ApiProperty({ format: 'date-time' }) scheduledAt!: string;
  @ApiProperty() durationMinutes!: number;
  @ApiProperty() teacherName!: string;
  @ApiProperty() subjectName!: string;
  @ApiProperty({ enum: STUDENT_LESSON_STATUSES }) status!: StudentLessonStatus;
  @ApiProperty() canJoin!: boolean;
  @ApiProperty({ type: String, nullable: true }) meetLink!: string | null;
  @ApiProperty() canRequestReschedule!: boolean;
}
export class LessonsResponseDto {
  @ApiProperty({ type: [LessonCardDto] }) items!: LessonCardDto[];
  @ApiProperty({ type: 'integer' }) total!: number;
  @ApiProperty({ type: 'integer' }) page!: number;
  @ApiProperty({ type: 'integer' }) pageSize!: number;
}
export class RescheduleRequestDto {
  @ApiProperty({ minLength: 1, maxLength: 500 })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;
  @ApiProperty({ format: 'date', pattern: '^(?!0000)[0-9]{4}-[0-9]{2}-[0-9]{2}$' })
  @IsString()
  @Matches(/^(?!0000)\d{4}-\d{2}-\d{2}$/)
  preferredDate!: string;
}
export class RescheduleRequestResponseDto {
  @ApiProperty({ format: 'uuid' }) crmTaskId!: string;
  @ApiProperty({ enum: ['CREATED'] }) status!: 'CREATED';
}
