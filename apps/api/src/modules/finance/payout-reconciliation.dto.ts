import { SetMetadata } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Length, Matches } from 'class-validator';
import { STRICT_INPUT_DTO } from '../../openapi/dto-validation.pipe.js';

const resolutions = ['SUCCEEDED', 'FAILED'] as const;
const amountPattern = /^(?:0|[1-9]\d{0,15})(?:\.\d{1,4})?$/;

@SetMetadata(STRICT_INPUT_DTO, true)
export class ReconcilePayoutRequest {
  @ApiProperty({ enum: resolutions })
  @IsIn(resolutions)
  status!: (typeof resolutions)[number];

  @ApiProperty({ maxLength: 200, description: 'Reference to verified external evidence' })
  @IsString()
  @Length(1, 200)
  evidenceReference!: string;

  @ApiPropertyOptional({
    type: String,
    pattern: amountPattern.source,
    description: 'Actual confirmed amount as a decimal string. Required for SUCCEEDED.',
  })
  @IsOptional()
  @Matches(amountPattern)
  amount?: string;
}

export class ReconcilePayoutResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: resolutions }) status!: (typeof resolutions)[number];
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) payoutId!: string | null;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) ledgerEntryId!: string | null;
}
