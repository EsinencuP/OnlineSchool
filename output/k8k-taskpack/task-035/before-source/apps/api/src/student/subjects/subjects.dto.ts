import { ApiProperty } from '@nestjs/swagger';

const statuses = ['ACTIVE', 'FROZEN', 'EXPIRED', 'LIMITED', 'NONE'] as const;
const reasons = [
  'PAID_RIGHTS',
  'FROZEN',
  'PERIOD_EXPIRED',
  'ENROLLMENT_ENDED',
  'ENROLLMENT_PAUSED',
  'NO_SUBSCRIPTION',
  'TEMPORARY_ADMISSION',
  'PAYMENT_OR_ADMISSION_REQUIRED',
  'NO_PAID_RIGHTS',
  'RIGHTS_UNKNOWN',
] as const;

export class StudentSubjectCapabilitiesDto {
  @ApiProperty() canViewHomework!: boolean;
  @ApiProperty() canViewMaterials!: boolean;
  @ApiProperty() canOpenSubscription!: boolean;
  @ApiProperty({
    description: 'Existing lessons view only; a specific Meet action is checked separately.',
  })
  canOpenLessons!: boolean;
}

export class StudentTemporaryAdmissionDto {
  @ApiProperty({ type: 'integer', minimum: 1 }) maxLessons!: number;
  @ApiProperty({ type: 'integer', minimum: 1 }) lessonsRemaining!: number;
  @ApiProperty({ format: 'date-time' }) validUntil!: string;
}

export class StudentSubjectSubscriptionDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Owned financial period accepted by subscription, payments and ledger GETs.',
  })
  subscriptionId!: string;
  @ApiProperty({
    type: String,
    nullable: true,
    format: 'uuid',
    description: 'Grouping identity only; do not pass to financial-period GETs.',
  })
  managerSubscriptionId!: string | null;
  @ApiProperty({ format: 'uuid' }) enrollmentId!: string;
  @ApiProperty({ enum: statuses }) displayStatus!: (typeof statuses)[number];
  @ApiProperty({ enum: reasons }) reasonCode!: (typeof reasons)[number];
  @ApiProperty({ type: String, nullable: true, format: 'date-time' }) validUntil!: string | null;
  @ApiProperty({ type: String, nullable: true, format: 'date-time' }) frozenUntil!: string | null;
  @ApiProperty({
    type: 'integer',
    nullable: true,
    minimum: 0,
    description:
      'Confirmed rights for the started periods of this plan. Null means the balance cannot be established.',
  })
  paidLessonsRemaining!: number | null;
  @ApiProperty() liveAccess!: boolean;
  @ApiProperty({ type: StudentTemporaryAdmissionDto, nullable: true })
  temporaryAdmission!: StudentTemporaryAdmissionDto | null;
}

export class StudentSubjectDto {
  @ApiProperty({ format: 'uuid' }) subjectId!: string;
  @ApiProperty() subjectName!: string;
  @ApiProperty({ type: 'array', items: { type: 'string', format: 'uuid' } })
  enrollmentIds!: string[];
  @ApiProperty({ enum: statuses }) displayStatus!: (typeof statuses)[number];
  @ApiProperty({ enum: reasons }) reasonCode!: (typeof reasons)[number];
  @ApiProperty({
    description: 'A subject-level access basis exists. Never authorizes a specific Meet link.',
  })
  liveAccess!: boolean;
  @ApiProperty({ type: StudentSubjectCapabilitiesDto })
  capabilities!: StudentSubjectCapabilitiesDto;
  @ApiProperty({ type: [StudentSubjectSubscriptionDto] })
  subscriptions!: StudentSubjectSubscriptionDto[];
}

export class StudentSubjectsResponseDto {
  @ApiProperty({ format: 'date-time' }) generatedAt!: string;
  @ApiProperty({ type: [StudentSubjectDto] }) items!: StudentSubjectDto[];
}
