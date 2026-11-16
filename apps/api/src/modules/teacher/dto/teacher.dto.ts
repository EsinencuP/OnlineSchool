import { SetMetadata } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
} from 'class-validator';
import { StaffActorContextDto } from '../../../core/actor/actor-context.dto.js';
import { STRICT_INPUT_DTO } from '../../../openapi/dto-validation.pipe.js';

export const TEACHER_LESSON_STATUSES = [
  'SCHEDULED',
  'STAR_PENDING',
  'CONDUCTED',
  'CANCELLED',
  'DISPUTED',
] as const;

export class TeacherMeResponseDto {
  @ApiProperty({ type: StaffActorContextDto }) actorContext!: StaffActorContextDto;
  @ApiProperty({ format: 'uuid' }) @IsUUID() teacherId!: string;
  @ApiProperty() @IsString() displayName!: string;
  @ApiProperty({ enum: ['TEACHER'] }) @IsIn(['TEACHER']) role!: 'TEACHER';
  @ApiProperty({ type: 'integer', minimum: 0, description: 'Students with an active assignment' })
  @IsInt()
  @Min(0)
  activeStudentCount!: number;
  @ApiProperty({ example: 'Europe/Chisinau' }) @IsString() timezone!: string;
}

@SetMetadata(STRICT_INPUT_DTO, true)
export class TeacherTodayQueryDto {
  @ApiPropertyOptional({
    example: '2026-11-16',
    description: 'Calendar day in the school timezone; defaults to the current day',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date?: string;
}

export class TeacherTodayLessonDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() lessonId!: string;
  @ApiProperty({ format: 'date-time' }) startsAt!: string;
  @ApiProperty({ format: 'date-time' }) endsAt!: string;
  @ApiProperty({ enum: TEACHER_LESSON_STATUSES })
  @IsIn(TEACHER_LESSON_STATUSES)
  status!: (typeof TEACHER_LESSON_STATUSES)[number];
  @ApiProperty({ enum: ['REGULAR', 'TRIAL'] }) kind!: 'REGULAR' | 'TRIAL';
  @ApiProperty({ format: 'uuid' }) @IsUUID() studentId!: string;
  @ApiProperty() @IsString() studentName!: string;
  @ApiProperty() @IsString() subjectCode!: string;
  @ApiProperty() @IsString() subjectName!: string;
  @ApiProperty({ format: 'date-time', description: 'Join window opens 10 minutes before start' })
  joinOpensAt!: string;
  @ApiProperty({ enum: ['PRESENT', 'MISSING'], description: 'The URL itself is not exposed here' })
  meetLinkState!: 'PRESENT' | 'MISSING';
  @ApiProperty({ description: 'A confirmed actual outcome exists for this lesson' })
  @IsBoolean()
  outcomeRecorded!: boolean;
}

export class TeacherTodayResponseDto {
  @ApiProperty({ example: '2026-11-16' }) date!: string;
  @ApiProperty({ example: 'Europe/Chisinau' }) timezone!: string;
  @ApiProperty({ format: 'date-time' }) asOf!: string;
  @ApiProperty({ type: [TeacherTodayLessonDto] }) @IsArray() lessons!: TeacherTodayLessonDto[];
}
