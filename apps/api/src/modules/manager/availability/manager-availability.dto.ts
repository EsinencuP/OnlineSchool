import { SetMetadata } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { STRICT_INPUT_DTO } from '../../../openapi/dto-validation.pipe.js';

export const MANAGER_AVAILABILITY = ['AVAILABLE', 'UNAVAILABLE', 'OFF_SHIFT'] as const;
export type ManagerAvailabilityStatus = (typeof MANAGER_AVAILABILITY)[number];

@SetMetadata(STRICT_INPUT_DTO, true)
export class SetManagerAvailabilityDto {
  @ApiProperty({
    enum: MANAGER_AVAILABILITY,
    description:
      'AVAILABLE: urgent tasks wait up to the acceptance window. UNAVAILABLE / OFF_SHIFT: they go to the director at once',
  })
  @IsIn(MANAGER_AVAILABILITY)
  status!: ManagerAvailabilityStatus;
}

export class ManagerAvailabilityDto {
  @ApiProperty({ enum: MANAGER_AVAILABILITY }) status!: ManagerAvailabilityStatus;
  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'null while the manager never set a status (treated as AVAILABLE)',
  })
  changedAt!: string | null;
}
