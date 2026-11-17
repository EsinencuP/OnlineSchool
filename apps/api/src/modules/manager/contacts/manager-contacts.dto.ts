import { SetMetadata } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { STRICT_INPUT_DTO } from '../../../openapi/dto-validation.pipe.js';

export const CONTACT_CHANNELS = [
  'CALL',
  'WHATSAPP',
  'TELEGRAM',
  'MESSAGE',
  'EMAIL',
  'OTHER',
] as const;
export const CONTACT_RESULTS = [
  'REACHED',
  'NO_ANSWER',
  'CALLBACK_REQUESTED',
  'DECLINED',
  'WRONG_CONTACT',
  'OTHER',
] as const;
export type ContactChannelName = (typeof CONTACT_CHANNELS)[number];
export type ContactResultName = (typeof CONTACT_RESULTS)[number];

@SetMetadata(STRICT_INPUT_DTO, true)
export class RecordContactDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Exactly one of leadId, studentId, teacherId',
  })
  @IsOptional()
  @IsUUID()
  leadId?: string;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() studentId?: string;
  @ApiPropertyOptional({ format: 'uuid', description: 'A teacher of one of your students' })
  @IsOptional()
  @IsUUID()
  teacherId?: string;
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Linked representative; student contacts only',
  })
  @IsOptional()
  @IsUUID()
  representativeId?: string;
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Related CRM task; recording does not close it',
  })
  @IsOptional()
  @IsUUID()
  taskId?: string;
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Fixes an earlier entry; the subject is taken from it and the old entry stays',
  })
  @IsOptional()
  @IsUUID()
  correctsId?: string;
  @ApiProperty({ enum: CONTACT_CHANNELS }) @IsIn(CONTACT_CHANNELS) channel!: ContactChannelName;
  @ApiProperty({
    enum: CONTACT_RESULTS,
    description: 'NO_ANSWER is an attempt, not an informed family',
  })
  @IsIn(CONTACT_RESULTS)
  result!: ContactResultName;
  @ApiProperty({ minLength: 3, maxLength: 300, description: 'Short result; no message texts' })
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  summary!: string;
  @ApiPropertyOptional({ minLength: 3, maxLength: 300 })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  nextAction?: string;
  @ApiPropertyOptional({
    format: 'date-time',
    description: 'When the contact happened; defaults to now, never in the future',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  occurredAt?: string;
}

@SetMetadata(STRICT_INPUT_DTO, true)
export class ListContactsQueryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Exactly one of leadId, studentId, teacherId',
  })
  @IsOptional()
  @IsUUID()
  leadId?: string;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() studentId?: string;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() teacherId?: string;
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

export class ContactDto {
  @ApiProperty({ format: 'uuid' }) contactId!: string;
  @ApiProperty({ enum: ['LEAD', 'STUDENT', 'TEACHER'] }) subjectKind!:
    'LEAD' | 'STUDENT' | 'TEACHER';
  @ApiProperty({ format: 'uuid' }) subjectId!: string;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) representativeId!: string | null;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) taskId!: string | null;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) correctsId!: string | null;
  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'Set when a later entry fixed this one; show the fixing entry instead',
  })
  supersededById!: string | null;
  @ApiProperty({ enum: CONTACT_CHANNELS }) channel!: ContactChannelName;
  @ApiProperty({ enum: CONTACT_RESULTS }) result!: ContactResultName;
  @ApiProperty() summary!: string;
  @ApiProperty({ type: String, nullable: true }) nextAction!: string | null;
  @ApiProperty({ format: 'date-time', description: 'When the contact happened' })
  occurredAt!: string;
  @ApiProperty({ format: 'date-time', description: 'When the server recorded it' })
  recordedAt!: string;
  @ApiProperty({ format: 'uuid' }) managerId!: string;
  @ApiProperty() managerName!: string;
}

export class ContactPageDto {
  @ApiProperty({ type: [ContactDto] }) items!: ContactDto[];
  @ApiProperty({ type: String, nullable: true }) nextCursor!: string | null;
}

export class LastContactDto {
  @ApiProperty({ format: 'date-time' }) occurredAt!: string;
  @ApiProperty({ enum: CONTACT_CHANNELS }) channel!: ContactChannelName;
  @ApiProperty({ enum: CONTACT_RESULTS }) result!: ContactResultName;
}

export class PendingContactDto {
  @ApiProperty({ format: 'uuid' }) taskId!: string;
  @ApiProperty({ example: 'FOLLOW_UP' }) taskType!: string;
  @ApiProperty() title!: string;
  @ApiProperty({ format: 'date-time' }) dueAt!: string;
  @ApiProperty() overdue!: boolean;
  @ApiProperty({ enum: ['LEAD', 'STUDENT'] }) subjectKind!: 'LEAD' | 'STUDENT';
  @ApiProperty({ format: 'uuid' }) subjectId!: string;
  @ApiProperty() subjectName!: string;
  @ApiProperty({ type: LastContactDto, nullable: true }) lastContact!: LastContactDto | null;
}

export class PendingContactsDto {
  @ApiProperty({ type: [PendingContactDto], description: 'Most overdue first, at most 50' })
  items!: PendingContactDto[];
}
