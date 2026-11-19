import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SetMetadata } from '@nestjs/common';
import { STRICT_INPUT_DTO } from '../../../openapi/dto-validation.pipe.js';
import { IsIn, IsInt, IsUUID, Length, Matches, Max, Min, ValidateIf } from 'class-validator';

const moneyPattern = /^(?:0|[1-9]\d{0,15})(?:\.\d{1,4})?$/;
const kind = ['PAID', 'FAILED', 'RETURNED'] as const;
const transferStatus = ['REPORTED', 'VERIFIED', 'REJECTED'] as const;

@SetMetadata(STRICT_INPUT_DTO, true)
export class PrepareRefundDto {
  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  @Max(2147483646)
  version!: number;

  @ApiProperty()
  @Matches(/^[a-f0-9]{64}$/)
  revision!: string;

  @ApiProperty({
    minimum: 0,
    description: 'Use zero to submit the evidence for an ineligible or held case',
  })
  @IsInt()
  @Min(0)
  @Max(10000)
  quantity!: number;

  @ApiProperty({ minLength: 5, maxLength: 500 })
  @Length(5, 500)
  basis!: string;
}

@SetMetadata(STRICT_INPUT_DTO, true)
export class DecideRefundDto {
  @ApiProperty({ enum: ['APPROVE', 'DECLINE'] })
  @IsIn(['APPROVE', 'DECLINE'])
  decision!: 'APPROVE' | 'DECLINE';

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  version!: number;

  @ApiPropertyOptional({
    type: String,
    description: 'Required for approval, in the subscription currency',
  })
  @ValidateIf((dto: DecideRefundDto) => dto.decision === 'APPROVE' || dto.amount !== undefined)
  @Matches(moneyPattern)
  amount?: string;

  @ApiProperty({ minLength: 5, maxLength: 500 })
  @Length(5, 500)
  basis!: string;
}

@SetMetadata(STRICT_INPUT_DTO, true)
export class ReportRefundTransferDto {
  @ApiProperty({ enum: kind })
  @IsIn(kind)
  kind!: (typeof kind)[number];

  @ApiProperty()
  @Matches(moneyPattern)
  amount!: string;

  @ApiProperty({ format: 'date-time' })
  @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/)
  occurredAt!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @ValidateIf(
    (dto: ReportRefundTransferDto) =>
      dto.kind === 'RETURNED' || dto.originalTransferId !== undefined,
  )
  @IsUUID()
  originalTransferId?: string;

  @ApiProperty({ minLength: 2, maxLength: 40, description: 'External transfer method' })
  @Matches(/^[A-Za-z][A-Za-z0-9_-]{1,39}$/)
  channel!: string;

  @ApiProperty({
    minLength: 1,
    maxLength: 160,
    description: 'Unique bank or reconciliation reference',
  })
  @Length(1, 160)
  reference!: string;

  @ApiProperty({
    minLength: 5,
    maxLength: 160,
    description: 'Opaque reference to protected payment evidence',
  })
  @Matches(/^[A-Za-z0-9][A-Za-z0-9._:-]{4,159}$/)
  evidence!: string;
}

@SetMetadata(STRICT_INPUT_DTO, true)
export class ReviewRefundTransferDto {
  @ApiProperty({ enum: ['VERIFY', 'REJECT'] })
  @IsIn(['VERIFY', 'REJECT'])
  decision!: 'VERIFY' | 'REJECT';

  @ApiProperty({ minLength: 5, maxLength: 500 })
  @Length(5, 500)
  basis!: string;
}

class RefundQuoteAllocationDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) paymentId!: string;
  @ApiProperty() currency!: string;
  @ApiProperty() amount!: string;
}

class RefundQuoteAdvanceDto {
  @ApiProperty() currency!: string;
  @ApiProperty() amount!: string;
}

class RefundQuoteGrantDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() remaining!: number;
}

class RefundQuoteHoldDto {
  @ApiProperty() id!: string;
  @ApiProperty() reason!: string;
}

class RefundQuoteChargeDto {
  @ApiProperty({ format: 'uuid' }) lessonId!: string;
  @ApiProperty({ format: 'uuid' }) consumptionId!: string;
  @ApiProperty() quantity!: number;
  @ApiProperty({ enum: ['CONDUCTED', 'APPROVED_CANCELLATION'] }) category!: string;
}

