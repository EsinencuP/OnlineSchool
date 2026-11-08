import { SetMetadata } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MinLength, MaxLength, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { STRICT_INPUT_DTO } from '../../../openapi/dto-validation.pipe.js';
import { MANAGER_TEMPLATE_CODES } from '../../notifications/templates.js';
@SetMetadata(STRICT_INPUT_DTO, true)
export class SendManagerNotificationDto {
  @ApiProperty({ enum: ['IN_APP', 'EMAIL'] }) @IsIn(['IN_APP', 'EMAIL']) channel!:
    'IN_APP' | 'EMAIL';
  @ApiPropertyOptional({ maxLength: 150 })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  subject?: string;
  @ApiProperty({ minLength: 1, maxLength: 2000 })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body!: string;
}
@SetMetadata(STRICT_INPUT_DTO, true)
export class ListManagerNotificationsDto {
  @ApiPropertyOptional({ enum: ['QUEUED', 'SENT', 'FAILED'] })
  @IsOptional()
  @IsIn(['QUEUED', 'SENT', 'FAILED'])
  status?: 'QUEUED' | 'SENT' | 'FAILED';
  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  cursor?: string;
  @ApiPropertyOptional({ type: 'integer', default: 25, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 25;
}
export class ManagerNotificationDto {
  @ApiProperty({ format: 'uuid' }) notificationId!: string;
  @ApiProperty({ format: 'uuid' }) studentId!: string;
  @ApiProperty({ enum: ['IN_APP', 'EMAIL'] }) channel!: 'IN_APP' | 'EMAIL';
  @ApiProperty({ enum: MANAGER_TEMPLATE_CODES }) templateCode!: string;
  @ApiProperty({ enum: ['QUEUED', 'SENT', 'FAILED'] }) status!: 'QUEUED' | 'SENT' | 'FAILED';
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ type: String, nullable: true, format: 'date-time' }) sentAt!: string | null;
  @ApiProperty({ type: String, nullable: true }) failureReason!: string | null;
}
export class ManagerNotificationPageDto {
  @ApiProperty({ type: [ManagerNotificationDto] }) items!: ManagerNotificationDto[];
  @ApiProperty({ type: String, nullable: true }) nextCursor!: string | null;
}
