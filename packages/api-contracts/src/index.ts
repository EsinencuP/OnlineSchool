import type { components } from './generated/openapi.js';

export type { components, operations, paths } from './generated/openapi.js';
export type HealthResponse = components['schemas']['HealthResponse'];
export type ApiError = components['schemas']['ApiError'];
export type ErrorResponseDto = ApiError;
export type CsrfResponse = components['schemas']['CsrfResponse'];
export type SessionResponse = components['schemas']['SessionResponse'];
export type LoginRequest = components['schemas']['LoginRequest'];
export type WebAuthnStartResponse = components['schemas']['WebAuthnStartResponse'];
export type WebAuthnFinishRequest = components['schemas']['WebAuthnFinishRequest'];
export type RecoveryInitiateRequest = components['schemas']['RecoveryInitiateRequest'];
export type RecoveryCompleteRequest = components['schemas']['RecoveryCompleteRequest'];
export type StudentCreateRequest = components['schemas']['StudentCreateRequest'];
export type HouseholdMemberRequest = components['schemas']['HouseholdMemberRequest'];

export type PaymentRegisterRequest = components['schemas']['PaymentRegisterRequest'];
export type PaymentDistributionRequest = components['schemas']['PaymentDistributionRequest'];
export type SubscriptionCreateRequest = components['schemas']['SubscriptionCreateRequest'];
export type EntitlementGrantRequest = components['schemas']['EntitlementGrantRequest'];
export type EntitlementConsumeRequest = components['schemas']['EntitlementConsumeRequest'];
export type EntitlementAdjustRequest = components['schemas']['EntitlementAdjustRequest'];
export type TemporaryAccessRequest = components['schemas']['TemporaryAccessRequest'];
export type LedgerPublishRequest = components['schemas']['LedgerPublishRequest'];
export type LedgerAdjustRequest = components['schemas']['LedgerAdjustRequest'];
export type AccrualCreateRequest = components['schemas']['AccrualCreateRequest'];
export type PayoutAttemptRequest = components['schemas']['PayoutAttemptRequest'];
export type PayoutConfirmRequest = components['schemas']['PayoutConfirmRequest'];
export type FinanceMoney = components['schemas']['FinanceMoney'];
export type PaymentReceiptResponse = components['schemas']['PaymentReceiptResponse'];
export type PaymentDistributionResponse = components['schemas']['PaymentDistributionResponse'];
export type SubscriptionResponse = components['schemas']['SubscriptionResponse'];
export type EntitlementGrantResponse = components['schemas']['EntitlementGrantResponse'];
export type EntitlementConsumptionResponse =
  components['schemas']['EntitlementConsumptionResponse'];
export type EntitlementAdjustmentResponse = components['schemas']['EntitlementAdjustmentResponse'];
export type TemporaryAccessResponse = components['schemas']['TemporaryAccessResponse'];
export type LedgerEntryResponse = components['schemas']['LedgerEntryResponse'];
export type FinancialPeriodResponse = components['schemas']['FinancialPeriodResponse'];
export type TeacherAccrualResponse = components['schemas']['TeacherAccrualResponse'];
export type PayoutAttemptResponse = components['schemas']['PayoutAttemptResponse'];
export type ConfirmedPayoutResponse = components['schemas']['ConfirmedPayoutResponse'];
export type TeacherPayrollResponse = components['schemas']['TeacherPayrollResponse'];
export type LedgerAdjustmentResponse = components['schemas']['LedgerAdjustmentResponse'];

export type SubjectCreateRequest = components['schemas']['SubjectCreateRequest'];
export type EnrollmentCreateRequest = components['schemas']['EnrollmentCreateRequest'];
export type TeachingAssignmentCreateRequest =
  components['schemas']['TeachingAssignmentCreateRequest'];
export type ScheduleReasonRequest = components['schemas']['ScheduleReasonRequest'];
export type RecurringSlotCreateRequest = components['schemas']['RecurringSlotCreateRequest'];
export type RecurringSlotPatchRequest = components['schemas']['RecurringSlotPatchRequest'];
export type LessonCreateRequest = components['schemas']['LessonCreateRequest'];
export type LessonRescheduleRequest = components['schemas']['LessonRescheduleRequest'];
export type LessonOutcomeReportRequest = components['schemas']['LessonOutcomeReportRequest'];
export type ConfirmLessonOutcomeRequest = components['schemas']['ConfirmLessonOutcomeRequest'];
export type TeacherAvailabilityRequest = components['schemas']['TeacherAvailabilityRequest'];
export type ScheduleChangeRequestInput = components['schemas']['ScheduleChangeRequestInput'];
export type SubjectResponse = components['schemas']['SubjectResponse'];
export type EnrollmentResponse = components['schemas']['EnrollmentResponse'];
export type TeachingAssignmentResponse = components['schemas']['TeachingAssignmentResponse'];
export type LessonResponse = components['schemas']['LessonResponse'];
export type RecurringSlotResponse = components['schemas']['RecurringSlotResponse'];
export type SlotGenerationResponse = components['schemas']['SlotGenerationResponse'];
export type TeacherAvailabilityResponse = components['schemas']['TeacherAvailabilityResponse'];
export type ScheduleChangeRequestResponse = components['schemas']['ScheduleChangeRequestResponse'];
export type LessonOutcomeReportResponse = components['schemas']['LessonOutcomeReportResponse'];
export type LessonActualOutcomeResponse = components['schemas']['LessonActualOutcomeResponse'];
export type ConfirmedLessonOutcomeResponse =
  components['schemas']['ConfirmedLessonOutcomeResponse'];

export * from './generated/client.js';
export { schoolFetch } from './transport.js';
export type { ClientError, SchoolRequestOptions } from './transport.js';
