import { SetMetadata } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { STRICT_INPUT_DTO } from '../../../openapi/dto-validation.pipe.js';

export const ESCALATION_STATES = ['OPEN', 'ACCEPTED', 'CLOSED'] as const;
export type EscalationState = (typeof ESCALATION_STATES)[number];
export const ESCALATION_REASONS = ['MANAGER_UNAVAILABLE', 'ACCEPT_TIMEOUT'] as const;

@SetMetadata(STRICT_INPUT_DTO, true)
export class EscalationsQueryDto {
  @ApiPropertyOptional({
    enum: ESCALATION_STATES,
    default: 'OPEN',
    description: 'OPEN: not accepted yet; ACCEPTED: director took it; CLOSED: the task is finished',
  })
  @IsOptional()
  @IsIn(ESCALATION_STATES)
  state?: EscalationState;
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

export class EscalationDto {
  @ApiProperty({ format: 'uuid' }) escalationId!: string;
  @ApiProperty({ format: 'uuid' }) taskId!: string;
  @ApiProperty({ example: 'ATTENDANCE_DISPUTE' }) taskType!: string;
  @ApiProperty({ description: 'Task description (restricted to staff)' }) title!: string;
  @ApiProperty({ example: 'OPEN' }) taskStatus!: string;
  @ApiProperty({ enum: ESCALATION_STATES }) state!: EscalationState;
  @ApiProperty({
    enum: ESCALATION_REASONS,
    description:
      'MANAGER_UNAVAILABLE: routed at once; ACCEPT_TIMEOUT: nobody accepted within the window',
  })
  reason!: (typeof ESCALATION_REASONS)[number];
  @ApiProperty({
    enum: ['AVAILABLE', 'UNAVAILABLE', 'OFF_SHIFT', 'UNASSIGNED'],
    description: 'Primary manager status when the task was escalated',
  })
  managerStatus!: string;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) primaryManagerId!: string | null;
  @ApiProperty({ type: String, nullable: true }) primaryManagerName!: string | null;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) studentId!: string | null;
  @ApiProperty({ type: String, nullable: true }) studentName!: string | null;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) leadId!: string | null;
  @ApiProperty({ type: String, nullable: true }) leadName!: string | null;
  @ApiProperty({ format: 'date-time', description: 'When the manager had to accept the task' })
  acceptDueAt!: string;
  @ApiProperty({ format: 'date-time' }) escalatedAt!: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) acceptedAt!: string | null;
  @ApiProperty({ type: String, nullable: true }) acceptedByName!: string | null;
}

export class EscalationPageDto {
  @ApiProperty({ type: [EscalationDto] }) items!: EscalationDto[];
  @ApiProperty({ type: String, nullable: true }) nextCursor!: string | null;
}

export class ManagerAvailabilityRowDto {
  @ApiProperty({ format: 'uuid' }) managerId!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty({ enum: ['AVAILABLE', 'UNAVAILABLE', 'OFF_SHIFT'] }) status!: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) changedAt!: string | null;
}

export class ManagerAvailabilityListDto {
  @ApiProperty({ type: [ManagerAvailabilityRowDto] }) managers!: ManagerAvailabilityRowDto[];
}
