import { SetMetadata } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { STRICT_INPUT_DTO } from '../../../openapi/dto-validation.pipe.js';

export enum StudentCrmStatus {
  LEAD = 'LEAD',
  ACTIVE = 'ACTIVE',
  FROZEN = 'FROZEN',
  EXPIRED = 'EXPIRED',
  ARCHIVED = 'ARCHIVED',
}
const booleanQuery = ({ value }: { value: unknown }) =>
  value === 'true' ? true : value === 'false' ? false : value;
@SetMetadata(STRICT_INPUT_DTO, true)
export class ListStudentsQueryDto {
  @ApiPropertyOptional({ minLength: 2, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  search?: string;
  @ApiPropertyOptional({ enum: StudentCrmStatus })
  @IsOptional()
  @IsEnum(StudentCrmStatus)
  status?: StudentCrmStatus;
  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Transform(booleanQuery)
  @IsBoolean()
  hasOverdueTask?: boolean;
  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Transform(booleanQuery)
  @IsBoolean()
  subscriptionExpiringSoon?: boolean;
  @ApiPropertyOptional({ enum: ['name', 'nextLesson', 'subscriptionEnd'] })
  @IsOptional()
  @IsIn(['name', 'nextLesson', 'subscriptionEnd'])
  sort?: 'name' | 'nextLesson' | 'subscriptionEnd';
  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  cursor?: string;
  @ApiPropertyOptional({ type: 'integer', minimum: 1, maximum: 100, default: 25 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 25;
}
@SetMetadata(STRICT_INPUT_DTO, true)
export class CreateStudentDto {
  @ApiProperty({ minLength: 2, maxLength: 120 })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName!: string;
  @ApiPropertyOptional({ type: String, nullable: true, pattern: '^\\+?[0-9 ()-]{6,20}$' })
  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9 ()-]{6,20}$/)
  phone?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 254 })
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 120 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  guardianName?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  managerNote?: string | null;
}
@SetMetadata(STRICT_INPUT_DTO, true)
export class UpdateStudentContactsDto extends PartialType(
  OmitType(CreateStudentDto, ['fullName'] as const),
) {
  @ApiProperty({ type: 'integer', minimum: 1 }) @IsInt() @Min(1) version!: number;
}
export class ManagerSubscriptionSummaryDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ type: String, nullable: true, format: 'date-time' }) endsAt!: string | null;
  @ApiProperty({ type: 'integer' }) remainingLessons!: number;
  @ApiProperty() currency!: string;
}
export class CurrencyBalanceDto {
  @ApiProperty() currency!: string;
  @ApiProperty({ type: String }) amount!: string;
}
export class StudentListItemDto {
  @ApiProperty({ format: 'uuid' }) studentId!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty({ enum: StudentCrmStatus }) status!: StudentCrmStatus;
  @ApiProperty() hasAccount!: boolean;
  @ApiProperty({ type: String, nullable: true }) maskedPhone!: string | null;
  @ApiProperty({ type: ManagerSubscriptionSummaryDto, nullable: true })
  activeSubscription!: ManagerSubscriptionSummaryDto | null;
  @ApiProperty({
    type: String,
    description:
      'Published monetary ledger balance in balanceCurrency: positive prepayment, negative debt. Pending payments excluded.',
  })
  balance!: string;
  @ApiProperty() balanceCurrency!: string;
  @ApiProperty({ type: [CurrencyBalanceDto] }) balances!: CurrencyBalanceDto[];
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) nextLessonAt!: string | null;
  @ApiProperty({ type: 'integer' }) openTasksCount!: number;
  @ApiProperty({ type: 'integer' }) overdueTasksCount!: number;
}
export class StudentListPageDto {
  @ApiProperty({ type: [StudentListItemDto] }) items!: StudentListItemDto[];
  @ApiProperty({ type: String, nullable: true }) nextCursor!: string | null;
}
export class StudentContactsDto {
  @ApiProperty({ type: String, nullable: true }) phone!: string | null;
  @ApiProperty({ type: String, nullable: true }) email!: string | null;
  @ApiProperty({ type: String, nullable: true }) guardianName!: string | null;
  @ApiProperty({ type: String, nullable: true }) guardianPhone!: string | null;
}
export class LessonBriefDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'date-time' }) startsAt!: string;
  @ApiProperty() subjectName!: string;
  @ApiProperty() teacherName!: string;
}
export class CrmTaskBriefDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() type!: string;
  @ApiProperty() status!: string;
  @ApiProperty() title!: string;
  @ApiProperty({ format: 'date-time' }) dueAt!: string;
}
export class PaymentBriefDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) distributionId!: string;
  @ApiProperty({ format: 'uuid' }) paymentId!: string;
  @ApiProperty({ type: String }) amount!: string;
  @ApiProperty() currency!: string;
  @ApiProperty({ enum: ['PENDING', 'AWAITING_APPROVAL', 'CONFIRMED'] }) status!:
    'PENDING' | 'AWAITING_APPROVAL' | 'CONFIRMED';
  @ApiProperty({ format: 'date-time' }) registeredAt!: string;
  @ApiProperty({ type: String, nullable: true, format: 'date-time' }) confirmedAt!: string | null;
}
export class LearningSummaryDto {
  @ApiProperty({ type: 'integer' }) skillsMastered!: number;
  @ApiProperty({ type: 'integer' }) skillsTotal!: number;
  @ApiProperty({ type: 'integer' }) homeworkSubmitted!: number;
  @ApiProperty({ type: 'integer' }) homeworkPending!: number;
  @ApiProperty({ type: 'integer' }) homeworkOverdue!: number;
  @ApiProperty({ type: String, nullable: true, format: 'date-time' }) lastReportAt!: string | null;
  @ApiProperty({ type: String, nullable: true }) lastReportStatus!: string | null;
}
export class StudentCardDto {
  @ApiProperty({ type: String, nullable: true, format: 'uuid' }) leadId!: string | null;
  @ApiProperty({ format: 'uuid' }) studentId!: string;
  @ApiProperty({ type: 'integer' }) version!: number;
  @ApiProperty() fullName!: string;
  @ApiProperty({ enum: StudentCrmStatus }) status!: StudentCrmStatus;
  @ApiProperty() hasAccount!: boolean;
  @ApiProperty({ type: StudentContactsDto }) contacts!: StudentContactsDto;
  @ApiProperty({ type: String, nullable: true }) managerNote!: string | null;
  @ApiProperty({ type: ManagerSubscriptionSummaryDto, nullable: true })
  subscription!: ManagerSubscriptionSummaryDto | null;
  @ApiProperty({ type: String }) balance!: string;
  @ApiProperty() balanceCurrency!: string;
  @ApiProperty({ type: [CurrencyBalanceDto] }) balances!: CurrencyBalanceDto[];
  @ApiProperty({ type: [LessonBriefDto] }) upcomingLessons!: LessonBriefDto[];
  @ApiProperty({ type: [CrmTaskBriefDto], maxItems: 100 }) openTasks!: CrmTaskBriefDto[];
  @ApiProperty() openTasksTruncated!: boolean;
  @ApiProperty({ type: [PaymentBriefDto], maxItems: 10 }) recentPayments!: PaymentBriefDto[];
  @ApiProperty({ type: LearningSummaryDto }) learning!: LearningSummaryDto;
}
