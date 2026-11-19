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
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { STRICT_INPUT_DTO } from '../../../openapi/dto-validation.pipe.js';
import { MATERIAL_MIME_TYPES } from '../../storage/upload-format.js';

export const MAX_MATERIAL_BYTES = 52_428_800;
export const MATERIAL_STATES = ['PENDING', 'VERIFIED'] as const;

@SetMetadata(STRICT_INPUT_DTO, true)
export class RequestMaterialUploadDto {
  @ApiProperty({ minLength: 1, maxLength: 255 }) @IsString() @Length(1, 255) fileName!: string;
  @ApiProperty({ type: 'integer', minimum: 1, maximum: MAX_MATERIAL_BYTES })
  @IsInt()
  @Min(1)
  @Max(MAX_MATERIAL_BYTES)
  fileSizeBytes!: number;
  @ApiProperty({ enum: MATERIAL_MIME_TYPES, example: 'application/pdf' })
  @IsIn(MATERIAL_MIME_TYPES)
  mimeType!: string;
}
export class MaterialUploadResponseDto {
  @ApiProperty({ format: 'uuid', description: 'File id' }) id!: string;
  @ApiProperty({ description: 'Short-lived signed PUT URL for the staging object' })
  uploadUrl!: string;
  @ApiProperty({ format: 'date-time' }) expiresAt!: string;
}
export class MaterialConfirmResponseDto {
  @ApiProperty({ format: 'uuid', description: 'File id' }) id!: string;
  @ApiProperty({ enum: ['VERIFIED'] }) status!: 'VERIFIED';
}

@SetMetadata(STRICT_INPUT_DTO, true)
export class TeacherMaterialsQueryDto {
  @ApiPropertyOptional({ enum: MATERIAL_STATES })
  @IsOptional()
  @IsIn(MATERIAL_STATES)
  state?: (typeof MATERIAL_STATES)[number];
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
export class TeacherMaterialDto {
  @ApiProperty({ format: 'uuid' }) fileId!: string;
  @ApiProperty() fileName!: string;
  @ApiProperty({ type: 'integer' }) sizeBytes!: number;
  @ApiProperty() mimeType!: string;
  @ApiProperty({ enum: MATERIAL_STATES }) status!: (typeof MATERIAL_STATES)[number];
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ type: 'integer', minimum: 0, description: 'Currently active grants of this file' })
  activeGrants!: number;
}
export class TeacherMaterialPageDto {
  @ApiProperty({ type: [TeacherMaterialDto] }) @IsArray() items!: TeacherMaterialDto[];
  @ApiProperty({ type: String, nullable: true }) nextCursor!: string | null;
}

@SetMetadata(STRICT_INPUT_DTO, true)
export class ShareMaterialDto {
  @ApiProperty({
    format: 'uuid',
    description: 'A taught enrollment; the student gets the file for its subject',
  })
  @IsUUID()
  enrollmentId!: string;
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Optional lesson of this enrollment the file belongs to',
  })
  @IsOptional()
  @IsUUID()
  lessonId?: string;
  @ApiPropertyOptional({ maxLength: 200, description: 'Display title shown with the lesson' })
  @IsOptional()
  @IsString()
  @Length(1, 200)
  lessonTitle?: string;
  @ApiProperty({ description: 'Allow saving (attachment) instead of in-browser viewing only' })
  @IsBoolean()
  canDownload!: boolean;
  @ApiPropertyOptional({ format: 'date-time', description: 'Access ends at this instant' })
  @IsOptional()
  @IsISO8601({ strict: true })
  expiresAt?: string;
}
export class ShareMaterialResponseDto {
  @ApiProperty({ format: 'uuid', description: 'Permission id' }) id!: string;
  @ApiProperty({ format: 'uuid' }) fileId!: string;
}
export class RevokeMaterialResponseDto {
  @ApiProperty({ format: 'uuid', description: 'Permission id' }) id!: string;
  @ApiProperty({ format: 'date-time' }) revokedAt!: string;
}

export class TeacherSharedMaterialDto {
  @ApiProperty({ format: 'uuid' }) permissionId!: string;
  @ApiProperty({ format: 'uuid' }) fileId!: string;
  @ApiProperty() fileName!: string;
  @ApiProperty() canDownload!: boolean;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) lessonId!: string | null;
  @ApiProperty({ type: String, nullable: true }) lessonTitle!: string | null;
  @ApiProperty({ format: 'date-time' }) sharedAt!: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) expiresAt!: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) revokedAt!: string | null;
}
export class TeacherSharedMaterialsDto {
  @ApiProperty({ format: 'uuid' }) enrollmentId!: string;
  @ApiProperty({
    type: [TeacherSharedMaterialDto],
    description: 'Grants issued by this teacher, newest first (max 200)',
  })
  items!: TeacherSharedMaterialDto[];
}
