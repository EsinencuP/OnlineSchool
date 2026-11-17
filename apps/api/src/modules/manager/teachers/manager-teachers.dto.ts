import { SetMetadata } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { STRICT_INPUT_DTO } from '../../../openapi/dto-validation.pipe.js';

@SetMetadata(STRICT_INPUT_DTO, true)
export class TeacherDirectoryQueryDto {
  @ApiPropertyOptional({ maxLength: 100, description: 'Case-insensitive name fragment' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
  @ApiPropertyOptional({ format: 'uuid', description: 'Put teachers who already teach it first' })
  @IsOptional()
  @IsUUID()
  subjectId?: string;
}

export class TeacherSubjectDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
}

export class TeacherDirectoryItemDto {
  @ApiProperty({ format: 'uuid' }) teacherId!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty({ type: [TeacherSubjectDto], description: 'Subjects with a current assignment' })
  subjects!: TeacherSubjectDto[];
  @ApiProperty({ type: 'integer', description: 'Students with a current assignment' })
  activeStudents!: number;
  @ApiProperty({ type: 'integer', description: 'Lessons in the next 7 days' })
  lessonsNext7Days!: number;
  @ApiProperty({ type: 'integer', description: 'Published availability in the next 7 days' })
  availableMinutesNext7Days!: number;
  @ApiProperty({ type: 'integer', description: 'Availability minus booked lessons, next 7 days' })
  freeMinutesNext7Days!: number;
  @ApiProperty({ description: 'Teaches the requested subject (only with subjectId)' })
  teachesSubject!: boolean;
}

export class TeacherDirectoryDto {
  @ApiProperty({ type: [TeacherDirectoryItemDto] }) items!: TeacherDirectoryItemDto[];
}

@SetMetadata(STRICT_INPUT_DTO, true)
export class TeacherWindowsQueryDto {
  @ApiProperty({ format: 'date-time' }) @IsDateString() from!: string;
  @ApiProperty({ format: 'date-time', description: 'At most 31 days after from' })
  @IsDateString()
  to!: string;
}

export class TimeIntervalDto {
  @ApiProperty({ format: 'date-time' }) startsAt!: string;
  @ApiProperty({ format: 'date-time' }) endsAt!: string;
}

export class TeacherWindowDto extends TimeIntervalDto {
  @ApiProperty({ format: 'uuid' }) availabilityId!: string;
  @ApiProperty({ example: 'Europe/Chisinau' }) timezone!: string;
  @ApiProperty({ type: [TimeIntervalDto], description: 'Booked lessons inside the window' })
  busy!: TimeIntervalDto[];
  @ApiProperty({ type: [TimeIntervalDto], description: 'Window minus booked lessons' })
  free!: TimeIntervalDto[];
}

export class TeacherWindowsDto {
  @ApiProperty({ format: 'uuid' }) teacherId!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty({ type: [TeacherWindowDto] }) windows!: TeacherWindowDto[];
}

@SetMetadata(STRICT_INPUT_DTO, true)
export class TeacherCandidatesQueryDto {
  @ApiPropertyOptional({ type: 'integer', minimum: 1, maximum: 14, default: 7 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(14)
  days?: number;
}

export class TeacherCandidateDto extends TeacherDirectoryItemDto {
  @ApiProperty({
    type: [TimeIntervalDto],
    description: 'Free intervals that fit a trial lesson, after the minimum lead time (max 10)',
  })
  trialSlots!: TimeIntervalDto[];
}

export class TeacherCandidatesDto {
  @ApiProperty({ format: 'uuid' }) leadId!: string;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) subjectId!: string | null;
  @ApiProperty({ type: 'integer', description: 'Trial lesson length' }) trialMinutes!: number;
  @ApiProperty({
    type: [TeacherCandidateDto],
    description: 'Teachers with trial slots, best first',
  })
  candidates!: TeacherCandidateDto[];
}

@SetMetadata(STRICT_INPUT_DTO, true)
export class AssignTeacherCommandDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() subjectId!: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID() teacherId!: string;
  @ApiProperty({ minLength: 5, maxLength: 500, description: 'Why this teacher; kept in history' })
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  basis!: string;
}

@SetMetadata(STRICT_INPUT_DTO, true)
export class RevokeAssignmentCommandDto {
  @ApiProperty({ minLength: 5, maxLength: 500 })
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason!: string;
}

export class TeacherAssignmentDto {
  @ApiProperty({ format: 'uuid' }) assignmentId!: string;
  @ApiProperty({ format: 'uuid' }) studentId!: string;
  @ApiProperty({ format: 'uuid' }) enrollmentId!: string;
  @ApiProperty({ format: 'uuid' }) subjectId!: string;
  @ApiProperty({ format: 'uuid' }) teacherId!: string;
  @ApiProperty({ format: 'date-time' }) validFrom!: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) validTo!: string | null;
  @ApiProperty() basis!: string;
}
