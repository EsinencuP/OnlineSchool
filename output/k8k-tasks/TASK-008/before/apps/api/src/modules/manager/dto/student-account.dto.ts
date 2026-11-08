import { SetMetadata } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, MaxLength } from 'class-validator';
import { STRICT_INPUT_DTO } from '../../../openapi/dto-validation.pipe.js';
@SetMetadata(STRICT_INPUT_DTO, true)
export class CreateStudentAccountDto {
  @ApiProperty({ maxLength: 254 }) @IsEmail() @MaxLength(254) loginEmail!: string;
}
export class StudentAccountIssuedDto {
  @ApiProperty({ format: 'uuid' }) accountId!: string;
  @ApiProperty() loginEmail!: string;
  @ApiProperty({
    type: String,
    nullable: true,
    format: 'password',
    description: 'One-time secret in the first successful response only. Never cached.',
  })
  temporaryPassword!: string | null;
  @ApiProperty({ format: 'date-time' }) temporaryPasswordExpiresAt!: string;
  @ApiProperty() passwordAlreadyIssued!: boolean;
}
@SetMetadata(STRICT_INPUT_DTO, true)
export class ResetStudentPasswordDto {}
