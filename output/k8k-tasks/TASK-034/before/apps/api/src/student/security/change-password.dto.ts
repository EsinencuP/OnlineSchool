import { ApiProperty } from '@nestjs/swagger';
import { IsDefined, IsString, MaxLength, MinLength, Matches } from 'class-validator';
export class ChangeStudentPasswordDto {
  @ApiProperty({ writeOnly: true, maxLength: 256 })
  @IsDefined()
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  currentPassword!: string;
  @ApiProperty({
    writeOnly: true,
    minLength: 8,
    maxLength: 128,
    pattern: '^(?=.*[A-Za-z])(?=.*\\d).+$',
  })
  @IsDefined()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/)
  newPassword!: string;
}
export class StudentPasswordChangedDto {
  @ApiProperty({ enum: [false] }) mustChangePassword!: false;
}
