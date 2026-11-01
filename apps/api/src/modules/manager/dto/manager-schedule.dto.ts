import { SetMetadata } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { LessonStatus } from '@online-school/db';
import { STRICT_INPUT_DTO } from '../../../openapi/dto-validation.pipe.js';
import { INSTANT } from '../../schedule/manager/policy.js';
import type { ChangeInitiator } from '../../schedule/manager/contracts.js';
import { MEET_LINK_REGEX as MEET } from '../../schedule/meet-link.js';
@SetMetadata(STRICT_INPUT_DTO, true)
export class EmptyManagerScheduleDto {}
@SetMetadata(STRICT_INPUT_DTO, true)
export class ListManagerScheduleDto {
  @ApiPropertyOptional({ enum: ['REGULAR', 'TRIAL'] })
  @IsOptional()
  @IsIn(['REGULAR', 'TRIAL'])
  kind?: 'REGULAR' | 'TRIAL';
  @ApiProperty({ format: 'date-time' })
  @IsISO8601({ strict: true })
  @Matches(INSTANT)
  from!: string;
  @ApiProperty({ format: 'date-time' }) @IsISO8601({ strict: true }) @Matches(INSTANT) to!: string;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() studentId?: string;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() teacherId?: string;
  @ApiPropertyOptional({ enum: LessonStatus })
  @IsOptional()
  @IsEnum(LessonStatus)
  status?: LessonStatus;
}
@SetMetadata(STRICT_INPUT_DTO, true)
export class CreateManagerLessonDto {
  @ApiPropertyOptional({
    enum: ['REGULAR', 'TRIAL'],
    description: 'TRIAL is scheduled atomically through the lead trial endpoint.',
  })
  @IsOptional()
  @IsIn(['REGULAR', 'TRIAL'])
  kind?: 'REGULAR' | 'TRIAL';
  @ApiProperty({ format: 'uuid' }) @IsUUID() teacherId!: string;
  @ApiProperty({ format: 'date-time' })
  @IsISO8601({ strict: true })
  @Matches(INSTANT)
  startsAt!: string;
  @ApiProperty({ enum: [30, 45, 60, 90] }) @IsIn([30, 45, 60, 90]) durationMinutes!: number;
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Managed subscription (study direction). Required if multiple active subscriptions exist.',
  })
  @IsOptional()
  @IsUUID()
  subscriptionId?: string;
  @ApiPropertyOptional({ pattern: MEET.source })
  @IsOptional()
  @Matches(MEET, { message: 'INVALID_MEET_LINK' })
  meetLink?: string;
}
@SetMetadata(STRICT_INPUT_DTO, true)
export class RescheduleManagerLessonDto {
  @ApiProperty({ format: 'date-time' })
  @IsISO8601({ strict: true })
  @Matches(INSTANT)
  newStartsAt!: string;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() newTeacherId?: string;
  @ApiProperty({ minLength: 3, maxLength: 500 })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() overrideLateRule?: boolean;
  @ApiPropertyOptional({ enum: ['STUDENT', 'TEACHER', 'ACADEMY'], default: 'STUDENT' })
  @IsOptional()
  @IsIn(['STUDENT', 'TEACHER', 'ACADEMY'])
  initiator?: ChangeInitiator;
}
@SetMetadata(STRICT_INPUT_DTO, true)
export class CancelManagerLessonDto {
  @ApiProperty({ minLength: 3, maxLength: 500 })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
  @ApiProperty() @IsBoolean() chargeable!: boolean;
  @ApiPropertyOptional({ enum: ['STUDENT', 'TEACHER', 'ACADEMY'], default: 'STUDENT' })
  @IsOptional()
  @IsIn(['STUDENT', 'TEACHER', 'ACADEMY'])
  initiator?: ChangeInitiator;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() overrideLateRule?: boolean;
}
@SetMetadata(STRICT_INPUT_DTO, true)
export class SetManagerMeetDto {
  @ApiProperty({ pattern: MEET.source })
  @Matches(MEET, { message: 'INVALID_MEET_LINK' })
  url!: string;
}
export class TrialBriefDto {
  @ApiProperty({ format: 'uuid' }) leadId!: string;
  @ApiProperty({ enum: ['CHILD', 'ADULT'] }) audience!: 'CHILD' | 'ADULT';
  @ApiProperty({ type: Number, nullable: true }) ageYears!: number | null;
  @ApiProperty({ type: Number, nullable: true }) grade!: number | null;
  @ApiProperty({ type: String, nullable: true }) level!: string | null;
  @ApiProperty() subjectName!: string;
}
export class ManagerLessonDto {
  @ApiPropertyOptional({ type: TrialBriefDto, nullable: true }) trialBrief?: TrialBriefDto | null;
  @ApiProperty({ enum: ['REGULAR', 'TRIAL'] }) kind!: 'REGULAR' | 'TRIAL';
  @ApiProperty({ format: 'uuid' }) lessonId!: string;
  @ApiProperty({ format: 'uuid' }) studentId!: string;
  @ApiProperty({ format: 'uuid' }) teacherId!: string;
  @ApiProperty() teacherName!: string;
  @ApiProperty({ format: 'date-time' }) startsAt!: string;
  @ApiProperty({ format: 'date-time' }) endsAt!: string;
  @ApiProperty({ enum: LessonStatus }) status!: LessonStatus;
  @ApiProperty({ type: String, nullable: true }) meetLink!: string | null;
  @ApiProperty({ type: String, nullable: true, format: 'uuid' }) subscriptionId!: string | null;
  @ApiProperty({ type: 'integer' }) chargedLessons!: number;
  @ApiProperty({
    type: String,
    nullable: true,
    format: 'uuid',
    description:
      'Specific director exception request. Re-submit the same change with a new command key after approval.',
  })
  pendingChangeId!: string | null;
  @ApiProperty() requiresApproval!: boolean;
}
