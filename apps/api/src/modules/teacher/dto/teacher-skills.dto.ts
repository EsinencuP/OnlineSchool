import { SetMetadata } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsIn, IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { STRICT_INPUT_DTO } from '../../../openapi/dto-validation.pipe.js';

export const SKILL_STATUSES = ['NOT_STUDIED', 'FAMILIARIZING', 'PRACTICING', 'APPLYING'] as const;
export type SkillStatus = (typeof SKILL_STATUSES)[number];

export class TeacherEnrollmentDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() enrollmentId!: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID() studentId!: string;
  @ApiProperty() @IsString() studentName!: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID() subjectId!: string;
  @ApiProperty() @IsString() subjectName!: string;
  @ApiProperty({ format: 'date-time' }) assignedFrom!: string;
  @ApiProperty({
    type: 'integer',
    minimum: 0,
    description: 'Confirmed conducted lessons in this subject',
  })
  confirmedLessons!: number;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) nextLessonAt!: string | null;
}
export class TeacherEnrollmentsResponseDto {
  @ApiProperty({ type: [TeacherEnrollmentDto] }) @IsArray() items!: TeacherEnrollmentDto[];
}

export class TeacherSkillDto {
  @ApiProperty({ format: 'uuid' }) skillId!: string;
  @ApiProperty() name!: string;
  @ApiProperty() category!: string;
  @ApiProperty({ description: 'A skill of this student only (not the subject catalog)' })
  personal!: boolean;
  @ApiProperty({ enum: SKILL_STATUSES }) status!: SkillStatus;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) assessedAt!: string | null;
  @ApiProperty({ type: String, nullable: true }) assessedByName!: string | null;
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Student-visible comment of the last change',
  })
  publicComment!: string | null;
}
export class TeacherSkillMapDto {
  @ApiProperty({ format: 'uuid' }) enrollmentId!: string;
  @ApiProperty() studentName!: string;
  @ApiProperty() subjectName!: string;
  @ApiProperty({ type: [TeacherSkillDto] }) skills!: TeacherSkillDto[];
}

@SetMetadata(STRICT_INPUT_DTO, true)
export class AssessSkillDto {
  @ApiProperty({ enum: SKILL_STATUSES }) @IsIn(SKILL_STATUSES) level!: SkillStatus;
  @ApiProperty({
    minLength: 5,
    maxLength: 1000,
    description: 'Internal pedagogical evidence; never shown to the student',
  })
  @IsString()
  @Length(5, 1000)
  basis!: string;
  @ApiPropertyOptional({ minLength: 1, maxLength: 500, description: 'Shown to the student' })
  @IsOptional()
  @IsString()
  @Length(1, 500)
  publicComment?: string;
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Confirmed conducted lesson of this enrollment as evidence',
  })
  @IsOptional()
  @IsUUID()
  lessonId?: string;
}
export class AssessSkillResponseDto {
  @ApiProperty({ format: 'uuid', description: 'Assessment id' }) id!: string;
  @ApiProperty({ format: 'uuid' }) skillId!: string;
  @ApiProperty({ format: 'uuid' }) enrollmentId!: string;
  @ApiProperty({ enum: SKILL_STATUSES }) fromStatus!: SkillStatus;
  @ApiProperty({ enum: SKILL_STATUSES }) toStatus!: SkillStatus;
  @ApiProperty({ format: 'date-time' }) assessedAt!: string;
}

export class TeacherSkillHistoryItemDto {
  @ApiProperty({ format: 'uuid' }) auditId!: string;
  @ApiProperty({ format: 'date-time' }) changedAt!: string;
  @ApiProperty({ enum: SKILL_STATUSES }) fromStatus!: SkillStatus;
  @ApiProperty({ enum: SKILL_STATUSES }) toStatus!: SkillStatus;
  @ApiProperty() teacherName!: string;
  @ApiProperty({ type: String, nullable: true }) publicComment!: string | null;
  @ApiProperty({ description: 'Internal evidence (teacher view only)' }) basis!: string;
}
export class TeacherSkillHistoryDto {
  @ApiProperty({ format: 'uuid' }) skillId!: string;
  @ApiProperty() skillName!: string;
  @ApiProperty({ type: [TeacherSkillHistoryItemDto] }) items!: TeacherSkillHistoryItemDto[];
}
