import { SetMetadata } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { STRICT_INPUT_DTO } from '../../../openapi/dto-validation.pipe.js';

export const REQUEST_KINDS = ['TEMPORARY_ACCESS', 'REFUND'] as const;
export const REQUEST_STATUSES = ['PENDING', 'APPROVED', 'DECLINED', 'WITHDRAWN'] as const;
export type RequestKind = (typeof REQUEST_KINDS)[number];
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

@SetMetadata(STRICT_INPUT_DTO, true)
export class CreateRequestDto {
  @ApiProperty({
    enum: REQUEST_KINDS,
    description:
      'TEMPORARY_ACCESS: admit the student to limited lessons while the subscription is partly paid. REFUND: ask the director to prepare a refund calculation',
  })
  @IsIn(REQUEST_KINDS)
  kind!: RequestKind;
  @ApiProperty({ format: 'uuid', description: 'Financial subscription of this student' })
  @IsUUID()
  subscriptionId!: string;
  @ApiProperty({ minLength: 5, maxLength: 500, description: "The family's request in short" })
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason!: string;
  @ApiPropertyOptional({
    type: 'integer',
    minimum: 1,
    maximum: 100,
    description: 'TEMPORARY_ACCESS hint only; the director sets the real limit',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  proposedLessons?: number;
  @ApiPropertyOptional({
    format: 'date-time',
    description: 'TEMPORARY_ACCESS hint only; the director sets the real expiry',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  proposedUntil?: string;
}

@SetMetadata(STRICT_INPUT_DTO, true)
export class ListRequestsQueryDto {
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() studentId?: string;
  @ApiPropertyOptional({ enum: REQUEST_STATUSES })
  @IsOptional()
  @IsIn(REQUEST_STATUSES)
  status?: RequestStatus;
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
  @MaxLength(300)
  cursor?: string;
}

@SetMetadata(STRICT_INPUT_DTO, true)
export class WithdrawRequestDto {
  @ApiPropertyOptional({ minLength: 3, maxLength: 500 })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  note?: string;
}

export class ManagerRequestDto {
  @ApiProperty({ format: 'uuid' }) requestId!: string;
  @ApiProperty({ enum: REQUEST_KINDS }) kind!: RequestKind;
  @ApiProperty({ format: 'uuid' }) studentId!: string;
  @ApiProperty({ format: 'uuid' }) subscriptionId!: string;
  @ApiProperty() reason!: string;
  @ApiProperty({ type: Number, nullable: true }) proposedLessons!: number | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) proposedUntil!: string | null;
  @ApiProperty({
    enum: REQUEST_STATUSES,
    description:
      'APPROVED for REFUND means: accepted for calculation. No money moves with this decision',
  })
  status!: RequestStatus;
  @ApiProperty({ format: 'date-time' }) requestedAt!: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) decidedAt!: string | null;
  @ApiProperty({ type: String, nullable: true, description: "Director's note or reason" })
  decisionNote!: string | null;
  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'Granted temporary access, when approved',
  })
  permissionId!: string | null;
}

export class ManagerRequestPageDto {
  @ApiProperty({ type: [ManagerRequestDto] }) items!: ManagerRequestDto[];
  @ApiProperty({ type: String, nullable: true }) nextCursor!: string | null;
}
