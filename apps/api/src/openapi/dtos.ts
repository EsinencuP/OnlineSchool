// OpenAPI DTO source. Every field carries Swagger and class-validator metadata.
import { ApiProperty } from '@nestjs/swagger';
import type { ApiPropertyOptions } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDefined,
  IsOptional,
  IsString,
  IsUUID,
  IsEmail,
  IsISO8601,
  IsInt,
  IsBoolean,
  IsArray,
  IsObject,
  IsEnum,
  Min,
  Max,
  MinLength,
  MaxLength,
  Matches,
  ValidateNested,
} from 'class-validator';

export enum HealthResponseStatusEnum {
  OK = 'ok',
}
export enum HealthResponseServiceEnum {
  API = 'api',
}
export enum LoginRequestMethodEnum {
  PASSWORD = 'password',
  PASSKEY = 'passkey',
}
export enum PaymentReceiptResponseStatusEnum {
  REGISTERED = 'REGISTERED',
  CONFIRMED = 'CONFIRMED',
}
export enum EntitlementAdjustmentResponseKindEnum {
  GRANT_DELTA = 'GRANT_DELTA',
  CONSUMPTION_CANCELLATION = 'CONSUMPTION_CANCELLATION',
}
export enum PayoutAttemptResponseStatusEnum {
  PENDING = 'PENDING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  UNKNOWN = 'UNKNOWN',
  RETURNED = 'RETURNED',
}
export enum LedgerLineInputAccountTypeEnum {
  UNALLOCATED_FUNDS = 'UNALLOCATED_FUNDS',
  CASH = 'CASH',
  CUSTOMER_ADVANCE = 'CUSTOMER_ADVANCE',
  LESSON_REVENUE = 'LESSON_REVENUE',
  TEACHER_EXPENSE = 'TEACHER_EXPENSE',
  TEACHER_PAYABLE = 'TEACHER_PAYABLE',
  REFUND_PAYABLE = 'REFUND_PAYABLE',
  CORRECTION = 'CORRECTION',
}
export enum LedgerLineInputDirectionEnum {
  DEBIT = 'DEBIT',
  CREDIT = 'CREDIT',
}
export enum EntitlementAdjustRequestKindEnum {
  GRANT_DELTA = 'GRANT_DELTA',
  CONSUMPTION_CANCELLATION = 'CONSUMPTION_CANCELLATION',
}
export enum EnrollmentResponseStatusEnum {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  ENDED = 'ENDED',
}
export enum LessonResponseStatusEnum {
  SCHEDULED = 'SCHEDULED',
  STAR_PENDING = 'STAR_PENDING',
  CONDUCTED = 'CONDUCTED',
  CANCELLED = 'CANCELLED',
  DISPUTED = 'DISPUTED',
}
export enum ScheduleChangeRequestResponseStatusEnum {
  PENDING = 'PENDING',
  RESOLVED = 'RESOLVED',
}
export enum LessonOutcomeReportResponseResultEnum {
  CONDUCTED = 'CONDUCTED',
  NOT_CONDUCTED = 'NOT_CONDUCTED',
  DISPUTED = 'DISPUTED',
}
export enum LessonActualOutcomeResponseRateBasisEnum {
  ORDINARY_POINTS = 'ORDINARY_POINTS',
  INDIVIDUAL_PROMISE = 'INDIVIDUAL_PROMISE',
  FINANCIAL_EXCEPTION = 'FINANCIAL_EXCEPTION',
}
export enum LessonCreateRequestStatusEnum {
  SCHEDULED = 'SCHEDULED',
  STAR_PENDING = 'STAR_PENDING',
}
export enum LessonOutcomeReportRequestResultEnum {
  CONDUCTED = 'CONDUCTED',
  NOT_CONDUCTED = 'NOT_CONDUCTED',
  DISPUTED = 'DISPUTED',
}
export enum SessionResponseAccountKindEnum {
  STAFF = 'STAFF',
  TEACHER = 'TEACHER',
  STUDENT = 'STUDENT',
}
export enum SessionResponseAccountRolesEnum {
  DIRECTOR = 'DIRECTOR',
  MANAGER = 'MANAGER',
  TEACHER = 'TEACHER',
  STUDENT = 'STUDENT',
  TECH_OPERATOR = 'TECH_OPERATOR',
}
export enum LoginRequestAlternative1MethodEnum {
  PASSWORD = 'password',
}
export enum LoginRequestAlternative2MethodEnum {
  PASSKEY = 'passkey',
}
export enum WebAuthnFinishRequestResponseTypeEnum {
  PUBLIC_KEY = 'public-key',
}

