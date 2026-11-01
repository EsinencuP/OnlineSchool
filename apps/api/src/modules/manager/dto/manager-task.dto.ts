import { SetMetadata } from '@nestjs/common';
import { ApiExtraModels, ApiProperty, ApiPropertyOptional, getSchemaPath } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ArrayMaxSize,
  ValidateIf,
} from 'class-validator';
import { STRICT_INPUT_DTO } from '../../../openapi/dto-validation.pipe.js';
import { INSTANT } from '../../schedule/manager/policy.js';
import { IsMoneyString } from '../validators/is-money-string.js';
import { MANAGER_TASK_TYPES, TASK_STATUSES } from '../tasks/contracts.js';
import type {
  ManagerTaskType,
  ManagerTaskStatus,
  TaskPayload,
  TaskView,
} from '../tasks/contracts.js';
const csv = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.split(',') : value;
@SetMetadata(STRICT_INPUT_DTO, true)
export class ListManagerTasksDto {
  @ApiPropertyOptional({
    type: String,
    description: 'Comma-separated OPEN, IN_PROGRESS, RESOLVED, REJECTED',
  })
  @IsOptional()
  @Transform(csv)
  @IsArray()
  @ArrayMaxSize(4)
  @IsIn(TASK_STATUSES, { each: true })
  status?: ManagerTaskStatus[];
  @ApiPropertyOptional({
    type: String,
    description:
      'Comma-separated RESCHEDULE_REQUEST, CHARGE_DISPUTE, SUBSCRIPTION_EXPIRING, GENERAL',
  })
  @IsOptional()
  @Transform(csv)
  @IsArray()
  @ArrayMaxSize(4)
  @IsIn(MANAGER_TASK_TYPES, { each: true })
  type?: ManagerTaskType[];
  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  overdue?: boolean;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() studentId?: string;
  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(INSTANT)
  dueBefore?: string;
  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  cursor?: string;
  @ApiPropertyOptional({ type: 'integer', default: 25, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 25;
}
@SetMetadata(STRICT_INPUT_DTO, true)
export class ClaimManagerTaskDto {
  @ApiProperty({ type: 'integer', minimum: 1 }) @IsInt() @Min(1) version!: number;
}
@SetMetadata(STRICT_INPUT_DTO, true)
export class ResolveManagerRescheduleDto {
  @ApiProperty({ enum: ['APPROVE', 'DECLINE'] }) @IsIn(['APPROVE', 'DECLINE']) decision!:
    'APPROVE' | 'DECLINE';
  @ApiPropertyOptional({ format: 'date-time', description: 'Required for APPROVE' })
  @ValidateIf((o) => o.decision === 'APPROVE')
  @IsISO8601({ strict: true })
  @Matches(INSTANT)
  newStartsAt?: string;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() newTeacherId?: string;
  @ApiPropertyOptional({
    minLength: 3,
    maxLength: 500,
    description: 'Required for DECLINE; default approval basis otherwise',
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() overrideLateRule?: boolean;
  @ApiProperty({ type: 'integer', minimum: 1 }) @IsInt() @Min(1) version!: number;
}
@SetMetadata(STRICT_INPUT_DTO, true)
export class ResolveManagerDisputeDto {
  @ApiProperty({ enum: ['ACCEPT', 'REJECT', 'ESCALATE'] })
  @IsIn(['ACCEPT', 'REJECT', 'ESCALATE'])
  decision!: 'ACCEPT' | 'REJECT' | 'ESCALATE';
  @ApiProperty({ minLength: 3, maxLength: 1000 })
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reason!: string;
  @ApiPropertyOptional({
    type: String,
    description:
      'Exact positive monetary string; full reversal restores advance, never pays out cash',
  })
  @IsOptional()
  @IsMoneyString()
  refundAmount?: string;
  @ApiPropertyOptional({ type: 'integer', minimum: 0, maximum: 10 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  refundLessons?: number;
  @ApiProperty({ type: 'integer', minimum: 1 }) @IsInt() @Min(1) version!: number;
}
export class TaskPreferredWindowDto {
  @ApiProperty({ format: 'date-time' }) from!: string;
  @ApiProperty({ format: 'date-time' }) to!: string;
}
export class TaskReschedulePayloadDto {
  @ApiProperty({ enum: ['RESCHEDULE_REQUEST'] }) kind!: 'RESCHEDULE_REQUEST';
  @ApiProperty({ format: 'uuid' }) lessonId!: string;
  @ApiProperty({ format: 'date-time' }) currentStartsAt!: string;
  @ApiProperty({ type: String, nullable: true }) studentComment!: string | null;
  @ApiProperty({ type: [TaskPreferredWindowDto] }) preferredWindows!: TaskPreferredWindowDto[];
  @ApiProperty({ type: String, nullable: true, format: 'date' }) preferredDate!: string | null;
}
export class TaskDisputePayloadDto {
  @ApiProperty({ enum: ['CHARGE_DISPUTE'] }) kind!: 'CHARGE_DISPUTE';
  @ApiProperty({ format: 'uuid' }) lessonId!: string;
  @ApiProperty({ type: String, nullable: true }) ledgerRef!: string | null;
  @ApiProperty({ type: 'integer' }) chargedLessons!: number;
  @ApiProperty({ type: String, nullable: true }) chargedAmount!: string | null;
  @ApiProperty({ type: String, nullable: true }) currency!: string | null;
  @ApiProperty() studentComment!: string;
}
export class TaskExpiringPayloadDto {
  @ApiProperty({ enum: ['SUBSCRIPTION_EXPIRING'] }) kind!: 'SUBSCRIPTION_EXPIRING';
  @ApiProperty({ format: 'uuid' }) subscriptionId!: string;
  @ApiProperty({ format: 'date-time' }) endsAt!: string;
}
export class TaskGeneralPayloadDto {
  @ApiProperty({ enum: ['GENERAL'] }) kind!: 'GENERAL';
  @ApiProperty() text!: string;
}
@ApiExtraModels(
  TaskReschedulePayloadDto,
  TaskDisputePayloadDto,
  TaskExpiringPayloadDto,
  TaskGeneralPayloadDto,
)
export class ManagerTaskDto {
  @ApiProperty({ format: 'uuid' }) taskId!: string;
  @ApiProperty({ enum: MANAGER_TASK_TYPES }) type!: ManagerTaskType;
  @ApiProperty({ enum: TASK_STATUSES }) status!: ManagerTaskStatus;
  @ApiProperty({ type: 'integer' }) version!: number;
  @ApiProperty({ format: 'uuid' }) studentId!: string;
  @ApiProperty() studentName!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) dueAt!: string;
  @ApiProperty() isOverdue!: boolean;
  @ApiProperty({ type: String, nullable: true, format: 'date-time' }) escalatedAt!: string | null;
  @ApiProperty({
    enum: ['NONE', 'AWAITING_DIRECTOR', 'MANUAL_FINANCE_REVIEW', 'AWAITING_SCHEDULE_APPROVAL'],
  })
  approvalStatus!: TaskView['approvalStatus'];
  @ApiProperty({
    oneOf: [
      TaskReschedulePayloadDto,
      TaskDisputePayloadDto,
      TaskExpiringPayloadDto,
      TaskGeneralPayloadDto,
    ].map((c) => ({ $ref: getSchemaPath(c) })),
    discriminator: { propertyName: 'kind' },
  })
  payload!: TaskPayload;
  @ApiProperty({ type: String, nullable: true, format: 'uuid' }) ledgerPublicationId!:
    string | null;
}
export class ManagerTaskPageDto {
  @ApiProperty({ type: [ManagerTaskDto] }) items!: ManagerTaskDto[];
  @ApiProperty({ type: String, nullable: true }) nextCursor!: string | null;
}
export class ManagerTaskDetailDto extends ManagerTaskDto {
  @ApiProperty({
    type: Object,
    nullable: true,
    description: 'Whitelisted last decision; student comments are plain text, never HTML',
  })
  resolution!: Record<string, unknown> | null;
}
