import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProposeAllocationCorrectionDto {
  @ApiProperty({ example: '100.0000' }) amount!: string;
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Omit to request a return to the unallocated receipt balance.',
  })
  targetSubscriptionId?: string;
  @ApiProperty({ minLength: 5, maxLength: 500 }) reason!: string;
}

export class ReviewAllocationCorrectionDto {
  @ApiProperty({ enum: ['REJECTED', 'MANUAL_REVIEW'] })
  decision!: 'REJECTED' | 'MANUAL_REVIEW';
  @ApiProperty({ minLength: 5, maxLength: 500 }) reason!: string;
}

export class AllocationCorrectionSummaryDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) sourceDistributionId!: string;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) targetSubscriptionId!:
    string | null;
  @ApiProperty({ enum: ['PENDING', 'REJECTED', 'MANUAL_REVIEW'] })
  status!: 'PENDING' | 'REJECTED' | 'MANUAL_REVIEW';
  @ApiProperty() amount!: string;
  @ApiProperty() reason!: string;
  @ApiProperty({ format: 'uuid' }) proposedById!: string;
  @ApiProperty({ format: 'date-time' }) proposedAt!: string;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) decidedById!: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) decidedAt!: string | null;
  @ApiProperty({ type: String, nullable: true }) decisionReason!: string | null;
}

export class AllocationCorrectionFactsDto {
  @ApiProperty({ format: 'uuid' }) receiptId!: string;
  @ApiProperty({ format: 'uuid' }) sourceSubscriptionId!: string;
  @ApiProperty({ format: 'uuid' }) sourceEntryId!: string;
  @ApiProperty({ format: 'uuid' }) originPeriodId!: string;
  @ApiProperty() currency!: string;
  @ApiProperty() originalAmount!: string;
  @ApiProperty() receiptAmount!: string;
  @ApiProperty({ type: String, nullable: true, description: 'Visible to the director.' })
  receiptUnallocated!: string | null;
  @ApiProperty() sourceAdvanceBalance!: string;
  @ApiProperty({ type: String, nullable: true }) targetAvailableAmount!: string | null;
  @ApiProperty() sourceGrantedLessons!: number;
  @ApiProperty() sourceUsedLessons!: number;
  @ApiProperty() sourceStartedLessons!: number;
  @ApiProperty({ type: String, isArray: true }) reviewReasons!: string[];
  @ApiProperty({ format: 'date-time' }) asOf!: string;
}

export class AllocationCorrectionDto extends AllocationCorrectionSummaryDto {
  @ApiProperty({ type: AllocationCorrectionFactsDto }) facts!: AllocationCorrectionFactsDto;
}

export class AllocationCorrectionQueueDto {
  @ApiProperty({ type: AllocationCorrectionSummaryDto, isArray: true })
  items!: AllocationCorrectionSummaryDto[];
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) nextCursor!: string | null;
}
