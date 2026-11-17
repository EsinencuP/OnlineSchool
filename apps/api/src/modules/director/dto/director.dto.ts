import { SetMetadata } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { StaffActorContextDto } from '../../../core/actor/actor-context.dto.js';
import { STRICT_INPUT_DTO } from '../../../openapi/dto-validation.pipe.js';

export const DECISION_KINDS = [
  'PAYMENT',
  'DISTRIBUTION',
  'SCHEDULE_EXCEPTION',
  'DISPUTE',
  'TEMPORARY_ACCESS',
  'REFUND_REQUEST',
] as const;
export type DecisionKind = (typeof DECISION_KINDS)[number];

export class DecisionCountsDto {
  @ApiProperty({ type: 'integer' }) payment!: number;
  @ApiProperty({ type: 'integer' }) distribution!: number;
  @ApiProperty({ type: 'integer' }) scheduleException!: number;
  @ApiProperty({ type: 'integer' }) dispute!: number;
  @ApiProperty({ type: 'integer' }) temporaryAccess!: number;
  @ApiProperty({ type: 'integer' }) refundRequest!: number;
  @ApiProperty({ type: 'integer', description: 'Sum of all kinds' }) total!: number;
}

export class DirectorMeDto {
  @ApiProperty({ type: StaffActorContextDto }) actorContext!: StaffActorContextDto;
  @ApiProperty({ format: 'uuid' }) staffId!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty({ enum: ['DIRECTOR'] }) role!: 'DIRECTOR';
  @ApiProperty({ example: 'Europe/Chisinau' }) timezone!: string;
  @ApiProperty({ type: DecisionCountsDto }) pending!: DecisionCountsDto;
  @ApiProperty({
    type: 'integer',
    description: 'Urgent tasks routed to the director and not accepted yet (OPS-01/B)',
  })
  openEscalations!: number;
}

@SetMetadata(STRICT_INPUT_DTO, true)
export class DecisionsQueryDto {
  @ApiPropertyOptional({ enum: DECISION_KINDS })
  @IsOptional()
  @IsIn(DECISION_KINDS)
  kind?: DecisionKind;
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

export class DecisionItemDto {
  @ApiProperty({ enum: DECISION_KINDS }) kind!: DecisionKind;
  @ApiProperty({ format: 'uuid', description: 'Id of the payment, distribution, approval or task' })
  id!: string;
  @ApiProperty({ format: 'date-time', description: 'When the decision became due (oldest first)' })
  requestedAt!: string;
  @ApiProperty({ type: String, nullable: true, description: 'Manager who asked for the decision' })
  requestedBy!: string | null;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) studentId!: string | null;
  @ApiProperty({ type: String, nullable: true }) studentName!: string | null;
  @ApiProperty({ type: String, nullable: true, example: '1200.0000' }) amount!: string | null;
  @ApiProperty({ type: String, nullable: true, example: 'MDL' }) currency!: string | null;
  @ApiProperty({ description: 'The decision can be executed right now with the existing command' })
  ready!: boolean;
  @ApiProperty({ type: String, nullable: true, description: 'Why it is not ready yet' })
  blockedBy!: string | null;
}
export class DecisionPageDto {
  @ApiProperty({ type: [DecisionItemDto] }) @IsArray() items!: DecisionItemDto[];
  @ApiProperty({ type: String, nullable: true }) nextCursor!: string | null;
}

export class DecisionCommandDto {
  @ApiProperty({ example: 'confirmPayment' }) operationId!: string;
  @ApiProperty({ enum: ['GET', 'POST', 'PATCH', 'DELETE'] }) method!: string;
  @ApiProperty({ example: '/api/v1/payments/{id}/confirm' }) path!: string;
  @ApiProperty({ description: 'What the decision does' }) effect!: string;
}
export class DecisionDetailDto extends DecisionItemDto {
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'Facts needed to decide (kind specific, no secrets)',
  })
  facts!: Record<string, unknown>;
  @ApiProperty({
    type: [DecisionCommandDto],
    description: 'Existing commands that decide this item',
  })
  commands!: DecisionCommandDto[];
}
