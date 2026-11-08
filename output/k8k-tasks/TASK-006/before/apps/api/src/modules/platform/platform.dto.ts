import { ApiProperty } from '@nestjs/swagger';
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
export class PlatformWorkspaceDto {
  @ApiProperty() name!: string;
  @ApiProperty() role!: string;
  @ApiProperty({ type: [WorkspaceLessonDto] }) lessons!: WorkspaceLessonDto[];
  @ApiProperty({ type: [WorkspaceStudentDto] }) students!: WorkspaceStudentDto[];
  @ApiProperty({ type: [WorkspaceHomeworkDto] }) homework!: WorkspaceHomeworkDto[];
  @ApiProperty({ type: [WorkspaceTaskDto] }) tasks!: WorkspaceTaskDto[];
}
