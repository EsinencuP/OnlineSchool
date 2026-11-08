import { Injectable } from '@nestjs/common';
import type { PipeTransform } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { object, uuid } from '../../modules/identity/input.js';
import { HistoryQueryDto, HistoryQueryPipe } from '../history/history.dto.js';
import type { HistoryPage } from '../history/history.dto.js';

export const skillStatuses = ['NOT_STUDIED', 'FAMILIARIZING', 'PRACTICING', 'APPLYING'] as const;
export type SkillStatus = (typeof skillStatuses)[number];
export type SkillSelection = { subjectId?: string };
export type SkillAuditQuery = HistoryPage & { skillId: string };
export class SkillMapQueryDto {
  @ApiPropertyOptional({ format: 'uuid' }) subjectId?: string;
}
export class SkillAuditQueryDto extends HistoryQueryDto {
  @ApiProperty({ format: 'uuid' }) skillId!: string;
}
@Injectable()
export class SkillMapQueryPipe implements PipeTransform {
  transform(value: unknown): SkillSelection {
    const input = object(value, ['subjectId']);
    return input.subjectId === undefined ? {} : { subjectId: uuid(input.subjectId) };
  }
}
@Injectable()
export class SkillAuditQueryPipe implements PipeTransform {
  transform(value: unknown): SkillAuditQuery {
    const input = object(value, ['skillId', 'page', 'pageSize']);
    return {
      skillId: uuid(input.skillId),
      ...new HistoryQueryPipe().transform({
        ...(input.page === undefined ? {} : { page: input.page }),
        ...(input.pageSize === undefined ? {} : { pageSize: input.pageSize }),
      }),
    };
  }
}
export class SkillDto {
  @ApiProperty({ format: 'uuid' }) skillId!: string;
  @ApiProperty() name!: string;
  @ApiProperty() category!: string;
  @ApiProperty({ enum: skillStatuses }) status!: SkillStatus;
  @ApiProperty({
    format: 'date-time',
    description: 'Assessment time, or catalog creation for an unstudied skill',
  })
  lastUpdatedAt!: string;
  @ApiProperty({ description: 'Empty when no teacher assessment exists' })
  lastUpdatedByTeacherName!: string;
}
export class LearningGoalDto {
  @ApiProperty({ format: 'uuid' }) goalId!: string;
  @ApiProperty() text!: string;
  @ApiProperty({ type: String, format: 'date', nullable: true }) targetDate!: string | null;
  @ApiProperty() isAchieved!: boolean;
}
export class SubjectSkillMapDto {
  @ApiProperty({ format: 'uuid' }) subjectId!: string;
  @ApiProperty() subjectName!: string;
  @ApiProperty({ type: 'integer' }) totalSkills!: number;
  @ApiProperty({ type: [SkillDto] }) skills!: SkillDto[];
  @ApiProperty({ type: [LearningGoalDto] }) learningGoals!: LearningGoalDto[];
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) lastSnapshotAt!:
    string | null;
  @ApiProperty({ type: 'integer', nullable: true, minimum: 1, maximum: 4 }) nextSnapshotIn!:
    number | null;
}
export class SkillAuditEntryDto {
  @ApiProperty({ format: 'uuid' }) auditId!: string;
  @ApiProperty({ format: 'uuid' }) skillId!: string;
  @ApiProperty() skillName!: string;
  @ApiProperty({ format: 'date-time' }) changedAt!: string;
  @ApiProperty({ enum: skillStatuses }) fromStatus!: SkillStatus;
  @ApiProperty({ enum: skillStatuses }) toStatus!: SkillStatus;
  @ApiProperty() teacherName!: string;
  @ApiProperty({ type: String, nullable: true }) comment!: string | null;
}
export class SkillAuditResponseDto {
  @ApiProperty({ type: [SkillAuditEntryDto] }) items!: SkillAuditEntryDto[];
  @ApiProperty({ type: 'integer' }) total!: number;
  @ApiProperty({ type: 'integer' }) page!: number;
  @ApiProperty({ type: 'integer' }) pageSize!: number;
}
export class SkillSnapshotItemDto {
  @ApiProperty() skillName!: string;
  @ApiProperty({ enum: skillStatuses }) status!: SkillStatus;
  @ApiProperty({ type: String, nullable: true }) teacherComment!: string | null;
}
export class SkillSnapshotDto {
  @ApiProperty({ format: 'uuid' }) snapshotId!: string;
  @ApiProperty() subjectName!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ type: 'integer', minimum: 4 }) lessonNumber!: number;
  @ApiProperty({ type: [SkillSnapshotItemDto] }) skills!: SkillSnapshotItemDto[];
  @ApiProperty({ type: String, nullable: true }) teacherSummary!: string | null;
}
export class SkillSnapshotResponseDto {
  @ApiProperty({ type: [SkillSnapshotDto] }) items!: SkillSnapshotDto[];
  @ApiProperty({ type: 'integer' }) total!: number;
  @ApiProperty({ type: 'integer' }) page!: number;
  @ApiProperty({ type: 'integer' }) pageSize!: number;
}
