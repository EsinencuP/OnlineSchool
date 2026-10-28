import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ManagerContactsDto } from '../../core/errors/error-mapper.js';
export class StudentMeResponseDto {
  @ApiPropertyOptional({ type: ManagerContactsDto }) managerContacts?: ManagerContactsDto;
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) userId!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty({ description: 'IANA timezone used by the student schedule' }) timeZone!: string;
  @ApiProperty() email!: string;
  @ApiProperty({ type: String, nullable: true }) avatarUrl!: string | null;
  @ApiProperty() hasActiveAccess!: boolean;
  @ApiProperty() mustChangePassword!: boolean;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
}
