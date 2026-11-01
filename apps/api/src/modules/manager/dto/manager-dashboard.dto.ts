import { SetMetadata } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn } from 'class-validator';
import { STRICT_INPUT_DTO } from '../../../openapi/dto-validation.pipe.js';
import { MANAGER_TASK_TYPES } from '../tasks/contracts.js';
import type { ManagerTaskType } from '../tasks/contracts.js';
@SetMetadata(STRICT_INPUT_DTO, true)
export class DashboardQueryDto {
  @ApiPropertyOptional({ enum: [24, 48, 168], default: 48 })
  @Type(() => Number)
  @IsIn([24, 48, 168])
  lessonsHorizonHours = 48;
  @ApiPropertyOptional({ enum: [3, 7, 14], default: 7 })
  @Type(() => Number)
  @IsIn([3, 7, 14])
  expiringDays = 7;
}
export class DashboardStudentCountsDto {
  @ApiProperty({ type: 'integer' }) active!: number;
  @ApiProperty({ type: 'integer' }) frozen!: number;
  @ApiProperty({ type: 'integer' }) leads!: number;
}
export class DashboardLessonDto {
  @ApiProperty({ format: 'uuid' }) lessonId!: string;
  @ApiProperty({ format: 'uuid' }) studentId!: string;
  @ApiProperty() studentName!: string;
  @ApiProperty({ format: 'date-time' }) startsAt!: string;
  @ApiProperty() teacherName!: string;
  @ApiProperty() hasMeetLink!: boolean;
}
export class DashboardTaskDto {
  @ApiProperty({ format: 'uuid' }) taskId!: string;
  @ApiProperty({ enum: MANAGER_TASK_TYPES }) type!: ManagerTaskType;
  @ApiProperty() studentName!: string;
  @ApiProperty({ format: 'date-time' }) dueAt!: string;
}
export class DashboardOverdueTasksDto {
  @ApiProperty({ type: 'integer' }) count!: number;
  @ApiProperty({ type: [DashboardTaskDto] }) top!: DashboardTaskDto[];
}
export class DashboardSubscriptionDto {
  @ApiProperty({ format: 'uuid' }) subscriptionId!: string;
  @ApiProperty({ format: 'uuid' }) studentId!: string;
  @ApiProperty() studentName!: string;
  @ApiProperty({ format: 'date-time' }) endsAt!: string;
  @ApiProperty({ type: 'integer' }) remainingLessons!: number;
}
export class DashboardCurrencyTotalDto {
  @ApiProperty() currency!: string;
  @ApiProperty({ type: String, example: '1000.0001' }) amount!: string;
}
export class DashboardPendingPaymentsDto {
  @ApiProperty({ type: 'integer' }) count!: number;
  @ApiProperty({ type: [DashboardCurrencyTotalDto] })
  totalsByCurrency!: DashboardCurrencyTotalDto[];
}
export class ManagerDashboardDto {
  @ApiProperty({ format: 'date-time' }) generatedAt!: string;
  @ApiProperty({ type: DashboardStudentCountsDto }) students!: DashboardStudentCountsDto;
  @ApiProperty({ type: [DashboardLessonDto] }) upcomingLessons!: DashboardLessonDto[];
  @ApiProperty({ type: DashboardOverdueTasksDto }) overdueTasks!: DashboardOverdueTasksDto;
  @ApiProperty({ type: [DashboardSubscriptionDto] })
  expiringSubscriptions!: DashboardSubscriptionDto[];
  @ApiProperty({ type: DashboardPendingPaymentsDto }) pendingPayments!: DashboardPendingPaymentsDto;
}
