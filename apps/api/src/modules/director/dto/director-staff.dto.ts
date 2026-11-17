import { SetMetadata } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { STRICT_INPUT_DTO } from '../../../openapi/dto-validation.pipe.js';

export const STAFF_KINDS = ['MANAGER', 'TEACHER'] as const;
export type StaffKind = (typeof STAFF_KINDS)[number];

@SetMetadata(STRICT_INPUT_DTO, true)
export class StaffQueryDto {
  @ApiPropertyOptional({ enum: STAFF_KINDS }) @IsOptional() @IsIn(STAFF_KINDS) kind?: StaffKind;
  @ApiPropertyOptional({ description: 'true: only active, false: only deactivated; default: all' })
  @IsOptional()
  @Type(() => String)
  @IsIn(['true', 'false'])
  active?: 'true' | 'false';
  @ApiPropertyOptional({ maxLength: 100, description: 'Case-insensitive name fragment' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

export class StaffItemDto {
  @ApiProperty({ enum: STAFF_KINDS }) kind!: StaffKind;
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty() active!: boolean;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) deactivatedAt!: string | null;
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description:
      'MANAGER: students, leads, openTasks, openEscalations, availability. TEACHER: activeStudents, lessonsNext7Days, futureLessons',
  })
  metrics!: Record<string, number | string | null>;
}

export class StaffListDto {
  @ApiProperty({ type: [StaffItemDto] }) items!: StaffItemDto[];
}

export class StatusChangeDto {
  @ApiProperty({ enum: ['DEACTIVATED', 'REACTIVATED'] }) action!: string;
  @ApiProperty() reason!: string;
  @ApiProperty() byDirectorName!: string;
  @ApiProperty({ format: 'date-time' }) changedAt!: string;
}

export class HandoverDto {
  @ApiProperty({ format: 'uuid' }) handoverId!: string;
  @ApiProperty({ enum: ['STUDENT', 'LEAD'] }) subjectKind!: 'STUDENT' | 'LEAD';
  @ApiProperty({ format: 'uuid' }) subjectId!: string;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) fromManagerId!: string | null;
  @ApiProperty({ type: String, nullable: true }) fromManagerName!: string | null;
  @ApiProperty({ format: 'uuid' }) toManagerId!: string;
  @ApiProperty() toManagerName!: string;
  @ApiProperty({ type: 'integer', description: 'Open tasks that moved with the client' })
  movedTasks!: number;
  @ApiProperty({ type: String, nullable: true }) comment!: string | null;
  @ApiProperty({ format: 'date-time' }) handedOverAt!: string;
}

export class StaffCardDto extends StaffItemDto {
  @ApiProperty({ type: [StatusChangeDto] }) statusHistory!: StatusChangeDto[];
  @ApiProperty({
    type: [HandoverDto],
    description: 'MANAGER: latest hand-overs to or from this manager',
  })
  handovers!: HandoverDto[];
}

@SetMetadata(STRICT_INPUT_DTO, true)
export class HandoverCommandDto {
  @ApiProperty({ format: 'uuid', description: 'Active manager who becomes responsible' })
  @IsUUID()
  managerId!: string;
  @ApiPropertyOptional({ minLength: 3, maxLength: 500 })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  comment?: string;
}

@SetMetadata(STRICT_INPUT_DTO, true)
export class StaffStatusCommandDto {
  @ApiProperty({ minLength: 3, maxLength: 500, description: 'Kept in the status history' })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

@SetMetadata(STRICT_INPUT_DTO, true)
export class HandoversQueryDto {
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() studentId?: string;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() leadId?: string;
  @ApiPropertyOptional({ type: 'integer', minimum: 1, maximum: 100, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class HandoverListDto {
  @ApiProperty({ type: [HandoverDto], description: 'Newest first' }) items!: HandoverDto[];
}
