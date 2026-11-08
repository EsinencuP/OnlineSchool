import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsIn, IsInt, IsString, IsTimeZone, IsUUID, Min } from 'class-validator';
import { MANAGER_CAPABILITIES } from '../context/manager-context.js';
import type { ManagerCapability } from '../context/manager-context.js';

export class ManagerMeResponseDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() managerId!: string;
  @ApiProperty() @IsString() displayName!: string;
  @ApiProperty({ enum: ['MANAGER'] }) @IsIn(['MANAGER']) role!: 'MANAGER';
  @ApiProperty({ type: 'integer', minimum: 0 }) @IsInt() @Min(0) portfolioSize!: number;
  @ApiProperty({ example: 'Europe/Chisinau' }) @IsTimeZone() timezone!: string;
  @ApiProperty({ type: [String], enum: MANAGER_CAPABILITIES, isArray: true })
  @IsArray()
  @IsIn(MANAGER_CAPABILITIES, { each: true })
  capabilities!: ManagerCapability[];
}
