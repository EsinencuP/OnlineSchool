import { Injectable } from '@nestjs/common';
import type { PipeTransform } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { object } from '../../modules/identity/input.js';
import { domainError, fail } from '../../core/errors/domain-error.js';
import { HistoryQueryPipe } from '../history/history.dto.js';

export const HOMEWORK_STATUSES = [
  'NOT_SUBMITTED',
  'SUBMITTED',
  'REVIEWED',
  'NEEDS_REVISION',
] as const;
export type HomeworkStatus = (typeof HOMEWORK_STATUSES)[number];
export type HomeworkQuery = { page: number; pageSize: number; status?: HomeworkStatus };
export class HomeworkQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 }) page?: number;
  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 }) pageSize?: number;
  @ApiPropertyOptional({ enum: HOMEWORK_STATUSES }) status?: HomeworkStatus;
}
@Injectable()
export class HomeworkQueryPipe implements PipeTransform {
  transform(value: unknown): HomeworkQuery {
    const input = object(value, ['page', 'pageSize', 'status']);
    const page = new HistoryQueryPipe().transform({
      ...(input.page !== undefined ? { page: input.page } : {}),
      ...(input.pageSize !== undefined ? { pageSize: input.pageSize } : {}),
    });
    if (input.status === undefined) return page;
    if (!HOMEWORK_STATUSES.includes(input.status as HomeworkStatus))
      return fail(domainError('INVALID_INPUT', 400));
    return { ...page, status: input.status as HomeworkStatus };
  }
}
export class HomeworkAttachmentDto {
  @ApiProperty({ format: 'uuid' }) fileId!: string;
  @ApiProperty() fileName!: string;
  @ApiProperty({ type: 'integer', maximum: 52428800 }) fileSizeBytes!: number;
  @ApiProperty() mimeType!: string;
}
export class HomeworkVersionDto {
  @ApiProperty({ type: 'integer' }) versionNumber!: number;
  @ApiProperty() content!: string;
  @ApiProperty({ format: 'date-time' }) submittedAt!: string;
  @ApiProperty({ type: String, nullable: true }) teacherComment!: string | null;
  @ApiProperty({ type: String, nullable: true, enum: ['REVIEWED', 'NEEDS_REVISION'] })
  teacherStatus!: 'REVIEWED' | 'NEEDS_REVISION' | null;
  @ApiProperty({ type: [HomeworkAttachmentDto] }) attachments!: HomeworkAttachmentDto[];
}
export class HomeworkItemDto {
  @ApiProperty({ format: 'uuid' }) homeworkId!: string;
  @ApiProperty({ format: 'date-time' }) assignedAt!: string;
  @ApiProperty({ type: String, nullable: true, format: 'date-time' }) dueAt!: string | null;
  @ApiProperty() subjectName!: string;
  @ApiProperty() teacherName!: string;
  @ApiProperty() title!: string;
  @ApiProperty() description!: string;
  @ApiProperty({ enum: HOMEWORK_STATUSES }) status!: HomeworkStatus;
  @ApiProperty() isLate!: boolean;
  @ApiProperty({ type: String, nullable: true }) draftContent!: string | null;
  @ApiProperty({ type: HomeworkVersionDto, nullable: true })
  latestVersion!: HomeworkVersionDto | null;
  @ApiProperty({ type: [HomeworkVersionDto] }) versions!: HomeworkVersionDto[];
  @ApiProperty({ type: [HomeworkAttachmentDto] }) attachments!: HomeworkAttachmentDto[];
}
export class HomeworkResponseDto {
  @ApiProperty({ type: [HomeworkItemDto] }) items!: HomeworkItemDto[];
  @ApiProperty({ type: 'integer' }) total!: number;
  @ApiProperty({ type: 'integer' }) page!: number;
  @ApiProperty({ type: 'integer' }) pageSize!: number;
}
export class SaveDraftDto {
  @ApiProperty({ maxLength: 10000 }) @IsString() @MaxLength(10000) content!: string;
}
export class SavedDraftDto {
  @ApiProperty({ format: 'uuid' }) homeworkId!: string;
  @ApiProperty({ enum: ['SAVED'] }) status!: 'SAVED';
  @ApiProperty({ format: 'date-time' }) expiresAt!: string;
}
export class RequestUploadUrlDto {
  @ApiProperty({ maxLength: 255 }) @IsString() @MinLength(1) @MaxLength(255) fileName!: string;
  @ApiProperty({ maxLength: 127 }) @IsString() @MaxLength(127) mimeType!: string;
  @ApiProperty({ type: 'integer', minimum: 1, maximum: 52428800 })
  @IsInt()
  @Min(1)
  @Max(52428800)
  fileSizeBytes!: number;
}
export class UploadUrlResponseDto {
  @ApiProperty() uploadUrl!: string;
  @ApiProperty({ format: 'uuid' }) fileId!: string;
}
export class ConfirmUploadResponseDto {
  @ApiProperty({ format: 'uuid' }) fileId!: string;
  @ApiProperty({ enum: ['VERIFIED'] }) status!: 'VERIFIED';
}
export class SubmitHomeworkDto {
  @ApiProperty({ minLength: 1, maxLength: 10000 })
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  content!: string;
  @ApiPropertyOptional({ type: [String], format: 'uuid', maxItems: 20 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  fileIds?: string[];
}
export class SubmitResponseDto {
  @ApiProperty({ format: 'uuid' }) submissionId!: string;
  @ApiProperty({ enum: ['SUBMITTED'] }) status!: 'SUBMITTED';
  @ApiProperty() isLate!: boolean;
  @ApiProperty({ type: 'integer' }) versionNumber!: number;
}
