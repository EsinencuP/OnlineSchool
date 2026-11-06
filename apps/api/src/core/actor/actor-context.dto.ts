import { ApiProperty } from '@nestjs/swagger';

export const STAFF_ROLES = ['TEACHER', 'MANAGER', 'DIRECTOR', 'TECH_OPERATOR'] as const;
export class StaffActorContextDto {
  @ApiProperty({ format: 'uuid' }) accountId!: string;
  @ApiProperty({ enum: STAFF_ROLES }) role!: (typeof STAFF_ROLES)[number];
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) staffProfileId!: string | null;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) teacherProfileId!: string | null;
  @ApiProperty() displayName!: string;
  @ApiProperty() timezone!: string;
  @ApiProperty({ enum: ['SCHOOL_CONFIGURATION', 'SCHOOL_DEFAULT'] })
  timezoneSource!: 'SCHOOL_CONFIGURATION' | 'SCHOOL_DEFAULT';
  @ApiProperty({ format: 'date-time', description: 'Server DB clock, not a ledger confirmation' })
  asOf!: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) accountUpdatedAt!:
    string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) profileUpdatedAt!:
    string | null;
}

export class StaffActionEligibilityDto {
  @ApiProperty({ enum: ['lesson.start', 'payment.request-approval', 'payment.confirm'] })
  action!: 'lesson.start' | 'payment.request-approval' | 'payment.confirm';
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) objectId!: string | null;
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Null when command has no revision precondition; updated_at is not a revision',
  })
  revision!: string | null;
  @ApiProperty() allowed!: boolean;
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Stable code; unavailable does not disclose foreign object state',
  })
  reason!: string | null;
  @ApiProperty({ format: 'date-time' }) asOf!: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) sourceUpdatedAt!:
    string | null;
}
