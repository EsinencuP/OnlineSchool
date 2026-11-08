import { Injectable } from '@nestjs/common';
import type { PipeTransform } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Temporal } from '@js-temporal/polyfill';
import { object, uuid } from '../../modules/identity/input.js';
import { domainError, fail } from '../../core/errors/domain-error.js';
import { HistoryQueryDto, HistoryQueryPipe } from '../history/history.dto.js';
import type { HistoryPage } from '../history/history.dto.js';

export class ReportsQueryDto extends HistoryQueryDto {}
@Injectable()
export class ReportsQueryPipe implements PipeTransform {
  transform(value: unknown): HistoryPage {
    const input = object(value, ['page', 'pageSize']);
    return new HistoryQueryPipe().transform({ ...input, pageSize: input.pageSize ?? '10' });
  }
}
export class ExportPdfRequestDto {
  @ApiPropertyOptional({ format: 'uuid' }) subjectId?: string;
  @ApiPropertyOptional({ format: 'date' }) periodFrom?: string;
  @ApiPropertyOptional({ format: 'date' }) periodTo?: string;
}
export type ExportSelection = { subjectId?: string; periodFrom?: string; periodTo?: string };
export function exportSelection(value: unknown): ExportSelection {
  const input = object(value ?? {}, ['subjectId', 'periodFrom', 'periodTo']);
  const result: ExportSelection = {};
  if (input.subjectId !== undefined) result.subjectId = uuid(input.subjectId);
  for (const key of ['periodFrom', 'periodTo'] as const) {
    if (input[key] === undefined) continue;
    if (typeof input[key] !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input[key]))
      return fail(domainError('INVALID_INPUT', 400));
    try {
      result[key] = Temporal.PlainDate.from(input[key], { overflow: 'reject' }).toString();
    } catch {
      return fail(domainError('INVALID_INPUT', 400));
    }
  }
  if (result.periodFrom && result.periodTo && result.periodFrom > result.periodTo)
    return fail(domainError('INVALID_INPUT', 400));
  return result;
}
export class EducationalReportContentDto {
  @ApiProperty() achievements!: string;
  @ApiProperty() growthAreas!: string;
  @ApiProperty() recommendations!: string;
  @ApiProperty() teacherSignature!: string;
}
export class EducationalReportDto {
  @ApiProperty({ format: 'uuid' }) reportId!: string;
  @ApiProperty() subjectName!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date' }) periodFrom!: string;
  @ApiProperty({ format: 'date' }) periodTo!: string;
  @ApiProperty({ type: 'integer', enum: [8] }) lessonCount!: number;
  @ApiProperty() teacherName!: string;
  @ApiProperty({ type: EducationalReportContentDto }) content!: EducationalReportContentDto;
  @ApiProperty() isNew!: boolean;
}
export class ReportsResponseDto {
  @ApiProperty({ type: [EducationalReportDto] }) items!: EducationalReportDto[];
  @ApiProperty({ type: 'integer' }) total!: number;
  @ApiProperty({ type: 'integer' }) page!: number;
  @ApiProperty({ type: 'integer' }) pageSize!: number;
}
export class ExportPdfResponseDto {
  @ApiProperty({ format: 'uuid' }) jobId!: string;
  @ApiProperty({ enum: ['QUEUED'] }) status!: 'QUEUED';
  @ApiProperty({
    format: 'date-time',
    description: 'Estimate only; poll every 2s for at most 60s, then retry later',
  })
  estimatedReadyAt!: string;
}
export class PdfJobStatusDto {
  @ApiProperty({ format: 'uuid' }) jobId!: string;
  @ApiProperty({ enum: ['QUEUED', 'PROCESSING', 'READY', 'FAILED'] }) status!:
    'QUEUED' | 'PROCESSING' | 'READY' | 'FAILED';
  @ApiProperty({ type: String, nullable: true }) downloadUrl!: string | null;
  @ApiProperty({ type: String, nullable: true, format: 'date-time' }) expiresAt!: string | null;
  @ApiProperty({ type: String, nullable: true }) failureReason!: string | null;
}
