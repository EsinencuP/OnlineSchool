import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { SetMetadata } from '@nestjs/common';
import { STRICT_INPUT_DTO } from '../../../openapi/dto-validation.pipe.js';

@SetMetadata(STRICT_INPUT_DTO, true)
export class ManagerOptionsQueryDto {
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() studentId?: string;
}
export class ManagerNamedOptionDto {
  @ApiProperty() id!: string;
  @ApiProperty() label!: string;
}
export class ManagerPlanOptionDto extends ManagerNamedOptionDto {
  @ApiProperty() price!: string;
  @ApiProperty() currency!: string;
  @ApiProperty({ type: 'integer' }) lessonCount!: number;
}
export class ManagerEnrollmentOptionDto extends ManagerNamedOptionDto {
  @ApiProperty() subjectId!: string;
  @ApiProperty({ type: [ManagerNamedOptionDto] }) teachers!: ManagerNamedOptionDto[];
}
export class ManagerFinancialSubscriptionOptionDto extends ManagerNamedOptionDto {
  @ApiProperty() enrollmentId!: string;
  @ApiProperty() currency!: string;
  @ApiProperty({ format: 'date-time' }) startsAt!: string;
}
export class ManagerOptionsDto {
  @ApiProperty({ type: [ManagerNamedOptionDto] }) students!: ManagerNamedOptionDto[];
  @ApiProperty({ type: [ManagerNamedOptionDto] }) subjects!: ManagerNamedOptionDto[];
  @ApiProperty({ type: [ManagerPlanOptionDto] }) plans!: ManagerPlanOptionDto[];
  @ApiProperty({ type: [ManagerEnrollmentOptionDto] }) enrollments!: ManagerEnrollmentOptionDto[];
  @ApiProperty({ type: [ManagerFinancialSubscriptionOptionDto] })
  financialSubscriptions!: ManagerFinancialSubscriptionOptionDto[];
}
