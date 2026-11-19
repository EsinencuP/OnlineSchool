import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SetMetadata } from '@nestjs/common';
import { STRICT_INPUT_DTO } from '../../../openapi/dto-validation.pipe.js';
import { IsInt, IsOptional, IsUUID, Length, Matches, Max, Min } from 'class-validator';
import { RECEIPT_MONEY_REGEX } from '../../finance/receipt-policy.js';

const planCode = /^[A-Z][A-Z0-9_-]{0,39}$/;

@SetMetadata(STRICT_INPUT_DTO, true)
export class SaleConditionsQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  after?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(planCode)
  code?: string;
}

@SetMetadata(STRICT_INPUT_DTO, true)
export class PublishSaleConditionDto {
  @ApiProperty()
  @Matches(planCode)
  code!: string;

  @ApiProperty({ minimum: 0, description: 'Latest catalog version, or zero for a new code' })
  @IsInt()
  @Min(0)
  @Max(2147483646)
  expectedVersion!: number;

  @ApiProperty({ minimum: 1, maximum: 10000 })
  @IsInt()
  @Min(1)
  @Max(10000)
  lessonCount!: number;

  @ApiProperty({ minimum: 1, maximum: 3660 })
  @IsInt()
  @Min(1)
  @Max(3660)
  durationDays!: number;

  @ApiProperty({ description: 'Original package price in MDL' })
  @Matches(RECEIPT_MONEY_REGEX)
  priceBeforeDiscount!: string;

  @ApiProperty({ description: 'Absolute package discount in MDL' })
  @Matches(RECEIPT_MONEY_REGEX)
  discount!: string;

  @ApiProperty({ minLength: 5, maxLength: 500 })
  @Length(5, 500)
  basis!: string;
}

@SetMetadata(STRICT_INPUT_DTO, true)
export class RetireSaleConditionDto {
  @ApiProperty({ minLength: 5, maxLength: 500 })
  @Length(5, 500)
  basis!: string;
}

export class SaleConditionVersionDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() version!: number;
  @ApiProperty() lessonCount!: number;
  @ApiProperty({ type: Number, nullable: true }) durationDays!: number | null;
  @ApiProperty() priceBeforeDiscount!: string;
  @ApiProperty() discount!: string;
  @ApiProperty() price!: string;
  @ApiProperty() unitPrice!: string;
  @ApiProperty() currency!: string;
  @ApiProperty({ format: 'date-time' }) validFrom!: string;
  @ApiProperty({ type: String, nullable: true, format: 'date-time' }) validTo!: string | null;
  @ApiProperty({ enum: ['ACTIVE', 'SCHEDULED', 'RETIRED'] }) status!: string;
  @ApiProperty({ type: String, nullable: true, format: 'uuid' }) publishedById!: string | null;
  @ApiProperty({ type: String, nullable: true }) publicationBasis!: string | null;
  @ApiProperty({ type: String, nullable: true, format: 'uuid' }) retiredById!: string | null;
  @ApiProperty({ type: String, nullable: true }) retirementBasis!: string | null;
}

export class SaleConditionVersionsDto {
  @ApiProperty({ type: [SaleConditionVersionDto] }) items!: SaleConditionVersionDto[];
  @ApiProperty({ type: String, nullable: true, format: 'uuid' }) next!: string | null;
}
