import { ApiProperty } from '@nestjs/swagger';
import { IsDefined, IsString, MaxLength, MinLength } from 'class-validator';
export class ChangeStudentPasswordDto {
  @ApiProperty({ writeOnly: true, maxLength: 256 })
  @IsDefined()
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  currentPassword!: string;
  @ApiProperty({ writeOnly: true, minLength: 12, maxLength: 256 })
  @IsDefined()
  @IsString()
  @MinLength(12)
  @MaxLength(256)
  newPassword!: string;
}
export class StudentPasswordChangedDto {
  @ApiProperty({ enum: [false] }) mustChangePassword!: false;
}
