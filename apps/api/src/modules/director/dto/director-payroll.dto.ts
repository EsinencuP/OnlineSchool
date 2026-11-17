import { SetMetadata } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional, IsUUID } from 'class-validator';
import { STRICT_INPUT_DTO } from '../../../openapi/dto-validation.pipe.js';

export class PayrollTotalDto {
  @ApiProperty({ example: 'MDL' }) currency!: string;
  @ApiProperty({ example: '1200.0000', description: 'Recognised teacher accruals' })
  accrued!: string;
  @ApiProperty({ example: '800.0000', description: 'Confirmed payouts only' }) paid!: string;
  @ApiProperty({ example: '400.0000', description: 'accrued − paid: still owed to teachers' })
  outstanding!: string;
}

export class PayrollTeacherRowDto extends PayrollTotalDto {
  @ApiProperty({ format: 'uuid' }) teacherId!: string;
  @ApiProperty() teacherName!: string;
  @ApiProperty({
    type: 'integer',
    description: 'Payout attempts waiting for confirmation or reconciliation',
  })
  openAttempts!: number;
}

@SetMetadata(STRICT_INPUT_DTO, true)
export class PayrollQueryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Only accruals recognised in this financial period; default: all time',
  })
  @IsOptional()
  @IsUUID()
  periodId?: string;
}

export class PayrollSummaryDto {
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true }) periodId!: string | null;
  @ApiProperty({ type: [PayrollTotalDto], description: 'One row per currency' })
  totals!: PayrollTotalDto[];
  @ApiProperty({ type: [PayrollTeacherRowDto], description: 'Largest outstanding first' })
  teachers!: PayrollTeacherRowDto[];
}

export class PayrollObligationDto {
  @ApiProperty({ format: 'uuid' }) obligationId!: string;
  @ApiProperty({ format: 'uuid' }) accrualId!: string;
  @ApiProperty({ format: 'uuid' }) lessonId!: string;
  @ApiProperty({ format: 'date-time' }) recognizedAt!: string;
  @ApiProperty() currency!: string;
  @ApiProperty({ example: '50.0000' }) amount!: string;
  @ApiProperty({ example: '0.0000' }) paid!: string;
  @ApiProperty({ example: '50.0000' }) outstanding!: string;
  @ApiProperty({ type: 'integer' }) openAttempts!: number;
  @ApiProperty({ description: 'Accrued by a director exception (unpaid lesson)' })
  exception!: boolean;
}

export class PayrollTeacherDto {
  @ApiProperty({ format: 'uuid' }) teacherId!: string;
  @ApiProperty() teacherName!: string;
  @ApiProperty({ type: [PayrollTotalDto] }) totals!: PayrollTotalDto[];
  @ApiProperty({ type: [PayrollObligationDto], description: 'Newest first, at most 200' })
  obligations!: PayrollObligationDto[];
}

export const UNRESOLVED_KINDS = [
  'UNACCRUED_LESSON',
  'DISPUTED_LESSON',
  'OPEN_PAYOUT_ATTEMPT',
  'DRAFT_LEDGER_ENTRY',
] as const;

export class UnresolvedItemDto {
  @ApiProperty({ enum: UNRESOLVED_KINDS }) kind!: (typeof UNRESOLVED_KINDS)[number];
  @ApiProperty({ format: 'uuid', description: 'Lesson, payout attempt or ledger entry' })
  id!: string;
  @ApiProperty({ format: 'date-time' }) at!: string;
  @ApiProperty({ type: String, nullable: true }) teacherName!: string | null;
  @ApiProperty({ type: String, nullable: true }) studentName!: string | null;
  @ApiProperty({ type: String, nullable: true, example: '50.0000' }) amount!: string | null;
  @ApiProperty({ type: String, nullable: true }) currency!: string | null;
  @ApiProperty({ example: 'Conducted lesson has no teacher accrual' }) detail!: string;
}

export class UnresolvedDto {
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) periodId!: string | null;
  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'integer' },
    description: 'Total per kind (items are capped at 100 per kind)',
  })
  counts!: Record<string, number>;
  @ApiProperty({ type: [UnresolvedItemDto], description: 'Oldest first' })
  items!: UnresolvedItemDto[];
}

export class PeriodDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'date-time' }) startsAt!: string;
  @ApiProperty({ format: 'date-time' }) endsAt!: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) closedAt!: string | null;
  @ApiProperty({ description: 'The period has finished, so it can be closed' }) finished!: boolean;
  @ApiProperty({
    type: 'integer',
    description: 'Unresolved facts that block closing (0 when closed)',
  })
  blockers!: number;
  @ApiProperty({ description: 'finished, not closed and nothing blocks it' })
  readyToClose!: boolean;
}

export class PeriodListDto {
  @ApiProperty({ type: [PeriodDto], description: 'Newest first' }) items!: PeriodDto[];
}

@SetMetadata(STRICT_INPUT_DTO, true)
export class CreatePeriodDto {
  @ApiProperty({ format: 'date-time', description: 'Inclusive start (UTC instant)' })
  @IsISO8601({ strict: true })
  startsAt!: string;
  @ApiProperty({ format: 'date-time', description: 'Exclusive end; 1 to 32 days after the start' })
  @IsISO8601({ strict: true })
  endsAt!: string;
}