export class HealthResponse {
  @ApiProperty({
    type: 'string',
    enum: HealthResponseStatusEnum,
    required: true,
  } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsEnum(HealthResponseStatusEnum)
  'status'!: HealthResponseStatusEnum;
  @ApiProperty({
    type: 'string',
    enum: HealthResponseServiceEnum,
    required: true,
  } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsEnum(HealthResponseServiceEnum)
  'service'!: HealthResponseServiceEnum;
}

export class CsrfResponse {
  @ApiProperty({ type: 'string', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  'csrfToken'!: string;
}

export class ApiError {
  @ApiProperty({ type: 'string', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  'code'!: string;
  @ApiProperty({ type: 'string', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  'message'!: string;
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'requestId'!: string;
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    selfRequired: false,
  } as ApiPropertyOptions)
  @IsOptional()
  @IsObject()
  'details'?: Record<string, unknown>;
  @ApiProperty({ type: 'string', format: 'date-time', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsISO8601({ strict: true })
  'timestamp'!: string;
}

export class SessionResponseAccount {
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'id'!: string;
  @ApiProperty({
    type: 'string',
    enum: SessionResponseAccountKindEnum,
    required: true,
  } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsEnum(SessionResponseAccountKindEnum)
  'kind'!: SessionResponseAccountKindEnum;
  @ApiProperty({
    type: 'array',
    items: { type: 'string', enum: ['DIRECTOR', 'MANAGER', 'TEACHER', 'STUDENT', 'TECH_OPERATOR'] },
    required: true,
  } as ApiPropertyOptions)
  @IsDefined()
  @IsArray()
  @IsEnum(SessionResponseAccountRolesEnum, { each: true })
  'roles'!: SessionResponseAccountRolesEnum[];
  @ApiProperty({ type: 'string', required: false } as ApiPropertyOptions)
  @IsOptional()
  @IsString()
  'role'?: string;
}

export class SessionResponse {
  @ApiProperty({ required: true, type: () => SessionResponseAccount } as ApiPropertyOptions)
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => SessionResponseAccount)
  'account'!: SessionResponseAccount;
  @ApiProperty({ type: 'boolean', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsBoolean()
  'mfa_completed'!: boolean;
  @ApiProperty({ type: 'boolean', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsBoolean()
  'recovery_only'!: boolean;
  @ApiProperty({ type: 'string', format: 'date-time', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsISO8601({ strict: true })
  'expires_at'!: string;
  @ApiProperty({ type: 'string', required: false } as ApiPropertyOptions)
  @IsOptional()
  @IsString()
  'csrfToken'?: string;
}

export class LoginRequest {
  @ApiProperty({
    type: 'string',
    enum: LoginRequestMethodEnum,
    required: false,
  } as ApiPropertyOptions)
  @IsOptional()
  @IsString()
  @IsEnum(LoginRequestMethodEnum)
  'method'?: LoginRequestMethodEnum;
  @ApiProperty({ type: 'string', format: 'email', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsEmail()
  'email'!: string;
  @ApiProperty({
    type: 'string',
    minLength: 1,
    maxLength: 256,
    required: false,
  } as ApiPropertyOptions)
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  'password'?: string;
}

export class WebAuthnStartRequest {
  @ApiProperty({ type: 'string', format: 'email', required: false } as ApiPropertyOptions)
  @IsOptional()
  @IsString()
  @IsEmail()
  'email'?: string;
}

export class WebAuthnOptions {
  @ApiProperty({ type: 'string', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  'challenge'!: string;
}

export class WebAuthnStartResponse {
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'challengeId'!: string;
  @ApiProperty({ required: true, type: () => WebAuthnOptions } as ApiPropertyOptions)
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => WebAuthnOptions)
  'options'!: WebAuthnOptions;
}

export class WebAuthnFinishRequestResponseResponse {
  @ApiProperty({ type: 'string', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  'clientDataJSON'!: string;
}

export class WebAuthnFinishRequestResponse {
  @ApiProperty({ type: 'string', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  'id'!: string;
  @ApiProperty({ type: 'string', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  'rawId'!: string;
  @ApiProperty({
    type: 'string',
    enum: WebAuthnFinishRequestResponseTypeEnum,
    required: true,
  } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsEnum(WebAuthnFinishRequestResponseTypeEnum)
  'type'!: WebAuthnFinishRequestResponseTypeEnum;
  @ApiProperty({
    required: true,
    type: () => WebAuthnFinishRequestResponseResponse,
  } as ApiPropertyOptions)
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => WebAuthnFinishRequestResponseResponse)
  'response'!: WebAuthnFinishRequestResponseResponse;
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    selfRequired: false,
  } as ApiPropertyOptions)
  @IsOptional()
  @IsObject()
  'clientExtensionResults'?: Record<string, unknown>;
}

export class WebAuthnFinishRequest {
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'challengeId'!: string;
  @ApiProperty({ required: true, type: () => WebAuthnFinishRequestResponse } as ApiPropertyOptions)
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => WebAuthnFinishRequestResponse)
  'response'!: WebAuthnFinishRequestResponse;
}

export class PasskeyRegisteredResponse {
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'id'!: string;
  @ApiProperty({ type: 'boolean', enum: [true], required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsBoolean()
  'registered'!: boolean;
  @ApiProperty({ type: 'boolean', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsBoolean()
  'mfa_completed'!: boolean;
}

export class RecoveryInitiateRequest {
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'authorizationId'!: string;
}

export class RecoveryInitiatedResponse {
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'recoveryId'!: string;
  @ApiProperty({
    type: 'string',
    minLength: 43,
    maxLength: 43,
    required: true,
  } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @MinLength(43)
  @MaxLength(43)
  'token'!: string;
  @ApiProperty({ type: 'string', format: 'date-time', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsISO8601({ strict: true })
  'expires_at'!: string;
}

export class RecoveryCompleteRequest {
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'recoveryId'!: string;
  @ApiProperty({
    type: 'string',
    minLength: 43,
    maxLength: 43,
    required: true,
  } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @MinLength(43)
  @MaxLength(43)
  'token'!: string;
}

export class StudentCreateRequest {
  @ApiProperty({
    type: 'string',
    minLength: 1,
    maxLength: 200,
    required: true,
  } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  'fullName'!: string;
  @ApiProperty({ type: 'string', format: 'email', required: false } as ApiPropertyOptions)
  @IsOptional()
  @IsString()
  @IsEmail()
  'email'?: string;
  @ApiProperty({
    type: 'string',
    minLength: 5,
    maxLength: 40,
    required: false,
  } as ApiPropertyOptions)
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(40)
  'phone'?: string;
  @ApiProperty({ type: 'string', format: 'date', required: false } as ApiPropertyOptions)
  @IsOptional()
  @IsString()
  @IsISO8601({ strict: true })
  'birthDate'?: string;
}

export class StudentCreatedResponse {
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'id'!: string;
  @ApiProperty({ type: 'string', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  'fullName'!: string;
}

export class HouseholdCreateRequest {
  @ApiProperty({
    type: 'string',
    minLength: 1,
    maxLength: 150,
    required: false,
  } as ApiPropertyOptions)
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  'label'?: string;
}

export class HouseholdCreatedResponse {
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'id'!: string;
}

export class HouseholdMemberRequest {
  @ApiProperty({ type: 'string', format: 'uuid', required: false } as ApiPropertyOptions)
  @IsOptional()
  @IsString()
  @IsUUID('all')
  'studentId'?: string;
  @ApiProperty({
    type: 'string',
    minLength: 5,
    maxLength: 500,
    required: true,
  } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  'basis'!: string;
  @ApiProperty({ type: 'string', format: 'uuid', required: false } as ApiPropertyOptions)
  @IsOptional()
  @IsString()
  @IsUUID('all')
  'representativeId'?: string;
}

export class HouseholdMemberResponse {
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'id'!: string;
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'householdId'!: string;
}

export class LogoutResponse {
  @ApiProperty({ type: 'boolean', enum: [true], required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsBoolean()
  'loggedOut'!: boolean;
}

export class PaymentReceiptResponse {
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'id'!: string;
  @ApiProperty({
    type: 'string',
    format: 'uuid',
    required: false,
    nullable: true,
  } as ApiPropertyOptions)
  @IsOptional()
  @IsString()
  @IsUUID('all')
  'student_id'?: string | null;
  @ApiProperty({
    type: 'string',
    pattern: '^(?:0|[1-9]\\d{0,15})(?:\\.\\d{1,4})?$',
    description:
      'Exact NUMERIC(20,4) decimal string; JSON numbers and exponents are rejected. Positive for payments/lines; zero only for explicit director accrual decision.',
    required: true,
  } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @Matches(new RegExp('^(?:0|[1-9]\\d{0,15})(?:\\.\\d{1,4})?$'))
  'amount'!: string;
  @ApiProperty({ type: 'string', pattern: '^[A-Z]{3}$', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @Matches(new RegExp('^[A-Z]{3}$'))
  'currency'!: string;
  @ApiProperty({
    type: 'string',
    enum: PaymentReceiptResponseStatusEnum,
    required: true,
  } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsEnum(PaymentReceiptResponseStatusEnum)
  'status'!: PaymentReceiptResponseStatusEnum;
  @ApiProperty({ type: 'string', format: 'date-time', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsISO8601({ strict: true })
  'registered_at'!: string;
  @ApiProperty({
    type: 'string',
    format: 'date-time',
    required: true,
    nullable: true,
  } as ApiPropertyOptions)
  @IsOptional()
  @IsString()
  @IsISO8601({ strict: true })
  'confirmed_by_director_at'!: string | null;
  @ApiProperty({ type: 'string', format: 'date-time', required: false } as ApiPropertyOptions)
  @IsOptional()
  @IsString()
  @IsISO8601({ strict: true })
  'confirmed_at'?: string;
  @ApiProperty({ type: 'string', format: 'uuid', required: false } as ApiPropertyOptions)
  @IsOptional()
  @IsString()
  @IsUUID('all')
  'ledgerEntryId'?: string;
}

export class PaymentDistributionResponse {
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'id'!: string;
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'payment_id'!: string;
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'subscription_id'!: string;
  @ApiProperty({
    type: 'string',
    pattern: '^(?:0|[1-9]\\d{0,15})(?:\\.\\d{1,4})?$',
    description:
      'Exact NUMERIC(20,4) decimal string; JSON numbers and exponents are rejected. Positive for payments/lines; zero only for explicit director accrual decision.',
    required: true,
  } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @Matches(new RegExp('^(?:0|[1-9]\\d{0,15})(?:\\.\\d{1,4})?$'))
  'amount'!: string;
  @ApiProperty({ type: 'string', pattern: '^[A-Z]{3}$', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @Matches(new RegExp('^[A-Z]{3}$'))
  'currency'!: string;
  @ApiProperty({
    type: 'string',
    format: 'date-time',
    required: true,
    nullable: true,
  } as ApiPropertyOptions)
  @IsOptional()
  @IsString()
  @IsISO8601({ strict: true })
  'approved_at'!: string | null;
  @ApiProperty({ type: 'string', format: 'uuid', required: false } as ApiPropertyOptions)
  @IsOptional()
  @IsString()
  @IsUUID('all')
  'ledgerEntryId'?: string;
}

export class SubscriptionResponse {
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'id'!: string;
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'enrollment_id'!: string;
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'sale_condition_id'!: string;
  @ApiProperty({ type: 'integer', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsInt()
  'lesson_count'!: number;
  @ApiProperty({
    type: 'string',
    pattern: '^(?:0|[1-9]\\d{0,15})(?:\\.\\d{1,4})?$',
    description:
      'Exact NUMERIC(20,4) decimal string; JSON numbers and exponents are rejected. Positive for payments/lines; zero only for explicit director accrual decision.',
    required: true,
  } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @Matches(new RegExp('^(?:0|[1-9]\\d{0,15})(?:\\.\\d{1,4})?$'))
  'full_price'!: string;
  @ApiProperty({
    type: 'string',
    pattern: '^(?:0|[1-9]\\d{0,15})(?:\\.\\d{1,4})?$',
    description:
      'Exact NUMERIC(20,4) decimal string; JSON numbers and exponents are rejected. Positive for payments/lines; zero only for explicit director accrual decision.',
    required: true,
  } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @Matches(new RegExp('^(?:0|[1-9]\\d{0,15})(?:\\.\\d{1,4})?$'))
  'initial_discount_amount'!: string;
  @ApiProperty({
    type: 'string',
    pattern: '^(?:0|[1-9]\\d{0,15})(?:\\.\\d{1,4})?$',
    description:
      'Exact NUMERIC(20,4) decimal string; JSON numbers and exponents are rejected. Positive for payments/lines; zero only for explicit director accrual decision.',
    required: true,
  } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @Matches(new RegExp('^(?:0|[1-9]\\d{0,15})(?:\\.\\d{1,4})?$'))
  'original_paid_unit_price'!: string;
  @ApiProperty({ type: 'string', pattern: '^[A-Z]{3}$', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @Matches(new RegExp('^[A-Z]{3}$'))
  'currency'!: string;
  @ApiProperty({ type: 'string', format: 'date-time', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsISO8601({ strict: true })
  'valid_from'!: string;
}

export class EntitlementGrantResponse {
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'id'!: string;
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'subscription_id'!: string;
  @ApiProperty({ type: 'integer', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsInt()
  'quantity'!: number;
  @ApiProperty({ type: 'string', minLength: 1, required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @MinLength(1)
  'basis'!: string;
  @ApiProperty({ type: 'string', format: 'date-time', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsISO8601({ strict: true })
  'granted_at'!: string;
}

export class EntitlementConsumptionResponse {
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'id'!: string;
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'grant_id'!: string;
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'subscription_id'!: string;
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'lesson_occurrence_id'!: string;
  @ApiProperty({ type: 'integer', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsInt()
  'quantity'!: number;
  @ApiProperty({ type: 'integer', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsInt()
  'remaining_count'!: number;
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'ledgerEntryId'!: string;
}

export class EntitlementAdjustmentResponse {
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'id'!: string;
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'grant_id'!: string;
  @ApiProperty({
    type: 'string',
    enum: EntitlementAdjustmentResponseKindEnum,
    required: true,
  } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsEnum(EntitlementAdjustmentResponseKindEnum)
  'kind'!: EntitlementAdjustmentResponseKindEnum;
  @ApiProperty({ type: 'integer', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsInt()
  'remaining_count'!: number;
  @ApiProperty({ type: 'string', minLength: 1, required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @MinLength(1)
  'reason'!: string;
}

export class TemporaryAccessResponse {
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'id'!: string;
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'subscription_id'!: string;
  @ApiProperty({ type: 'integer', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsInt()
  'granted_lessons_count'!: number;
  @ApiProperty({ type: 'string', format: 'date-time', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsISO8601({ strict: true })
  'expires_at'!: string;
  @ApiProperty({ type: 'string', minLength: 1, required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @MinLength(1)
  'basis'!: string;
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'director_id'!: string;
}

export class LedgerEntryResponse {
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'id'!: string;
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'document_id'!: string;
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'financial_period_id'!: string;
  @ApiProperty({ type: 'string', pattern: '^[A-Z]{3}$', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @Matches(new RegExp('^[A-Z]{3}$'))
  'currency'!: string;
  @ApiProperty({ type: 'string', format: 'date-time', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsISO8601({ strict: true })
  'balanced_at'!: string;
  @ApiProperty({ type: 'string', format: 'date-time', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsISO8601({ strict: true })
  'published_at'!: string;
  @ApiProperty({
    type: 'object',
    additionalProperties: { $ref: '#/components/schemas/LedgerEntryResponseBalanceSnapshotValue' },
    selfRequired: true,
  } as ApiPropertyOptions)
  @IsDefined()
  @IsObject()
  'balance_snapshot'!: Record<string, unknown>;
}

export class FinancialPeriodResponse {
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'id'!: string;
  @ApiProperty({ type: 'string', format: 'date-time', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsISO8601({ strict: true })
  'starts_at'!: string;
  @ApiProperty({ type: 'string', format: 'date-time', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsISO8601({ strict: true })
  'ends_at'!: string;
  @ApiProperty({
    type: 'string',
    format: 'date-time',
    required: true,
    nullable: true,
  } as ApiPropertyOptions)
  @IsOptional()
  @IsString()
  @IsISO8601({ strict: true })
  'closed_at'!: string | null;
}

export class TeacherAccrualResponse {
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'id'!: string;
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'teacher_id'!: string;
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'lesson_actual_outcome_id'!: string;
  @ApiProperty({
    type: 'string',
    pattern: '^(?:0|[1-9]\\d{0,15})(?:\\.\\d{1,4})?$',
    description:
      'Exact NUMERIC(20,4) decimal string; JSON numbers and exponents are rejected. Positive for payments/lines; zero only for explicit director accrual decision.',
    required: true,
  } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @Matches(new RegExp('^(?:0|[1-9]\\d{0,15})(?:\\.\\d{1,4})?$'))
  'rate_snapshot'!: string;
  @ApiProperty({ type: 'integer', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsInt()
  'points_snapshot'!: number;
  @ApiProperty({
    type: 'string',
    pattern: '^(?:0|[1-9]\\d{0,15})(?:\\.\\d{1,4})?$',
    description:
      'Exact NUMERIC(20,4) decimal string; JSON numbers and exponents are rejected. Positive for payments/lines; zero only for explicit director accrual decision.',
    required: true,
  } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @Matches(new RegExp('^(?:0|[1-9]\\d{0,15})(?:\\.\\d{1,4})?$'))
  'amount'!: string;
  @ApiProperty({ type: 'string', pattern: '^[A-Z]{3}$', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @Matches(new RegExp('^[A-Z]{3}$'))
  'currency'!: string;
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'obligationId'!: string;
  @ApiProperty({
    type: 'string',
    format: 'uuid',
    required: true,
    nullable: true,
  } as ApiPropertyOptions)
  @IsOptional()
  @IsString()
  @IsUUID('all')
  'ledgerEntryId'!: string | null;
}

export class PayoutAttemptResponse {
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'id'!: string;
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'obligation_id'!: string;
  @ApiProperty({
    type: 'string',
    pattern: '^(?:0|[1-9]\\d{0,15})(?:\\.\\d{1,4})?$',
    description:
      'Exact NUMERIC(20,4) decimal string; JSON numbers and exponents are rejected. Positive for payments/lines; zero only for explicit director accrual decision.',
    required: true,
  } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @Matches(new RegExp('^(?:0|[1-9]\\d{0,15})(?:\\.\\d{1,4})?$'))
  'amount'!: string;
  @ApiProperty({ type: 'string', pattern: '^[A-Z]{3}$', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @Matches(new RegExp('^[A-Z]{3}$'))
  'currency'!: string;
  @ApiProperty({
    type: 'string',
    enum: PayoutAttemptResponseStatusEnum,
    required: true,
  } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsEnum(PayoutAttemptResponseStatusEnum)
  'status'!: PayoutAttemptResponseStatusEnum;
}

export class ConfirmedPayoutResponse {
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'id'!: string;
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'attempt_id'!: string;
  @ApiProperty({
    type: 'string',
    pattern: '^(?:0|[1-9]\\d{0,15})(?:\\.\\d{1,4})?$',
    description:
      'Exact NUMERIC(20,4) decimal string; JSON numbers and exponents are rejected. Positive for payments/lines; zero only for explicit director accrual decision.',
    required: true,
  } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @Matches(new RegExp('^(?:0|[1-9]\\d{0,15})(?:\\.\\d{1,4})?$'))
  'amount'!: string;
  @ApiProperty({ type: 'string', pattern: '^[A-Z]{3}$', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @Matches(new RegExp('^[A-Z]{3}$'))
  'currency'!: string;
  @ApiProperty({ type: 'string', format: 'date-time', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsISO8601({ strict: true })
  'confirmed_at'!: string;
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'ledgerEntryId'!: string;
}

export class PayrollItemObligation {
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'id'!: string;
  @ApiProperty({
    type: 'string',
    pattern: '^(?:0|[1-9]\\d{0,15})(?:\\.\\d{1,4})?$',
    description:
      'Exact NUMERIC(20,4) decimal string; JSON numbers and exponents are rejected. Positive for payments/lines; zero only for explicit director accrual decision.',
    required: true,
  } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @Matches(new RegExp('^(?:0|[1-9]\\d{0,15})(?:\\.\\d{1,4})?$'))
  'amount'!: string;
  @ApiProperty({ type: 'string', pattern: '^[A-Z]{3}$', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @Matches(new RegExp('^[A-Z]{3}$'))
  'currency'!: string;
  @ApiProperty({ type: 'string', format: 'date-time', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsISO8601({ strict: true })
  'recognized_at'!: string;
}

export class PayrollItemPayoutsItem {
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'id'!: string;
  @ApiProperty({
    type: 'string',
    pattern: '^(?:0|[1-9]\\d{0,15})(?:\\.\\d{1,4})?$',
    description:
      'Exact NUMERIC(20,4) decimal string; JSON numbers and exponents are rejected. Positive for payments/lines; zero only for explicit director accrual decision.',
    required: true,
  } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @Matches(new RegExp('^(?:0|[1-9]\\d{0,15})(?:\\.\\d{1,4})?$'))
  'amount'!: string;
  @ApiProperty({ type: 'string', pattern: '^[A-Z]{3}$', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @Matches(new RegExp('^[A-Z]{3}$'))
  'currency'!: string;
  @ApiProperty({ type: 'string', format: 'date-time', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsISO8601({ strict: true })
  'confirmed_at'!: string;
}

export class PayrollItem {
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'id'!: string;
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'lesson_actual_outcome_id'!: string;
  @ApiProperty({
    type: 'string',
    pattern: '^(?:0|[1-9]\\d{0,15})(?:\\.\\d{1,4})?$',
    description:
      'Exact NUMERIC(20,4) decimal string; JSON numbers and exponents are rejected. Positive for payments/lines; zero only for explicit director accrual decision.',
    required: true,
  } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @Matches(new RegExp('^(?:0|[1-9]\\d{0,15})(?:\\.\\d{1,4})?$'))
  'rate_snapshot'!: string;
  @ApiProperty({ type: 'integer', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsInt()
  'points_snapshot'!: number;
  @ApiProperty({ type: 'string', minLength: 1, required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @MinLength(1)
  'rate_basis'!: string;
  @ApiProperty({
    type: 'string',
    pattern: '^(?:0|[1-9]\\d{0,15})(?:\\.\\d{1,4})?$',
    description:
      'Exact NUMERIC(20,4) decimal string; JSON numbers and exponents are rejected. Positive for payments/lines; zero only for explicit director accrual decision.',
    required: true,
  } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @Matches(new RegExp('^(?:0|[1-9]\\d{0,15})(?:\\.\\d{1,4})?$'))
  'amount'!: string;
  @ApiProperty({ type: 'string', pattern: '^[A-Z]{3}$', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @Matches(new RegExp('^[A-Z]{3}$'))
  'currency'!: string;
  @ApiProperty({ type: 'string', format: 'date-time', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsISO8601({ strict: true })
  'recognized_at'!: string;
  @ApiProperty({
    required: true,
    nullable: true,
    type: () => PayrollItemObligation,
  } as ApiPropertyOptions)
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PayrollItemObligation)
  'obligation'!: PayrollItemObligation | null;
  @ApiProperty({ required: true, type: () => [PayrollItemPayoutsItem] } as ApiPropertyOptions)
  @IsDefined()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PayrollItemPayoutsItem)
  'payouts'!: PayrollItemPayoutsItem[];
}

export class TeacherPayrollResponse {
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'teacherId'!: string;
  @ApiProperty({ maxItems: 100, required: true, type: () => [PayrollItem] } as ApiPropertyOptions)
  @IsDefined()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PayrollItem)
  'items'!: PayrollItem[];
}

export class LedgerAdjustmentResponse {
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'id'!: string;
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'reversalEntryId'!: string;
}

export class LedgerLineInput {
  @ApiProperty({
    type: 'string',
    enum: LedgerLineInputAccountTypeEnum,
    required: true,
  } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsEnum(LedgerLineInputAccountTypeEnum)
  'accountType'!: LedgerLineInputAccountTypeEnum;
  @ApiProperty({
    type: 'string',
    enum: LedgerLineInputDirectionEnum,
    required: true,
  } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsEnum(LedgerLineInputDirectionEnum)
  'direction'!: LedgerLineInputDirectionEnum;
  @ApiProperty({
    type: 'string',
    pattern: '^(?:0|[1-9]\\d{0,15})(?:\\.\\d{1,4})?$',
    description:
      'Exact NUMERIC(20,4) decimal string; JSON numbers and exponents are rejected. Positive for payments/lines; zero only for explicit director accrual decision.',
    required: true,
  } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @Matches(new RegExp('^(?:0|[1-9]\\d{0,15})(?:\\.\\d{1,4})?$'))
  'amount'!: string;
  @ApiProperty({ type: 'string', pattern: '^[A-Z]{3}$', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @Matches(new RegExp('^[A-Z]{3}$'))
  'currency'!: string;
}

export class PaymentRegisterRequest {
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'studentId'!: string;
  @ApiProperty({
    type: 'string',
    pattern: '^(?:0|[1-9]\\d{0,15})(?:\\.\\d{1,4})?$',
    description:
      'Exact NUMERIC(20,4) decimal string; JSON numbers and exponents are rejected. Positive for payments/lines; zero only for explicit director accrual decision.',
    required: true,
  } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @Matches(new RegExp('^(?:0|[1-9]\\d{0,15})(?:\\.\\d{1,4})?$'))
  'amount'!: string;
  @ApiProperty({ type: 'string', pattern: '^[A-Z]{3}$', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @Matches(new RegExp('^[A-Z]{3}$'))
  'currency'!: string;
  @ApiProperty({ type: 'string', minLength: 1, required: false } as ApiPropertyOptions)
  @IsOptional()
  @IsString()
  @MinLength(1)
  'provider'?: string;
  @ApiProperty({ type: 'string', minLength: 1, required: false } as ApiPropertyOptions)
  @IsOptional()
  @IsString()
  @MinLength(1)
  'externalReference'?: string;
}

export class PaymentDistributionRequest {
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'subscriptionId'!: string;
  @ApiProperty({
    type: 'string',
    pattern: '^(?:0|[1-9]\\d{0,15})(?:\\.\\d{1,4})?$',
    description:
      'Exact NUMERIC(20,4) decimal string; JSON numbers and exponents are rejected. Positive for payments/lines; zero only for explicit director accrual decision.',
    required: true,
  } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @Matches(new RegExp('^(?:0|[1-9]\\d{0,15})(?:\\.\\d{1,4})?$'))
  'amount'!: string;
}

export class SubscriptionCreateRequest {
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'enrollmentId'!: string;
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'saleConditionId'!: string;
}

export class EntitlementGrantRequest {
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'subscriptionId'!: string;
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'distributionId'!: string;
  @ApiProperty({
    type: 'integer',
    minimum: 1,
    maximum: 10000,
    required: false,
  } as ApiPropertyOptions)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  'quantity'?: number;
}

export class EntitlementConsumeRequest {
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'grantId'!: string;
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'studentId'!: string;
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'lessonId'!: string;
  @ApiProperty({ type: 'string', minLength: 1, required: false } as ApiPropertyOptions)
  @IsOptional()
  @IsString()
  @MinLength(1)
  'reason'?: string;
}

export class EntitlementAdjustRequest {
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'grantId'!: string;
  @ApiProperty({ type: 'string', format: 'uuid', required: false } as ApiPropertyOptions)
  @IsOptional()
  @IsString()
  @IsUUID('all')
  'originalConsumptionId'?: string;
  @ApiProperty({
    type: 'string',
    enum: EntitlementAdjustRequestKindEnum,
    required: true,
  } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsEnum(EntitlementAdjustRequestKindEnum)
  'kind'!: EntitlementAdjustRequestKindEnum;
  @ApiProperty({ type: 'integer', required: false } as ApiPropertyOptions)
  @IsOptional()
  @IsInt()
  'deltaQuantity'?: number;
  @ApiProperty({ type: 'string', minLength: 1, required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @MinLength(1)
  'reason'!: string;
}

export class TemporaryAccessRequest {
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'subscriptionId'!: string;
  @ApiProperty({
    type: 'integer',
    minimum: 1,
    maximum: 10000,
    required: true,
  } as ApiPropertyOptions)
  @IsDefined()
  @IsInt()
  @Min(1)
  @Max(10000)
  'grantedLessonsCount'!: number;
  @ApiProperty({ type: 'string', format: 'date-time', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsISO8601({ strict: true })
  'expiresAt'!: string;
  @ApiProperty({ type: 'string', minLength: 1, required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @MinLength(1)
  'basis'!: string;
}

export class LedgerPublishRequest {
  @ApiProperty({ type: 'string', format: 'uuid', required: false } as ApiPropertyOptions)
  @IsOptional()
  @IsString()
  @IsUUID('all')
  'documentId'?: string;
  @ApiProperty({ type: 'string', format: 'uuid', required: false } as ApiPropertyOptions)
  @IsOptional()
  @IsString()
  @IsUUID('all')
  'entryId'?: string;
  @ApiProperty({ type: 'string', format: 'uuid', required: false } as ApiPropertyOptions)
  @IsOptional()
  @IsString()
  @IsUUID('all')
  'periodId'?: string;
  @ApiProperty({ required: false, type: () => [LedgerLineInput] } as ApiPropertyOptions)
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LedgerLineInput)
  'lines'?: LedgerLineInput[];
}

export class LedgerAdjustRequest {
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'entryId'!: string;
  @ApiProperty({ type: 'string', format: 'uuid', required: false } as ApiPropertyOptions)
  @IsOptional()
  @IsString()
  @IsUUID('all')
  'periodId'?: string;
  @ApiProperty({ type: 'string', minLength: 1, required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @MinLength(1)
  'reason'!: string;
  @ApiProperty({ required: false, type: () => [LedgerLineInput] } as ApiPropertyOptions)
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LedgerLineInput)
  'replacementLines'?: LedgerLineInput[];
}

export class AccrualCreateRequest {
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'outcomeId'!: string;
  @ApiProperty({ type: 'string', minLength: 1, required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @MinLength(1)
  'basis'!: string;
  @ApiProperty({
    type: 'string',
    pattern: '^(?:0|[1-9]\\d{0,15})(?:\\.\\d{1,4})?$',
    description:
      'Exact NUMERIC(20,4) decimal string; JSON numbers and exponents are rejected. Positive for payments/lines; zero only for explicit director accrual decision.',
    required: false,
  } as ApiPropertyOptions)
  @IsOptional()
  @IsString()
  @Matches(new RegExp('^(?:0|[1-9]\\d{0,15})(?:\\.\\d{1,4})?$'))
  'exceptionAmount'?: string;
}

export class PayoutAttemptRequest {
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'obligationId'!: string;
  @ApiProperty({
    type: 'string',
    pattern: '^(?:0|[1-9]\\d{0,15})(?:\\.\\d{1,4})?$',
    description:
      'Exact NUMERIC(20,4) decimal string; JSON numbers and exponents are rejected. Positive for payments/lines; zero only for explicit director accrual decision.',
    required: true,
  } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @Matches(new RegExp('^(?:0|[1-9]\\d{0,15})(?:\\.\\d{1,4})?$'))
  'amount'!: string;
  @ApiProperty({ type: 'string', minLength: 1, required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @MinLength(1)
  'provider'!: string;
  @ApiProperty({ type: 'string', minLength: 1, required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @MinLength(1)
  'providerRequestId'!: string;
}

export class PayoutConfirmRequest {
  @ApiProperty({ type: 'string', minLength: 1, required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @MinLength(1)
  'providerConfirmationId'!: string;
  @ApiProperty({
    type: 'string',
    pattern: '^(?:0|[1-9]\\d{0,15})(?:\\.\\d{1,4})?$',
    description:
      'Exact NUMERIC(20,4) decimal string; JSON numbers and exponents are rejected. Positive for payments/lines; zero only for explicit director accrual decision.',
    required: false,
  } as ApiPropertyOptions)
  @IsOptional()
  @IsString()
  @Matches(new RegExp('^(?:0|[1-9]\\d{0,15})(?:\\.\\d{1,4})?$'))
  'amount'?: string;
}

export class SubjectResponse {
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'id'!: string;
  @ApiProperty({ type: 'string', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  'code'!: string;
  @ApiProperty({ type: 'string', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  'name'!: string;
}

export class EnrollmentResponse {
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'id'!: string;
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'student_id'!: string;
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'subject_id'!: string;
  @ApiProperty({
    type: 'string',
    enum: EnrollmentResponseStatusEnum,
    required: true,
  } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsEnum(EnrollmentResponseStatusEnum)
  'status'!: EnrollmentResponseStatusEnum;
  @ApiProperty({ type: 'string', format: 'date-time', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsISO8601({ strict: true })
  'valid_from'!: string;
}

export class TeachingAssignmentResponse {
  @ApiProperty({ type: 'string', required: true, nullable: true } as ApiPropertyOptions)
  @IsOptional()
  @IsString()
  'google_meet_link'!: string | null;
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'id'!: string;
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'enrollment_id'!: string;
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'teacher_id'!: string;
  @ApiProperty({ type: 'string', format: 'date-time', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsISO8601({ strict: true })
  'valid_from'!: string;
  @ApiProperty({
    type: 'string',
    format: 'date-time',
    required: true,
    nullable: true,
  } as ApiPropertyOptions)
  @IsOptional()
  @IsString()
  @IsISO8601({ strict: true })
  'valid_to'!: string | null;
  @ApiProperty({ type: 'string', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  'basis'!: string;
}

export class LessonResponse {
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'id'!: string;
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'enrollment_id'!: string;
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'teaching_assignment_id'!: string;
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'scheduled_teacher_id'!: string;
  @ApiProperty({ type: 'string', format: 'date-time', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsISO8601({ strict: true })
  'original_scheduled_at'!: string;
  @ApiProperty({
    type: 'string',
    format: 'date-time',
    required: true,
    nullable: true,
  } as ApiPropertyOptions)
  @IsOptional()
  @IsString()
  @IsISO8601({ strict: true })
  'occurrence_date'!: string | null;
  @ApiProperty({ type: 'string', format: 'date-time', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsISO8601({ strict: true })
  'scheduled_at'!: string;
  @ApiProperty({ type: 'string', format: 'date-time', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsISO8601({ strict: true })
  'scheduled_end_at'!: string;
  @ApiProperty({
    type: 'string',
    enum: LessonResponseStatusEnum,
    required: true,
  } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsEnum(LessonResponseStatusEnum)
  'status'!: LessonResponseStatusEnum;
  @ApiProperty({ type: 'integer', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsInt()
  'version'!: number;
  @ApiProperty({
    type: 'string',
    format: 'date-time',
    required: true,
    nullable: true,
  } as ApiPropertyOptions)
  @IsOptional()
  @IsString()
  @IsISO8601({ strict: true })
  'actual_start_at'!: string | null;
}

export class RecurringSlotResponse {
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'id'!: string;
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'enrollment_id'!: string;
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'teaching_assignment_id'!: string;
  @ApiProperty({ type: 'string', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  'rule'!: string;
  @ApiProperty({ type: 'string', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  'timezone'!: string;
  @ApiProperty({ type: 'string', format: 'date-time', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsISO8601({ strict: true })
  'active_from'!: string;
  @ApiProperty({
    type: 'string',
    format: 'date-time',
    required: true,
    nullable: true,
  } as ApiPropertyOptions)
  @IsOptional()
  @IsString()
  @IsISO8601({ strict: true })
  'active_until'!: string | null;
  @ApiProperty({ type: 'integer', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsInt()
  'duration_min'!: number;
  @ApiProperty({ type: 'integer', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsInt()
  'version'!: number;
  @ApiProperty({ required: true, type: () => [LessonResponse] } as ApiPropertyOptions)
  @IsDefined()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LessonResponse)
  'occurrences'!: LessonResponse[];
}

export class SlotGenerationResponse {
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'id'!: string;
  @ApiProperty({ required: true, type: () => [LessonResponse] } as ApiPropertyOptions)
  @IsDefined()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LessonResponse)
  'occurrences'!: LessonResponse[];
}

export class TeacherAvailabilityResponse {
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'id'!: string;
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'teacher_id'!: string;
  @ApiProperty({ type: 'string', format: 'date-time', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsISO8601({ strict: true })
  'starts_at'!: string;
  @ApiProperty({ type: 'string', format: 'date-time', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsISO8601({ strict: true })
  'ends_at'!: string;
  @ApiProperty({ type: 'string', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  'timezone'!: string;
  @ApiProperty({
    type: 'string',
    format: 'date-time',
    required: true,
    nullable: true,
  } as ApiPropertyOptions)
  @IsOptional()
  @IsString()
  @IsISO8601({ strict: true })
  'cancelled_at'!: string | null;
}

export class ScheduleChangeRequestResponse {
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'id'!: string;
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'teacher_id'!: string;
  @ApiProperty({
    type: 'string',
    enum: ScheduleChangeRequestResponseStatusEnum,
    required: true,
  } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsEnum(ScheduleChangeRequestResponseStatusEnum)
  'status'!: ScheduleChangeRequestResponseStatusEnum;
  @ApiProperty({ type: 'string', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  'reason'!: string;
}

export class LessonOutcomeReportResponse {
  @ApiProperty({ type: 'boolean', required: true } as ApiPropertyOptions)
  @IsBoolean()
  'student_no_show'!: boolean;
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'id'!: string;
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'lesson_occurrence_id'!: string;
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'reported_by_id'!: string;
  @ApiProperty({
    type: 'string',
    enum: LessonOutcomeReportResponseResultEnum,
    required: true,
  } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsEnum(LessonOutcomeReportResponseResultEnum)
  'result'!: LessonOutcomeReportResponseResultEnum;
  @ApiProperty({ type: 'integer', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsInt()
  'version'!: number;
  @ApiProperty({ type: 'integer', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsInt()
  'lesson_version'!: number;
  @ApiProperty({ type: 'string', format: 'date-time', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsISO8601({ strict: true })
  'reported_at'!: string;
  @ApiProperty({ type: 'boolean', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsBoolean()
  'late'!: boolean;
}

export class LessonActualOutcomeResponse {
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'id'!: string;
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'lesson_occurrence_id'!: string;
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'actual_teacher_id'!: string;
  @ApiProperty({ type: 'string', format: 'date-time', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsISO8601({ strict: true })
  'actual_started_at'!: string;
  @ApiProperty({ type: 'integer', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsInt()
  'duration_min'!: number;
  @ApiProperty({ type: 'string', format: 'date-time', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsISO8601({ strict: true })
  'confirmed_at'!: string;
  @ApiProperty({
    type: 'string',
    pattern: '^(?:0|[1-9]\\d{0,15})(?:\\.\\d{1,4})?$',
    description:
      'Exact NUMERIC(20,4) decimal string; JSON numbers and exponents are rejected. Positive for payments/lines; zero only for explicit director accrual decision.',
    required: true,
  } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @Matches(new RegExp('^(?:0|[1-9]\\d{0,15})(?:\\.\\d{1,4})?$'))
  'rate_snapshot'!: string;
  @ApiProperty({ type: 'integer', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsInt()
  'points_snapshot'!: number;
  @ApiProperty({
    type: 'string',
    enum: LessonActualOutcomeResponseRateBasisEnum,
    required: true,
  } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsEnum(LessonActualOutcomeResponseRateBasisEnum)
  'rate_basis'!: LessonActualOutcomeResponseRateBasisEnum;
  @ApiProperty({ type: 'string', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  'currency'!: string;
  @ApiProperty({ type: 'string', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  'basis'!: string;
}

export class ConfirmedLessonOutcomeResponse {
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'id'!: string;
  @ApiProperty({ required: true, type: () => LessonResponse } as ApiPropertyOptions)
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => LessonResponse)
  'lesson'!: LessonResponse;
  @ApiProperty({
    required: true,
    nullable: true,
    type: () => LessonActualOutcomeResponse,
  } as ApiPropertyOptions)
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => LessonActualOutcomeResponse)
  'outcome'!: LessonActualOutcomeResponse | null;
}

export class SubjectCreateRequest {
  @ApiProperty({ type: 'string', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  'code'!: string;
  @ApiProperty({ type: 'string', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  'name'!: string;
}

export class EnrollmentCreateRequest {
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'studentId'!: string;
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'subjectId'!: string;
}

export class TeachingAssignmentCreateRequest {
  @ApiProperty({
    type: 'string',
    required: false,
    pattern: '^https://meet[.]google[.]com/[a-z]{3}-[a-z]{4}-[a-z]{3}$',
  } as ApiPropertyOptions)
  @IsOptional()
  @IsString()
  'googleMeetLink'?: string;
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'enrollmentId'!: string;
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'teacherId'!: string;
  @ApiProperty({ type: 'string', format: 'date-time', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsISO8601({ strict: true })
  'validFrom'!: string;
  @ApiProperty({ type: 'string', format: 'date-time', required: false } as ApiPropertyOptions)
  @IsOptional()
  @IsString()
  @IsISO8601({ strict: true })
  'validTo'?: string;
  @ApiProperty({ type: 'string', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  'basis'!: string;
}

export class ScheduleReasonRequest {
  @ApiProperty({
    type: 'string',
    minLength: 5,
    maxLength: 500,
    required: true,
  } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  'reason'!: string;
}

export class RecurringSlotCreateRequest {
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'teachingAssignmentId'!: string;
  @ApiProperty({
    type: 'string',
    description: 'Weekly subset: FREQ=WEEKLY;BYDAY=MO;BYHOUR=14;BYMINUTE=0',
    required: true,
  } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  'rule'!: string;
  @ApiProperty({ type: 'string', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  'timezone'!: string;
  @ApiProperty({ type: 'string', format: 'date-time', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsISO8601({ strict: true })
  'activeFrom'!: string;
  @ApiProperty({ type: 'string', format: 'date-time', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsISO8601({ strict: true })
  'activeUntil'!: string;
  @ApiProperty({ type: 'integer', minimum: 1, maximum: 480, required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsInt()
  @Min(1)
  @Max(480)
  'durationMin'!: number;
  @ApiProperty({ type: 'string', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  'basis'!: string;
}

export class RecurringSlotPatchRequest {
  @ApiProperty({ type: 'string', required: false } as ApiPropertyOptions)
  @IsOptional()
  @IsString()
  'rule'?: string;
  @ApiProperty({ type: 'string', required: false } as ApiPropertyOptions)
  @IsOptional()
  @IsString()
  'timezone'?: string;
  @ApiProperty({ type: 'string', format: 'date-time', required: false } as ApiPropertyOptions)
  @IsOptional()
  @IsString()
  @IsISO8601({ strict: true })
  'activeUntil'?: string;
  @ApiProperty({ type: 'integer', minimum: 1, maximum: 480, required: false } as ApiPropertyOptions)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(480)
  'durationMin'?: number;
  @ApiProperty({ type: 'string', format: 'date-time', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsISO8601({ strict: true })
  'effectiveFrom'!: string;
  @ApiProperty({ type: 'string', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  'reason'!: string;
}

export class LessonCreateRequest {
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'teachingAssignmentId'!: string;
  @ApiProperty({ type: 'string', format: 'date-time', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsISO8601({ strict: true })
  'startsAt'!: string;
  @ApiProperty({ type: 'string', format: 'date-time', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsISO8601({ strict: true })
  'endsAt'!: string;
  @ApiProperty({
    type: 'string',
    enum: LessonCreateRequestStatusEnum,
    required: false,
  } as ApiPropertyOptions)
  @IsOptional()
  @IsString()
  @IsEnum(LessonCreateRequestStatusEnum)
  'status'?: LessonCreateRequestStatusEnum;
  @ApiProperty({ type: 'string', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  'basis'!: string;
}

export class LessonRescheduleRequest {
  @ApiProperty({ type: 'string', format: 'date-time', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsISO8601({ strict: true })
  'startsAt'!: string;
  @ApiProperty({ type: 'string', format: 'date-time', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsISO8601({ strict: true })
  'endsAt'!: string;
  @ApiProperty({ type: 'string', format: 'uuid', required: false } as ApiPropertyOptions)
  @IsOptional()
  @IsString()
  @IsUUID('all')
  'teachingAssignmentId'?: string;
  @ApiProperty({ type: 'string', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  'reason'!: string;
}

export class LessonOutcomeReportRequest {
  @ApiProperty({
    type: 'boolean',
    required: false,
    description:
      'Explicit student absence, only with NOT_CONDUCTED; student-facing NO_SHOW requires staff confirmation',
  } as ApiPropertyOptions)
  @IsOptional()
  @IsBoolean()
  'studentNoShow'?: boolean;
  @ApiProperty({
    type: 'string',
    enum: LessonOutcomeReportRequestResultEnum,
    required: true,
  } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsEnum(LessonOutcomeReportRequestResultEnum)
  'result'!: LessonOutcomeReportRequestResultEnum;
  @ApiProperty({ type: 'string', format: 'date-time', required: false } as ApiPropertyOptions)
  @IsOptional()
  @IsString()
  @IsISO8601({ strict: true })
  'actualStartedAt'?: string;
  @ApiProperty({ type: 'integer', minimum: 1, maximum: 480, required: false } as ApiPropertyOptions)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(480)
  'durationMin'?: number;
  @ApiProperty({
    type: 'string',
    minLength: 5,
    maxLength: 2000,
    required: true,
  } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  'note'!: string;
}

export class ConfirmLessonOutcomeRequest {
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'reportId'!: string;
  @ApiProperty({ type: 'string', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  'basis'!: string;
  @ApiProperty({ type: 'string', format: 'uuid', required: false } as ApiPropertyOptions)
  @IsOptional()
  @IsString()
  @IsUUID('all')
  'temporaryAccessPermissionId'?: string;
}

export class TeacherAvailabilityRequest {
  @ApiProperty({ type: 'string', format: 'uuid', required: false } as ApiPropertyOptions)
  @IsOptional()
  @IsString()
  @IsUUID('all')
  'availabilityId'?: string;
  @ApiProperty({ type: 'string', format: 'date-time', required: false } as ApiPropertyOptions)
  @IsOptional()
  @IsString()
  @IsISO8601({ strict: true })
  'startsAt'?: string;
  @ApiProperty({ type: 'string', format: 'date-time', required: false } as ApiPropertyOptions)
  @IsOptional()
  @IsString()
  @IsISO8601({ strict: true })
  'endsAt'?: string;
  @ApiProperty({ type: 'string', required: false } as ApiPropertyOptions)
  @IsOptional()
  @IsString()
  'timezone'?: string;
  @ApiProperty({ type: 'boolean', required: false } as ApiPropertyOptions)
  @IsOptional()
  @IsBoolean()
  'cancel'?: boolean;
}

export class ScheduleChangeRequestInput {
  @ApiProperty({ type: 'string', format: 'uuid', required: false } as ApiPropertyOptions)
  @IsOptional()
  @IsString()
  @IsUUID('all')
  'lessonId'?: string;
  @ApiProperty({ type: 'string', format: 'uuid', required: false } as ApiPropertyOptions)
  @IsOptional()
  @IsString()
  @IsUUID('all')
  'slotId'?: string;
  @ApiProperty({ type: 'string', format: 'date-time', required: false } as ApiPropertyOptions)
  @IsOptional()
  @IsString()
  @IsISO8601({ strict: true })
  'requestedStartAt'?: string;
  @ApiProperty({ type: 'string', format: 'date-time', required: false } as ApiPropertyOptions)
  @IsOptional()
  @IsString()
  @IsISO8601({ strict: true })
  'requestedEndAt'?: string;
  @ApiProperty({ type: 'string', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  'reason'!: string;
}

export class EmptyRequest {}

export class CreateSessionResponse {
  @ApiProperty({ required: false, type: () => SessionResponseAccount } as ApiPropertyOptions)
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => SessionResponseAccount)
  'account'?: SessionResponseAccount;
  @ApiProperty({ type: 'boolean', required: false } as ApiPropertyOptions)
  @IsOptional()
  @IsBoolean()
  'mfa_completed'?: boolean;
  @ApiProperty({ type: 'boolean', required: false } as ApiPropertyOptions)
  @IsOptional()
  @IsBoolean()
  'recovery_only'?: boolean;
  @ApiProperty({ type: 'string', format: 'date-time', required: false } as ApiPropertyOptions)
  @IsOptional()
  @IsString()
  @IsISO8601({ strict: true })
  'expires_at'?: string;
  @ApiProperty({ type: 'string', required: false } as ApiPropertyOptions)
  @IsOptional()
  @IsString()
  'csrfToken'?: string;
  @ApiProperty({ type: 'string', format: 'uuid', required: false } as ApiPropertyOptions)
  @IsOptional()
  @IsString()
  @IsUUID('all')
  'challengeId'?: string;
  @ApiProperty({ required: false, type: () => WebAuthnOptions } as ApiPropertyOptions)
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => WebAuthnOptions)
  'options'?: WebAuthnOptions;
}

export class ConfirmPaymentRequest {}

export class ApproveDistributionRequest {}

export class CloseFinancialPeriodRequest {}

export class GenerateSlotOccurrencesRequest {}

export class StartLessonRequest {}

export class LoginRequestAlternative1 {
  @ApiProperty({
    type: 'string',
    enum: LoginRequestAlternative1MethodEnum,
    required: false,
  } as ApiPropertyOptions)
  @IsOptional()
  @IsString()
  @IsEnum(LoginRequestAlternative1MethodEnum)
  'method'?: LoginRequestAlternative1MethodEnum;
  @ApiProperty({ type: 'string', format: 'email', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsEmail()
  'email'!: string;
  @ApiProperty({
    type: 'string',
    minLength: 1,
    maxLength: 256,
    required: true,
  } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  'password'!: string;
}

export class LoginRequestAlternative2 {
  @ApiProperty({
    type: 'string',
    enum: LoginRequestAlternative2MethodEnum,
    required: true,
  } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsEnum(LoginRequestAlternative2MethodEnum)
  'method'!: LoginRequestAlternative2MethodEnum;
  @ApiProperty({ type: 'string', format: 'email', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsEmail()
  'email'!: string;
}

export class HouseholdMemberRequestAlternative1 {
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'studentId'!: string;
  @ApiProperty({
    type: 'string',
    minLength: 5,
    maxLength: 500,
    required: true,
  } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  'basis'!: string;
}

export class HouseholdMemberRequestAlternative2 {
  @ApiProperty({ type: 'string', format: 'uuid', required: true } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @IsUUID('all')
  'representativeId'!: string;
  @ApiProperty({
    type: 'string',
    minLength: 5,
    maxLength: 500,
    required: true,
  } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  'basis'!: string;
}

export class LedgerEntryResponseBalanceSnapshotValue {
  @ApiProperty({
    type: 'string',
    pattern: '^(?:0|[1-9]\\d{0,15})(?:\\.\\d{1,4})?$',
    description:
      'Exact NUMERIC(20,4) decimal string; JSON numbers and exponents are rejected. Positive for payments/lines; zero only for explicit director accrual decision.',
    required: true,
  } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @Matches(new RegExp('^(?:0|[1-9]\\d{0,15})(?:\\.\\d{1,4})?$'))
  'debit'!: string;
  @ApiProperty({
    type: 'string',
    pattern: '^(?:0|[1-9]\\d{0,15})(?:\\.\\d{1,4})?$',
    description:
      'Exact NUMERIC(20,4) decimal string; JSON numbers and exponents are rejected. Positive for payments/lines; zero only for explicit director accrual decision.',
    required: true,
  } as ApiPropertyOptions)
  @IsDefined()
  @IsString()
  @Matches(new RegExp('^(?:0|[1-9]\\d{0,15})(?:\\.\\d{1,4})?$'))
  'credit'!: string;
}

export const DTO_CLASSES = [
  HealthResponse,
  CsrfResponse,
  ApiError,
  SessionResponseAccount,
  SessionResponse,
  LoginRequest,
  WebAuthnStartRequest,
  WebAuthnOptions,
  WebAuthnStartResponse,
  WebAuthnFinishRequestResponseResponse,
  WebAuthnFinishRequestResponse,
  WebAuthnFinishRequest,
  PasskeyRegisteredResponse,
  RecoveryInitiateRequest,
  RecoveryInitiatedResponse,
  RecoveryCompleteRequest,
  StudentCreateRequest,
  StudentCreatedResponse,
  HouseholdCreateRequest,
  HouseholdCreatedResponse,
  HouseholdMemberRequest,
  HouseholdMemberResponse,
  LogoutResponse,
  PaymentReceiptResponse,
  PaymentDistributionResponse,
  SubscriptionResponse,
  EntitlementGrantResponse,
  EntitlementConsumptionResponse,
  EntitlementAdjustmentResponse,
  TemporaryAccessResponse,
  LedgerEntryResponse,
  FinancialPeriodResponse,
  TeacherAccrualResponse,
  PayoutAttemptResponse,
  ConfirmedPayoutResponse,
  PayrollItemObligation,
  PayrollItemPayoutsItem,
  PayrollItem,
  TeacherPayrollResponse,
  LedgerAdjustmentResponse,
  LedgerLineInput,
  PaymentRegisterRequest,
  PaymentDistributionRequest,
  SubscriptionCreateRequest,
  EntitlementGrantRequest,
  EntitlementConsumeRequest,
  EntitlementAdjustRequest,
  TemporaryAccessRequest,
  LedgerPublishRequest,
  LedgerAdjustRequest,
  AccrualCreateRequest,
  PayoutAttemptRequest,
  PayoutConfirmRequest,
  SubjectResponse,
  EnrollmentResponse,
  TeachingAssignmentResponse,
  LessonResponse,
  RecurringSlotResponse,
  SlotGenerationResponse,
  TeacherAvailabilityResponse,
  ScheduleChangeRequestResponse,
  LessonOutcomeReportResponse,
  LessonActualOutcomeResponse,
  ConfirmedLessonOutcomeResponse,
  SubjectCreateRequest,
  EnrollmentCreateRequest,
  TeachingAssignmentCreateRequest,
  ScheduleReasonRequest,
  RecurringSlotCreateRequest,
  RecurringSlotPatchRequest,
  LessonCreateRequest,
  LessonRescheduleRequest,
  LessonOutcomeReportRequest,
  ConfirmLessonOutcomeRequest,
  TeacherAvailabilityRequest,
  ScheduleChangeRequestInput,
  EmptyRequest,
  CreateSessionResponse,
  ConfirmPaymentRequest,
  ApproveDistributionRequest,
  CloseFinancialPeriodRequest,
  GenerateSlotOccurrencesRequest,
  StartLessonRequest,
  LoginRequestAlternative1,
  LoginRequestAlternative2,
  HouseholdMemberRequestAlternative1,
  HouseholdMemberRequestAlternative2,
  LedgerEntryResponseBalanceSnapshotValue,
];
export const SCHEMA_OVERRIDES = {
  FinanceMoney: {
    type: 'string',
    pattern: '^(?:0|[1-9]\\d{0,15})(?:\\.\\d{1,4})?$',
    description:
      'Exact NUMERIC(20,4) decimal string; JSON numbers and exponents are rejected. Positive for payments/lines; zero only for explicit director accrual decision.',
  },
  LoginRequest: {
    oneOf: [
      {
        $ref: '#/components/schemas/LoginRequestAlternative1',
      },
      {
        $ref: '#/components/schemas/LoginRequestAlternative2',
      },
    ],
  },
  HouseholdMemberRequest: {
    oneOf: [
      {
        $ref: '#/components/schemas/HouseholdMemberRequestAlternative1',
      },
      {
        $ref: '#/components/schemas/HouseholdMemberRequestAlternative2',
      },
    ],
  },
  CreateSessionResponse: {
    oneOf: [
      {
        $ref: '#/components/schemas/SessionResponse',
      },
      {
        $ref: '#/components/schemas/WebAuthnStartResponse',
      },
    ],
  },
};
export const SCHEMA_ADDITIONAL_PROPERTIES = {
  HealthResponse: false,
  CsrfResponse: false,
  ApiError: false,
  SessionResponse: false,
  WebAuthnStartRequest: false,
  WebAuthnOptions: true,
  WebAuthnStartResponse: false,
  WebAuthnFinishRequest: false,
  PasskeyRegisteredResponse: false,
  RecoveryInitiateRequest: false,
  RecoveryInitiatedResponse: false,
  RecoveryCompleteRequest: false,
  StudentCreateRequest: false,
  StudentCreatedResponse: false,
  HouseholdCreateRequest: false,
  HouseholdCreatedResponse: false,
  HouseholdMemberResponse: false,
  LogoutResponse: false,
  PaymentReceiptResponse: true,
  PaymentDistributionResponse: true,
  SubscriptionResponse: true,
  EntitlementGrantResponse: true,
  EntitlementConsumptionResponse: true,
  EntitlementAdjustmentResponse: true,
  TemporaryAccessResponse: true,
  LedgerEntryResponse: true,
  FinancialPeriodResponse: true,
  TeacherAccrualResponse: true,
  PayoutAttemptResponse: true,
  ConfirmedPayoutResponse: true,
  PayrollItem: false,
  TeacherPayrollResponse: false,
  LedgerAdjustmentResponse: false,
  LedgerLineInput: false,
  PaymentRegisterRequest: false,
  PaymentDistributionRequest: false,
  SubscriptionCreateRequest: false,
  EntitlementGrantRequest: false,
  EntitlementConsumeRequest: false,
  EntitlementAdjustRequest: false,
  TemporaryAccessRequest: false,
  LedgerPublishRequest: false,
  LedgerAdjustRequest: false,
  AccrualCreateRequest: false,
  PayoutAttemptRequest: false,
  PayoutConfirmRequest: false,
  SubjectResponse: true,
  EnrollmentResponse: true,
  TeachingAssignmentResponse: true,
  LessonResponse: true,
  RecurringSlotResponse: true,
  SlotGenerationResponse: true,
  TeacherAvailabilityResponse: true,
  ScheduleChangeRequestResponse: true,
  LessonOutcomeReportResponse: true,
  LessonActualOutcomeResponse: true,
  ConfirmedLessonOutcomeResponse: true,
  SubjectCreateRequest: false,
  EnrollmentCreateRequest: false,
  TeachingAssignmentCreateRequest: false,
  ScheduleReasonRequest: false,
  RecurringSlotCreateRequest: false,
  RecurringSlotPatchRequest: false,
  LessonCreateRequest: false,
  LessonRescheduleRequest: false,
  LessonOutcomeReportRequest: false,
  ConfirmLessonOutcomeRequest: false,
  TeacherAvailabilityRequest: false,
  ScheduleChangeRequestInput: false,
  EmptyRequest: false,
  ConfirmPaymentRequest: false,
  ApproveDistributionRequest: false,
  CloseFinancialPeriodRequest: false,
  GenerateSlotOccurrencesRequest: false,
  StartLessonRequest: false,
  SessionResponseAccount: false,
  LoginRequestAlternative1: false,
  LoginRequestAlternative2: false,
  WebAuthnFinishRequestResponseResponse: true,
  WebAuthnFinishRequestResponse: true,
  HouseholdMemberRequestAlternative1: false,
  HouseholdMemberRequestAlternative2: false,
  LedgerEntryResponseBalanceSnapshotValue: false,
  PayrollItemObligation: false,
  PayrollItemPayoutsItem: false,
};
