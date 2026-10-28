import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, IsUUID, MinLength } from 'class-validator';
import { StudentMeResponseDto } from '../me/me.dto.js';
export class UpdateProfileDto {
  @ApiPropertyOptional({ minLength: 1, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  displayName?: string;
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Pre-uploaded verified owned JPEG/PNG/WebP, up to2MiB',
  })
  @IsOptional()
  @IsUUID()
  avatarFileId?: string;
}
export class StudentProfileDto extends StudentMeResponseDto {
  @ApiProperty({ type: String, nullable: true, format: 'uuid' }) avatarFileId!: string | null;
}
