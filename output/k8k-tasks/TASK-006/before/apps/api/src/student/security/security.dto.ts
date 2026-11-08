import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length, MaxLength, MinLength, Matches } from 'class-validator';
export class ChangeEmailRequestDto {
  @ApiProperty({ format: 'email' }) @IsEmail() @MaxLength(254) newEmail!: string;
  @ApiProperty({ writeOnly: true })
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  currentPassword!: string;
}
export class ChangeEmailConfirmDto {
  @ApiProperty({ writeOnly: true, minLength: 6, maxLength: 6, pattern: '^\\d{6}$' })
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  otp!: string;
  @ApiProperty({ format: 'email' }) @IsEmail() @MaxLength(254) newEmail!: string;
}
export class EmailOtpRequestedDto {
  @ApiProperty() message!: string;
}
export class EmailChangedDto {
  @ApiProperty({ format: 'email' }) email!: string;
}
export class SessionInfoDto {
  @ApiProperty({ format: 'uuid' }) sessionId!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) lastActiveAt!: string;
  @ApiProperty({ description: 'Empty for legacy sessions without captured metadata' })
  userAgent!: string;
  @ApiProperty({
    description:
      'Observed socket peer address, never an untrusted forwarded header; empty for legacy sessions',
  })
  ipAddress!: string;
  @ApiProperty() isCurrent!: boolean;
}
