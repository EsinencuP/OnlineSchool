import { ApiProperty } from '@nestjs/swagger';
import { StaffActorContextDto } from '../../core/actor/actor-context.dto.js';
export class SwitchUserRequest {
  @ApiProperty({
    enum: ['anna', 'maksim', 'sofia', 'daniil', 'andrei', 'elena', 'tamara', 'pasha', 'tech'],
  })
  key!: string;
}
export class SwitchUserResponse {
  @ApiProperty({ enum: ['/student', '/teacher', '/manager', '/director', '/operator'] })
  home!: string;
}
export class DemoAccountDto {
  @ApiProperty() key!: string;
  @ApiProperty() name!: string;
  @ApiProperty() role!: string;
  @ApiProperty() login!: string;
  @ApiProperty() home!: string;
}
export class PlatformAccountsDto {
  @ApiProperty() enabled!: boolean;
  @ApiProperty({ type: String, nullable: true }) currentKey!: string | null;
  @ApiProperty({ type: [DemoAccountDto] }) items!: readonly DemoAccountDto[];
}
export class WorkspaceLessonDto {
  @ApiProperty() id!: string;
  @ApiProperty() startsAt!: string;
  @ApiProperty() endsAt!: string;
  @ApiProperty() status!: string;
  @ApiProperty() subject!: string;
  @ApiProperty() student!: string;
  @ApiProperty() teacher!: string;
  @ApiProperty({ type: String, nullable: true }) meetUrl!: string | null;
}
export class WorkspaceStudentDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() subject!: string;
}
export class WorkspaceHomeworkDto {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiProperty() subject!: string;
  @ApiProperty({ type: String, nullable: true }) dueAt!: string | null;
}
export class WorkspaceTaskDto {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiProperty() status!: string;
  @ApiProperty() dueAt!: string;
  @ApiProperty() manager!: string;
}
export class WorkspacePageInfoDto {
  @ApiProperty({ type: 'integer' }) limit!: number;
  @ApiProperty({ type: 'integer' }) returned!: number;
  @ApiProperty() hasMore!: boolean;
  @ApiProperty({ type: Number, nullable: true, description: 'Unknown total; never a global KPI' })
  total!: number | null;
}
export class WorkspaceCoverageDto {
  @ApiProperty({ enum: ['OWN_TEACHER', 'SCHOOL', 'NOT_APPLICABLE'] }) scope!:
    'OWN_TEACHER' | 'SCHOOL' | 'NOT_APPLICABLE';
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) windowFrom!: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) windowTo!: string | null;
  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'Latest updated_at among returned source rows only, not a global watermark',
  })
  sourceUpdatedAt!: string | null;
  @ApiProperty({ type: WorkspacePageInfoDto }) pageInfo!: WorkspacePageInfoDto;
}
export class WorkspaceCoverageSetDto {
  @ApiProperty({ type: WorkspaceCoverageDto }) lessons!: WorkspaceCoverageDto;
  @ApiProperty({ type: WorkspaceCoverageDto }) students!: WorkspaceCoverageDto;
  @ApiProperty({ type: WorkspaceCoverageDto }) homework!: WorkspaceCoverageDto;
  @ApiProperty({ type: WorkspaceCoverageDto }) tasks!: WorkspaceCoverageDto;
}
export class PlatformWorkspaceDto {
  @ApiProperty({ type: StaffActorContextDto }) actorContext!: StaffActorContextDto;
  @ApiProperty({ type: WorkspaceCoverageSetDto }) coverage!: WorkspaceCoverageSetDto;
  @ApiProperty() name!: string;
  @ApiProperty() role!: string;
  @ApiProperty({ type: [WorkspaceLessonDto] }) lessons!: WorkspaceLessonDto[];
  @ApiProperty({ type: [WorkspaceStudentDto] }) students!: WorkspaceStudentDto[];
  @ApiProperty({ type: [WorkspaceHomeworkDto] }) homework!: WorkspaceHomeworkDto[];
  @ApiProperty({ type: [WorkspaceTaskDto] }) tasks!: WorkspaceTaskDto[];
}
