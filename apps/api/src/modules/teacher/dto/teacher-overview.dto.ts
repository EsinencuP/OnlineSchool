import { ApiProperty } from '@nestjs/swagger';

export class OverviewLessonDto {
  @ApiProperty({ format: 'uuid' }) lessonId!: string;
  @ApiProperty({ format: 'date-time' }) startsAt!: string;
  @ApiProperty({ enum: ['SCHEDULED', 'STAR_PENDING', 'CONDUCTED', 'CANCELLED', 'DISPUTED'] })
  status!: string;
}
export class OverviewHomeworkDto {
  @ApiProperty({ type: 'integer' }) notSubmitted!: number;
  @ApiProperty({ type: 'integer' }) awaitingReview!: number;
  @ApiProperty({ type: 'integer' }) needsRevision!: number;
  @ApiProperty({ type: 'integer' }) reviewed!: number;
}
export class OverviewSkillsDto {
  @ApiProperty({ type: 'integer' }) notStudied!: number;
  @ApiProperty({ type: 'integer' }) familiarizing!: number;
  @ApiProperty({ type: 'integer' }) practicing!: number;
  @ApiProperty({ type: 'integer' }) applying!: number;
}
export class TeacherStudentOverviewDto {
  @ApiProperty({ format: 'uuid' }) enrollmentId!: string;
  @ApiProperty({ format: 'uuid' }) studentId!: string;
  @ApiProperty() studentName!: string;
  @ApiProperty() subjectName!: string;
  @ApiProperty({ type: 'integer' }) confirmedLessons!: number;
  @ApiProperty({
    type: 'integer',
    minimum: 1,
    maximum: 4,
    description: 'Confirmed lessons until the next skill review',
  })
  lessonsToNextReview!: number;
  @ApiProperty({ type: [OverviewLessonDto], description: 'Next lessons of this teacher (max 5)' })
  upcomingLessons!: OverviewLessonDto[];
  @ApiProperty({
    type: [OverviewLessonDto],
    description: 'Latest past lessons of this teacher (max 5)',
  })
  recentLessons!: OverviewLessonDto[];
  @ApiProperty({ type: OverviewHomeworkDto }) homework!: OverviewHomeworkDto;
  @ApiProperty({ type: OverviewSkillsDto }) skills!: OverviewSkillsDto;
  @ApiProperty({ type: 'integer' }) activeGoals!: number;
  @ApiProperty({
    type: 'integer',
    description: 'Skill reviews and reports waiting for this teacher',
  })
  pendingCheckpoints!: number;
}
