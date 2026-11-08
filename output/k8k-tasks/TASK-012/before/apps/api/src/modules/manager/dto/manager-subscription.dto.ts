import { SetMetadata } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { ManagerSubscriptionStatus, ManagerFreezeReason } from '@online-school/db';
import { STRICT_INPUT_DTO } from '../../../openapi/dto-validation.pipe.js';
@SetMetadata(STRICT_INPUT_DTO, true)
export class CreateManagerSubscriptionDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() planId!: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID() distributionId!: string;
  @ApiPropertyOptional({
    format: 'date-time',
    description: 'Must match the prepared financial package start.',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/)
  startsAt?: string;
}
@SetMetadata(STRICT_INPUT_DTO, true)
export class RenewManagerSubscriptionDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() distributionId!: string;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() planId?: string;
}
@SetMetadata(STRICT_INPUT_DTO, true)
export class FreezeManagerSubscriptionDto {
  @ApiProperty({ format: 'date', description: 'Inclusive school-local start date.' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startsOn!: string;
  @ApiProperty({ format: 'date', description: 'Exclusive school-local resume date.' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endsOn!: string;
  @ApiProperty({ enum: ManagerFreezeReason })
  @IsEnum(ManagerFreezeReason)
  reason!: ManagerFreezeReason;
  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() cancelConflictingLessons?: boolean;
}
@SetMetadata(STRICT_INPUT_DTO, true)
export class UnfreezeManagerSubscriptionDto {}
export class ManagerSubscriptionDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) studentId!: string;
  @ApiProperty({ format: 'uuid' }) enrollmentId!: string;
  @ApiProperty({ format: 'uuid' }) planId!: string;
  @ApiProperty({ enum: ManagerSubscriptionStatus }) status!: ManagerSubscriptionStatus;
  @ApiProperty({ format: 'date-time' }) startsAt!: string;
  @ApiProperty({ format: 'date-time' }) endsAt!: string;
  @ApiProperty({ type: String, nullable: true, format: 'date-time' }) frozenUntil!: string | null;
  @ApiProperty({ type: 'integer' }) totalLessons!: number;
  @ApiProperty({ type: 'integer' }) remainingLessons!: number;
  @ApiProperty({ type: 'integer' }) freezeDaysUsed!: number;
  @ApiProperty({ type: String }) price!: string;
  @ApiProperty() currency!: string;
}