class RefundQuoteDto {
  @ApiProperty() currency!: string;
  @ApiProperty() unitPrice!: string;
  @ApiProperty() fullPrice!: string;
  @ApiProperty() lessonCount!: number;
  @ApiProperty({ type: [RefundQuoteAllocationDto] }) allocations!: RefundQuoteAllocationDto[];
  @ApiProperty({ type: [RefundQuoteAdvanceDto] }) advances!: RefundQuoteAdvanceDto[];
  @ApiProperty({ type: [RefundQuoteGrantDto] }) grants!: RefundQuoteGrantDto[];
  @ApiProperty({ type: [RefundQuoteChargeDto] }) charges!: RefundQuoteChargeDto[];
  @ApiProperty({ type: [RefundQuoteHoldDto] }) holds!: RefundQuoteHoldDto[];
  @ApiProperty() allocated!: string;
  @ApiProperty() advance!: string;
  @ApiProperty() eligibleQuantity!: number;
  @ApiProperty() maximumAmount!: string;
  @ApiProperty() revision!: string;
}

export class RefundDecisionDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() version!: number;
  @ApiProperty({ enum: ['DRAFT', 'APPROVED', 'DECLINED'] }) status!: string;
}

class RefundDetailDto extends RefundDecisionDto {
  @ApiProperty({ type: String, nullable: true, format: 'uuid' }) preparedById!: string | null;
  @ApiProperty({ type: String, nullable: true, format: 'date-time' }) preparedAt!: string | null;
  @ApiProperty() quantity!: number;
  @ApiProperty() calculatedAmount!: string;
  @ApiProperty() calculationBasis!: string;
  @ApiProperty({ type: String, nullable: true }) revision!: string | null;
  @ApiProperty({ type: RefundQuoteDto, nullable: true })
  calculationSnapshot!: RefundQuoteDto | null;
  @ApiProperty() currency!: string;
  @ApiProperty({ type: String, nullable: true }) approvedAmount!: string | null;
  @ApiProperty({ type: String, nullable: true, format: 'uuid' }) decidedById!: string | null;
  @ApiProperty({ type: String, nullable: true, format: 'date-time' }) decidedAt!: string | null;
  @ApiProperty({ type: String, nullable: true }) decisionBasis!: string | null;
}

export class RefundTransferDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: kind }) kind!: (typeof kind)[number];
  @ApiProperty() channel!: string;
  @ApiProperty({ enum: transferStatus }) status!: (typeof transferStatus)[number];
  @ApiProperty() amount!: string;
  @ApiProperty({ format: 'date-time' }) occurredAt!: string;
  @ApiProperty({ type: String, nullable: true, format: 'uuid' }) originalTransferId!: string | null;
}

class RefundTransferDetailDto extends RefundTransferDto {
  @ApiProperty() reference!: string;
  @ApiProperty() evidence!: string;
  @ApiProperty({ format: 'uuid' }) reportedById!: string;
  @ApiProperty({ format: 'date-time' }) reportedAt!: string;
  @ApiProperty({ type: String, nullable: true, format: 'uuid' }) reviewedById!: string | null;
  @ApiProperty({ type: String, nullable: true, format: 'date-time' }) reviewedAt!: string | null;
  @ApiProperty({ type: String, nullable: true }) reviewReason!: string | null;
}

class RefundSettlementDto {
  @ApiProperty() verifiedNet!: string;
  @ApiProperty() remaining!: string;
  @ApiProperty({
    enum: ['AWAITING_REVIEW', 'AWAITING_EXECUTION', 'PARTIALLY_EXECUTED', 'EXECUTED'],
  })
  status!: string;
}

export class RefundViewDto {
  @ApiProperty({ format: 'uuid' }) requestId!: string;
  @ApiProperty({ enum: ['PENDING', 'APPROVED', 'DECLINED', 'WITHDRAWN'] }) requestStatus!: string;
  @ApiProperty({ format: 'uuid' }) subscriptionId!: string;
  @ApiProperty({ type: RefundQuoteDto, nullable: true }) quote!: RefundQuoteDto | null;
  @ApiProperty({ type: RefundDetailDto, nullable: true }) decision!: RefundDetailDto | null;
  @ApiProperty({ type: [RefundTransferDetailDto] }) transfers!: RefundTransferDetailDto[];
  @ApiProperty({ type: RefundSettlementDto, nullable: true })
  settlement!: RefundSettlementDto | null;
}

class RefundCaseDto {
  @ApiProperty({ format: 'uuid' }) requestId!: string;
  @ApiProperty({ format: 'uuid' }) studentId!: string;
  @ApiProperty({ format: 'uuid' }) subscriptionId!: string;
  @ApiProperty({ type: RefundDecisionDto, nullable: true }) decision!: RefundDecisionDto | null;
  @ApiProperty() pendingTransfers!: number;
  @ApiProperty({ format: 'date-time' }) requestedAt!: string;
}

export class RefundCasesDto {
  @ApiProperty({ type: [RefundCaseDto] }) items!: RefundCaseDto[];
  @ApiProperty({ type: String, nullable: true, format: 'uuid' }) next!: string | null;
}
