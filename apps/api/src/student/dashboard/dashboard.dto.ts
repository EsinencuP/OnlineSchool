import { ApiProperty } from '@nestjs/swagger';

export class NextLessonDto {
  @ApiProperty({ format: 'uuid' }) lessonId!: string;
  @ApiProperty({ format: 'date-time' }) scheduledAt!: string;
  @ApiProperty({ type: 'integer', minimum: 1 }) durationMinutes!: number;
  @ApiProperty() teacherName!: string;
  @ApiProperty() subjectName!: string;
  @ApiProperty({ type: String, nullable: true }) meetLink!: string | null;
  @ApiProperty() canJoin!: boolean;
}
export class HomeworkCountsDto {
  @ApiProperty({ type: 'integer' }) notSubmitted!: number;
  @ApiProperty({ type: 'integer' }) submitted!: number;
  @ApiProperty({ type: 'integer' }) needsRevision!: number;
  @ApiProperty({ type: 'integer' }) total!: number;
}
export class SubscriptionSummaryDto {
  @ApiProperty({ type: 'integer' }) lessonsRemaining!: number;
  @ApiProperty({ type: String, format: 'date', nullable: true }) validUntil!: string | null;
  @ApiProperty() isFrozen!: boolean;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) frozenUntil!: string | null;
}
export class SkillProgressDto {
  @ApiProperty({ type: 'integer' }) familiarizing!: number;
  @ApiProperty({ type: 'integer' }) practicing!: number;
  @ApiProperty({ type: 'integer' }) applying!: number;
  @ApiProperty({ type: 'integer' }) notStudied!: number;
}
export class DashboardResponseDto {
  @ApiProperty({ type: NextLessonDto, nullable: true }) nextLesson!: NextLessonDto | null;
  @ApiProperty({ type: HomeworkCountsDto }) homework!: HomeworkCountsDto;
  @ApiProperty({ type: SubscriptionSummaryDto, nullable: true })
  subscription!: SubscriptionSummaryDto | null;
  @ApiProperty({ type: SkillProgressDto }) skillProgress!: SkillProgressDto;
  @ApiProperty({ format: 'date-time' }) generatedAt!: string;
}
