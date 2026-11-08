import { SetMetadata } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  Validate,
  ValidatorConstraint,
} from 'class-validator';
import type { ValidatorConstraintInterface, ValidationArguments } from 'class-validator';
import { STRICT_INPUT_DTO } from '../../../openapi/dto-validation.pipe.js';
import { LEAD_STAGES, LEAD_SOURCES, LEAD_LOST_REASONS } from '../leads/policy.js';
import type { LeadStage } from '../leads/policy.js';
import { INSTANT } from '../../schedule/manager/policy.js';

@ValidatorConstraint({ name: 'AtLeastOneContact', async: false })
export class AtLeastOneContact implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    if (args.object instanceof UpdateLeadDto) return true;
    const o = args.object as { phone?: unknown; email?: unknown };
    return (
      (typeof o.phone === 'string' && o.phone.trim().length > 0) ||
      (typeof o.email === 'string' && o.email.trim().length > 0)
    );
  }
  defaultMessage() {
    return 'CONTACT_REQUIRED';
  }
}
@SetMetadata(STRICT_INPUT_DTO, true)
export class CreateLeadDto {
  @ApiProperty({ enum: ['CHILD', 'ADULT'] }) @IsIn(['CHILD', 'ADULT']) audience!: 'CHILD' | 'ADULT';
  @ApiProperty({ minLength: 2, maxLength: 120 })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @Validate(AtLeastOneContact)
  contactName!: string;
  @ApiPropertyOptional({ maxLength: 120 })
  @ValidateIf(
    (o: { audience?: string; guardianName?: unknown }) =>
      o.audience === 'CHILD' || o.guardianName !== undefined,
  )
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  guardianName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Matches(/^\+?[0-9 ()-]{6,20}$/) phone?: string;
  @ApiPropertyOptional({ maxLength: 254 }) @IsOptional() @IsEmail() @MaxLength(254) email?: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID() subjectId!: string;
  @ApiPropertyOptional({ minimum: 1, maximum: 11 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(11)
  grade?: number;
  @ApiPropertyOptional({ minimum: 3, maximum: 99 })
  @IsOptional()
  @IsInt()
  @Min(3)
  @Max(99)
  ageYears?: number;
  @ApiPropertyOptional({ maxLength: 10 }) @IsOptional() @IsString() @MaxLength(10) level?: string;
  @ApiProperty({ enum: LEAD_SOURCES }) @IsIn(LEAD_SOURCES) source!: (typeof LEAD_SOURCES)[number];
  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() forceCreate?: boolean;
}
@SetMetadata(STRICT_INPUT_DTO, true)
export class UpdateLeadDto extends PartialType(OmitType(CreateLeadDto, ['forceCreate'] as const)) {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) version!: number;
}
@SetMetadata(STRICT_INPUT_DTO, true)
export class LeadVersionDto {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) version!: number;
}
@SetMetadata(STRICT_INPUT_DTO, true)
export class ListLeadsQueryDto {
  @ApiPropertyOptional({ type: String, description: 'Comma-separated stages' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.split(',') : value,
  )
  @IsArray()
  @IsIn(LEAD_STAGES, { each: true })
  stage?: LeadStage[];
  @ApiPropertyOptional({ minLength: 2, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  search?: string;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() subjectId?: string;
  @ApiPropertyOptional({ enum: LEAD_SOURCES })
  @IsOptional()
  @IsIn(LEAD_SOURCES)
  source?: (typeof LEAD_SOURCES)[number];
  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  overdue?: boolean;
  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  cursor?: string;
  @ApiPropertyOptional({ type: 'integer', default: 25, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 25;
}
@SetMetadata(STRICT_INPUT_DTO, true)
export class ScheduleTrialDto extends LeadVersionDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() teacherId!: string;
  @ApiProperty({ format: 'date-time' })
  @IsISO8601({ strict: true })
  @Matches(INSTANT)
  startsAt!: string;
}
@SetMetadata(STRICT_INPUT_DTO, true)
export class TransitionLeadDto extends LeadVersionDto {
  @ApiProperty({ enum: ['IN_PROGRESS', 'AWAITING_PAYMENT'] })
  @IsIn(['IN_PROGRESS', 'AWAITING_PAYMENT'])
  to!: 'IN_PROGRESS' | 'AWAITING_PAYMENT';
  @ApiPropertyOptional({ minLength: 3, maxLength: 500 })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  skipTrialReason?: string;
}
@SetMetadata(STRICT_INPUT_DTO, true)
export class LoseLeadDto extends LeadVersionDto {
  @ApiProperty({ enum: LEAD_LOST_REASONS })
  @IsIn(LEAD_LOST_REASONS)
  reason!: (typeof LEAD_LOST_REASONS)[number];
  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}
export class LeadListItemDto {
  @ApiProperty({ format: 'uuid' }) leadId!: string;
  @ApiProperty({ enum: LEAD_STAGES }) stage!: LeadStage;
  @ApiProperty({ enum: ['CHILD', 'ADULT'] }) audience!: 'CHILD' | 'ADULT';
  @ApiProperty() contactName!: string;
  @ApiProperty() subjectName!: string;
  @ApiProperty({ type: Number, nullable: true }) grade!: number | null;
  @ApiProperty({ type: String, nullable: true }) maskedPhone!: string | null;
  @ApiProperty({ enum: LEAD_SOURCES }) source!: (typeof LEAD_SOURCES)[number];
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) stageChangedAt!: string;
  @ApiProperty({ type: String, nullable: true, format: 'date-time' }) trialAt!: string | null;
  @ApiProperty({ type: String, nullable: true, format: 'date-time' }) nextActionAt!: string | null;
  @ApiProperty() isOverdue!: boolean;
}
export class TrialLessonViewDto {
  @ApiProperty({ format: 'uuid' }) lessonId!: string;
  @ApiProperty({ format: 'date-time' }) startsAt!: string;
  @ApiProperty({ format: 'date-time' }) endsAt!: string;
  @ApiProperty() teacherName!: string;
  @ApiProperty({ type: String, nullable: true }) meetLink!: string | null;
  @ApiProperty({ enum: ['PENDING', 'ATTENDED', 'NO_SHOW', 'CANCELLED'] }) outcome!:
    'PENDING' | 'ATTENDED' | 'NO_SHOW' | 'CANCELLED';
  @ApiProperty({ enum: ['PENDING', 'SUBMITTED'] }) feedbackStatus!: 'PENDING' | 'SUBMITTED';
  @ApiProperty({ type: String, nullable: true }) feedbackSummary!: string | null;
}
export class LeadHistoryDto {
  @ApiProperty({ enum: LEAD_STAGES, nullable: true }) from!: LeadStage | null;
  @ApiProperty({ enum: LEAD_STAGES }) to!: LeadStage;
  @ApiProperty({ format: 'date-time' }) at!: string;
  @ApiProperty() byManager!: boolean;
}
export class LeadTaskBriefDto {
  @ApiProperty({ format: 'uuid' }) taskId!: string;
  @ApiProperty({ enum: ['LEAD_FOLLOWUP', 'ASSIGN_TEACHER'] }) type!:
    'LEAD_FOLLOWUP' | 'ASSIGN_TEACHER';
  @ApiProperty({ format: 'date-time' }) dueAt!: string;
}
export class LeadDto extends LeadListItemDto {
  @ApiProperty() version!: number;
  @ApiProperty({ type: String, nullable: true }) guardianName!: string | null;
  @ApiProperty({ type: String, nullable: true }) phone!: string | null;
  @ApiProperty({ type: String, nullable: true }) email!: string | null;
  @ApiProperty({ type: Number, nullable: true }) ageYears!: number | null;
  @ApiProperty({ type: String, nullable: true }) level!: string | null;
  @ApiProperty({ type: String, nullable: true }) comment!: string | null;
  @ApiProperty({ type: String, nullable: true, format: 'uuid' }) studentId!: string | null;
  @ApiProperty({ type: String, nullable: true, format: 'uuid' }) subjectId!: string | null;
  @ApiProperty({ enum: LEAD_LOST_REASONS, nullable: true }) lostReason!:
    (typeof LEAD_LOST_REASONS)[number] | null;
  @ApiProperty({ type: String, nullable: true }) lostComment!: string | null;
  @ApiProperty({ type: TrialLessonViewDto, nullable: true }) trial!: TrialLessonViewDto | null;
  @ApiProperty({ type: [LeadHistoryDto] }) history!: LeadHistoryDto[];
  @ApiProperty({ type: [LeadTaskBriefDto] }) openTasks!: LeadTaskBriefDto[];
}
export class LeadPageDto {
  @ApiProperty({ type: [LeadListItemDto] }) items!: LeadListItemDto[];
  @ApiProperty({ type: String, nullable: true }) nextCursor!: string | null;
}
export class LeadStageCountsDto {
  @ApiProperty() NEW!: number;
  @ApiProperty() IN_PROGRESS!: number;
  @ApiProperty() TRIAL!: number;
  @ApiProperty() AWAITING_PAYMENT!: number;
}
export class LeadSummaryDto {
  @ApiProperty({ type: LeadStageCountsDto }) countsByStage!: LeadStageCountsDto;
  @ApiProperty() createdToday!: number;
  @ApiProperty() trialsToday!: number;
  @ApiProperty() overdueFollowups!: number;
  @ApiProperty({
    type: 'integer',
    minimum: 0,
    maximum: 10000,
    description: 'Converted leads / leads created in the trailing 30-day cohort, in basis points',
  })
  conversion30dBp!: number;
}
