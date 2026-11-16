import { SetMetadata } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  ValidateIf,
} from 'class-validator';
import { STRICT_INPUT_DTO } from '../../../openapi/dto-validation.pipe.js';

export const GOAL_STATUSES = ['ACTIVE', 'ACHIEVED', 'PAUSED', 'ARCHIVED'] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export class TeacherGoalDto {
  @ApiProperty({ format: 'uuid' }) goalId!: string;
  @ApiProperty() text!: string;
  @ApiProperty({ type: String, format: 'date', nullable: true }) targetDate!: string | null;
  @ApiProperty({ enum: GOAL_STATUSES }) status!: GoalStatus;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) skillId!: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}
export class TeacherGoalsResponseDto {
  @ApiProperty({ format: 'uuid' }) enrollmentId!: string;
  @ApiProperty({ type: [TeacherGoalDto] }) @IsArray() goals!: TeacherGoalDto[];
}

@SetMetadata(STRICT_INPUT_DTO, true)
export class CreateGoalDto {
  @ApiProperty({ minLength: 5, maxLength: 500, description: 'Shown to the student' })
  @IsString()
  @Length(5, 500)
  text!: string;
  @ApiPropertyOptional({ format: 'date' }) @IsOptional() @Matches(DATE) targetDate?: string;
  @ApiPropertyOptional({ format: 'uuid', description: 'A skill of the enrollment subject' })
  @IsOptional()
  @IsUUID()
  skillId?: string;
}

@SetMetadata(STRICT_INPUT_DTO, true)
export class UpdateGoalDto {
  @ApiPropertyOptional({ minLength: 5, maxLength: 500 })
  @IsOptional()
  @IsString()
  @Length(5, 500)
  text?: string;
  @ApiPropertyOptional({
    type: String,
    format: 'date',
    nullable: true,
    description: 'null clears the date',
  })
  @ValidateIf((_, v) => v !== null)
  @IsOptional()
  @Matches(DATE)
  targetDate?: string | null;
  @ApiPropertyOptional({ enum: GOAL_STATUSES })
  @IsOptional()
  @IsIn(GOAL_STATUSES)
  status?: GoalStatus;
}
export class GoalCommandResponseDto {
  @ApiProperty({ format: 'uuid', description: 'Goal id' }) id!: string;
  @ApiProperty({ enum: GOAL_STATUSES }) status!: GoalStatus;
}
