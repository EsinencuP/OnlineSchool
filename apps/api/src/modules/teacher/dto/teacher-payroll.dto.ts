import { SetMetadata } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, Matches } from 'class-validator';
import { STRICT_INPUT_DTO } from '../../../openapi/dto-validation.pipe.js';

export const PAYROLL_STATUSES = [
  'PENDING_ACCRUAL',
  'ACCRUED',
  'PARTIALLY_PAID',
  'PAID',
  'NO_PAYMENT',
] as const;
export type PayrollStatus = (typeof PAYROLL_STATUSES)[number];

@SetMetadata(STRICT_INPUT_DTO, true)
export class TeacherPayrollQueryDto {
  @ApiPropertyOptional({
    example: '2026-11',
    description: 'School-timezone calendar month; defaults to the current one',
  })
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  month?: string;
}

export class PayrollLineDto {
  @ApiProperty({ format: 'uuid' }) outcomeId!: string;
  @ApiProperty({ format: 'date-time' }) lessonStartedAt!: string;
  @ApiProperty({ type: 'integer' }) durationMin!: number;
  @ApiProperty() studentName!: string;
  @ApiProperty() subjectName!: string;
  @ApiProperty({ example: '200.0000', description: 'Rate frozen at the actual lesson start' })
  rate!: string;
  @ApiProperty({ type: 'integer' }) points!: number;
  @ApiProperty({ example: 'ORDINARY_POINTS' }) rateBasis!: string;
  @ApiProperty({ example: 'MDL' }) currency!: string;
  @ApiProperty({
    example: '200.0000',
    description: 'Accrued amount; equals the rate for an ordinary accrual',
  })
  amount!: string;
  @ApiProperty({ example: '0.0000' }) paid!: string;
  @ApiProperty({ enum: PAYROLL_STATUSES }) status!: PayrollStatus;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) accruedAt!: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) lastPaidAt!: string | null;
}
export class PayrollTotalDto {
  @ApiProperty({ example: 'MDL' }) currency!: string;
  @ApiProperty({ example: '200.0000' }) accrued!: string;
  @ApiProperty({ example: '0.0000' }) paid!: string;
  @ApiProperty({ example: '200.0000', description: 'Accrued minus paid' }) outstanding!: string;
  @ApiProperty({
    example: '0.0000',
    description: 'Confirmed lessons not accrued yet, at their frozen rate',
  })
  pendingAccrual!: string;
}
export class PayrollReviewItemDto {
  @ApiProperty({ format: 'uuid' }) lessonId!: string;
  @ApiProperty({ format: 'uuid' }) reportId!: string;
  @ApiProperty({ format: 'date-time' }) lessonAt!: string;
  @ApiProperty() studentName!: string;
  @ApiProperty() subjectName!: string;
  @ApiProperty({ enum: ['DISPUTED_REPORT', 'AWAITING_DIRECTOR_ACCRUAL'] })
  status!: 'DISPUTED_REPORT' | 'AWAITING_DIRECTOR_ACCRUAL';
}
export class TeacherPayrollResponseDto {
  @ApiProperty({ example: '2026-11' }) month!: string;
  @ApiProperty({ example: 'Europe/Chisinau' }) timezone!: string;
  @ApiProperty({ type: [PayrollTotalDto] }) @IsArray() totals!: PayrollTotalDto[];
  @ApiProperty({ type: [PayrollLineDto] }) @IsArray() lines!: PayrollLineDto[];
  @ApiPropertyOptional({
    type: [PayrollReviewItemDto],
    description: 'Own lessons awaiting a decision, without an estimated amount.',
  })
  reviewItems?: PayrollReviewItemDto[];
}
