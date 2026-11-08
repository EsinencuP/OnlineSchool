import { SetMetadata } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ManagerPaymentMethod, ManagerPaymentPurpose } from '@online-school/db';
import { STRICT_INPUT_DTO } from '../../../openapi/dto-validation.pipe.js';
import { SUPPORTED_RECEIPT_CURRENCIES } from '../../finance/receipt-policy.js';
import { ManagerPaymentStatus } from '../../finance/manager-payments/contracts.js';
import { IsMoneyString } from '../validators/is-money-string.js';
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;
@SetMetadata(STRICT_INPUT_DTO, true)
export class CreateManagerPaymentDto {
  @ApiProperty({ type: String, pattern: '^(0|[1-9][0-9]{0,11})(\\.[0-9]{1,4})?$' })
  @IsMoneyString()
  amount!: string;
  @ApiPropertyOptional({ enum: SUPPORTED_RECEIPT_CURRENCIES, default: 'MDL' })
  @IsOptional()
  @IsIn(SUPPORTED_RECEIPT_CURRENCIES)
  currency?: string;
  @ApiProperty({ enum: ManagerPaymentMethod })
  @IsEnum(ManagerPaymentMethod)
  method!: ManagerPaymentMethod;
  @ApiProperty({ enum: ManagerPaymentPurpose })
  @IsEnum(ManagerPaymentPurpose)
  purpose!: ManagerPaymentPurpose;
  @ApiProperty({ format: 'date-time' })
  @IsISO8601({ strict: true })
  @Matches(INSTANT)
  receivedAt!: string;
  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  externalRef?: string;
  @ApiPropertyOptional({ maxLength: 500 }) @IsOptional() @IsString() @MaxLength(500) note?: string;
}
@SetMetadata(STRICT_INPUT_DTO, true)
export class ConfirmManagerPaymentDto {}
@SetMetadata(STRICT_INPUT_DTO, true)
export class RejectManagerPaymentDto {
  @ApiProperty({ minLength: 3, maxLength: 500 })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
@SetMetadata(STRICT_INPUT_DTO, true)
export class ListManagerPaymentsQueryDto {
  @ApiPropertyOptional({ type: 'integer', minimum: 1, maximum: 10000, default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  page = 1;
  @ApiPropertyOptional({ type: 'integer', minimum: 1, maximum: 100, default: 30 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 30;
  @ApiPropertyOptional({ enum: ManagerPaymentStatus })
  @IsOptional()
  @IsEnum(ManagerPaymentStatus)
  status?: ManagerPaymentStatus;
}
@SetMetadata(STRICT_INPUT_DTO, true)
export class PrepareManagerDistributionDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() enrollmentId!: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID() planId!: string;
  @ApiProperty({ type: String }) @IsMoneyString() amount!: string;
  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(INSTANT)
  startsAt?: string;
}
@SetMetadata(STRICT_INPUT_DTO, true)
export class AllocateManagerPaymentDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() subscriptionId!: string;
  @ApiProperty({ type: String }) @IsMoneyString() amount!: string;
}
export class ManagerPaymentDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({
    format: 'uuid',
    description: 'CRM contact; does not establish ownership of funds.',
  })
  studentId!: string;
  @ApiProperty({ type: String }) amount!: string;
  @ApiProperty({
    description: 'Historical receipt currencies are preserved. New receipts support MDL.',
  })
  currency!: string;
  @ApiProperty({ type: String, enum: ManagerPaymentMethod, nullable: true })
  method!: ManagerPaymentMethod | null;
  @ApiProperty({ type: String, enum: ManagerPaymentPurpose, nullable: true })
  purpose!: ManagerPaymentPurpose | null;
  @ApiProperty({ enum: ManagerPaymentStatus }) status!: ManagerPaymentStatus;
  @ApiProperty({ format: 'date-time' }) receivedAt!: string;
  @ApiProperty({ type: String, nullable: true }) externalRef!: string | null;
  @ApiProperty({ type: String, nullable: true, format: 'uuid' }) ledgerPublicationId!:
    string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ type: String, nullable: true }) rejectionReason!: string | null;
}
export class ManagerPaymentPageDto {
  @ApiProperty({ type: [ManagerPaymentDto] }) items!: ManagerPaymentDto[];
  @ApiProperty({ type: 'integer' }) total!: number;
  @ApiProperty({ type: 'integer' }) page!: number;
  @ApiProperty({ type: 'integer' }) pageSize!: number;
}
export class ManagerDistributionDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) paymentId!: string;
  @ApiProperty({ format: 'uuid' }) studentId!: string;
  @ApiProperty({ format: 'uuid' }) subscriptionId!: string;
  @ApiProperty({ format: 'uuid' }) enrollmentId!: string;
  @ApiProperty({ format: 'uuid' }) planId!: string;
  @ApiProperty({ type: String }) amount!: string;
  @ApiProperty() currency!: string;
  @ApiProperty({ enum: ManagerPaymentStatus }) status!: ManagerPaymentStatus;
  @ApiProperty({
    description:
      'Only a subscription operation consumes an allocation; account activation does not.',
  })
  consumed!: boolean;
  @ApiProperty({ type: String, nullable: true, format: 'uuid' }) ledgerPublicationId!:
    string | null;
}
export class ManagerDistributionPageDto {
  @ApiProperty({ type: [ManagerDistributionDto] }) items!: ManagerDistributionDto[];
  @ApiProperty({ type: 'integer' }) total!: number;
  @ApiProperty({ type: 'integer' }) page!: number;
  @ApiProperty({ type: 'integer' }) pageSize!: number;
}
