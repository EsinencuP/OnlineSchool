import { Injectable } from '@nestjs/common';
import type { PipeTransform } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { object, uuid } from '../../modules/identity/input.js';
import { HistoryQueryPipe } from '../history/history.dto.js';

export type MaterialsQuery = { page: number; pageSize: number; subjectId?: string };
export class MaterialsQueryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Educational subject ID, not the permission recipient account',
  })
  subjectId?: string;
  @ApiPropertyOptional({ type: 'integer', minimum: 1, default: 1 }) page?: number;
  @ApiPropertyOptional({ type: 'integer', minimum: 1, maximum: 100, default: 30 })
  pageSize?: number;
}
@Injectable()
export class MaterialsQueryPipe implements PipeTransform {
  transform(value: unknown): MaterialsQuery {
    const input = object(value, ['subjectId', 'page', 'pageSize']);
    const page = new HistoryQueryPipe().transform({
      ...(input.page !== undefined ? { page: input.page } : {}),
      pageSize: input.pageSize === undefined ? '30' : input.pageSize,
    });
    return {
      ...page,
      ...(input.subjectId !== undefined ? { subjectId: uuid(input.subjectId) } : {}),
    };
  }
}
export class MaterialItemDto {
  @ApiProperty({ format: 'uuid' }) fileId!: string;
  @ApiProperty() fileName!: string;
  @ApiProperty({ type: 'integer' }) fileSizeBytes!: number;
  @ApiProperty() mimeType!: string;
  @ApiProperty({
    description: 'Explicit educational context, or «Без предмета» for legacy/contextless grants',
  })
  subjectName!: string;
  @ApiProperty({ format: 'date-time' }) uploadedAt!: string;
  @ApiProperty({ format: 'date-time' }) sharedAt!: string;
  @ApiProperty() sharedByTeacherName!: string;
  @ApiProperty({ type: String, nullable: true }) lessonTitle!: string | null;
}
export class MaterialsResponseDto {
  @ApiProperty({ type: [MaterialItemDto] }) items!: MaterialItemDto[];
  @ApiProperty({ type: 'integer' }) total!: number;
  @ApiProperty({ type: 'integer' }) page!: number;
  @ApiProperty({ type: 'integer' }) pageSize!: number;
}
export class FileSignedUrlResponseDto {
  @ApiProperty({
    description:
      'Private HTTPS presigned GET capability. Maximum lifetime 15 minutes; shorter if the explicit permission expires first.',
  })
  url!: string;
  @ApiProperty({ format: 'date-time' }) expiresAt!: string;
  @ApiProperty() fileName!: string;
}
