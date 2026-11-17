import { SetMetadata } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { STRICT_INPUT_DTO } from '../../../openapi/dto-validation.pipe.js';
import { DECISION_KINDS } from './director.dto.js';
import type { DecisionKind } from './director.dto.js';

@SetMetadata(STRICT_INPUT_DTO, true)
export class DirectorEmptyCommandDto {}

@SetMetadata(STRICT_INPUT_DTO, true)
export class RejectPaymentCommandDto {
  @ApiProperty({
    minLength: 3,
    maxLength: 500,
    description: 'Kept in the audit trail; shown to the manager',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

@SetMetadata(STRICT_INPUT_DTO, true)
export class ApproveDisputeCommandDto {
  @ApiProperty({
    type: 'integer',
    minimum: 1,
    description: 'taskVersion from the decision card (optimistic lock)',
  })
  @IsInt()
  @Min(1)
  version!: number;
}

@SetMetadata(STRICT_INPUT_DTO, true)
export class ApproveRequestCommandDto {
  @ApiPropertyOptional({
    type: 'integer',
    minimum: 1,
    maximum: 100,
    description: 'TEMPORARY_ACCESS: lesson limit; defaults to the manager proposal',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  maxLessons?: number;
  @ApiPropertyOptional({
    format: 'date-time',
    description: 'TEMPORARY_ACCESS: when the access ends; defaults to the manager proposal',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  expiresAt?: string;
  @ApiPropertyOptional({ minLength: 3, maxLength: 500, description: 'Kept with the decision' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  note?: string;
}

@SetMetadata(STRICT_INPUT_DTO, true)
export class DeclineRequestCommandDto {
  @ApiProperty({ minLength: 3, maxLength: 500, description: 'Shown to the manager' })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

export class DecisionResultDto {
  @ApiProperty({ enum: DECISION_KINDS }) kind!: DecisionKind;
  @ApiProperty({ format: 'uuid', description: 'Id of the decided item' }) id!: string;
  @ApiProperty({ enum: ['CONFIRMED', 'REJECTED', 'APPROVED', 'DECLINED'] })
  outcome!: 'CONFIRMED' | 'REJECTED' | 'APPROVED' | 'DECLINED';
  @ApiProperty({ format: 'date-time' }) decidedAt!: string;
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'What the underlying finance/schedule command returned',
  })
  result!: Record<string, unknown>;
}
