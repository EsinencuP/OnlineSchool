import { SetMetadata } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { STRICT_INPUT_DTO } from '../../../openapi/dto-validation.pipe.js';

export const REQUEST_STATUSES = ['PENDING', 'RESOLVED'] as const;

@SetMetadata(STRICT_INPUT_DTO, true)
export class TeacherAvailabilityQueryDto {
  @ApiPropertyOptional({ format: 'date-time', description: 'Defaults to now' })
  @IsOptional()
  @IsISO8601({ strict: true })
  from?: string;
  @ApiPropertyOptional({
    format: 'date-time',
    description: 'Defaults to from + 90 days; the span is at most 366 days',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  to?: string;
  @ApiPropertyOptional({ enum: ['true', 'false'], default: 'false' })
  @IsOptional()
  @IsIn(['true', 'false'])
  includeCancelled?: 'true' | 'false';
}

export class TeacherAvailabilityWindowDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() availabilityId!: string;
  @ApiProperty({ format: 'date-time' }) startsAt!: string;
  @ApiProperty({ format: 'date-time' }) endsAt!: string;
  @ApiProperty({ example: 'Europe/Chisinau' }) @IsString() timezone!: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) cancelledAt!: string | null;
  @ApiProperty({
    description: 'Non-cancelled lessons overlap the window: edits need a manager request',
  })
  @IsBoolean()
  occupied!: boolean;
  @ApiProperty({ type: 'integer', minimum: 0 }) lessonCount!: number;
}

export class TeacherAvailabilityResponseDto {
  @ApiProperty({ format: 'date-time' }) from!: string;
  @ApiProperty({ format: 'date-time' }) to!: string;
  @ApiProperty({ format: 'date-time' }) asOf!: string;
  @ApiProperty({ type: [TeacherAvailabilityWindowDto] })
  @IsArray()
  windows!: TeacherAvailabilityWindowDto[];
}

@SetMetadata(STRICT_INPUT_DTO, true)
export class TeacherRequestsQueryDto {
  @ApiPropertyOptional({ enum: REQUEST_STATUSES })
  @IsOptional()
  @IsIn(REQUEST_STATUSES)
  status?: (typeof REQUEST_STATUSES)[number];
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
  @MaxLength(200)
  cursor?: string;
}

export class TeacherScheduleRequestDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() requestId!: string;
  @ApiProperty({ enum: REQUEST_STATUSES }) status!: (typeof REQUEST_STATUSES)[number];
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty() @IsString() reason!: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) requestedStartAt!:
    string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) requestedEndAt!:
    string | null;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) lessonId!: string | null;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) slotId!: string | null;
  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'Current time of the targeted lesson',
  })
  lessonStartsAt!: string | null;
  @ApiProperty() @IsString() studentName!: string;
  @ApiProperty() @IsString() subjectName!: string;
}

export class TeacherScheduleRequestPageDto {
  @ApiProperty({ type: [TeacherScheduleRequestDto] })
  @IsArray()
  items!: TeacherScheduleRequestDto[];
  @ApiProperty({ type: String, nullable: true }) nextCursor!: string | null;
}
