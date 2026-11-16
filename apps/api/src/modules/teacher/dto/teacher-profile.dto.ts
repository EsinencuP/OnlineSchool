import { SetMetadata } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { IsArray, Matches, ValidateIf } from 'class-validator';
import { STRICT_INPUT_DTO } from '../../../openapi/dto-validation.pipe.js';

export class TeacherPasskeyDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) lastUsedAt!: string | null;
  @ApiProperty() backedUp!: boolean;
}
export class TeacherProfileDto {
  @ApiProperty({ format: 'uuid' }) teacherId!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Read-only: changed by school staff after identity checks',
  })
  email!: string | null;
  @ApiProperty({ type: String, nullable: true, example: '+37360000000' }) phone!: string | null;
  @ApiProperty({ example: 'Europe/Chisinau' }) timezone!: string;
  @ApiProperty({
    type: [TeacherPasskeyDto],
    description: 'Active passkeys (MFA); credential material is never exposed',
  })
  @IsArray()
  passkeys!: TeacherPasskeyDto[];
}

@SetMetadata(STRICT_INPUT_DTO, true)
export class UpdateTeacherProfileDto {
  @ApiProperty({
    type: String,
    nullable: true,
    example: '+37360000000',
    description: 'E.164; null clears the number',
  })
  @ValidateIf((_, v) => v !== null)
  @Matches(/^\+[1-9][0-9]{6,14}$/)
  phone!: string | null;
}
export class UpdateTeacherProfileResponseDto {
  @ApiProperty({ format: 'uuid', description: 'Teacher id' }) id!: string;
  @ApiProperty({ type: String, nullable: true }) phone!: string | null;
}
