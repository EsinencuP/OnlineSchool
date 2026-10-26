-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ENDED');

-- CreateEnum
CREATE TYPE "LessonStatus" AS ENUM ('SCHEDULED', 'STAR_PENDING', 'CONDUCTED', 'CANCELLED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "GrantBasis" AS ENUM ('CONFIRMED_PAYMENT');

-- CreateEnum
CREATE TYPE "ConsumptionBasis" AS ENUM ('CONFIRMED_LESSON', 'APPROVED_CANCELLATION');

-- CreateEnum
CREATE TYPE "EntitlementAdjustmentKind" AS ENUM ('GRANT_DELTA', 'CONSUMPTION_CANCELLATION');

-- CreateEnum
CREATE TYPE "LedgerDirection" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "LedgerAccountType" AS ENUM ('CASH', 'CUSTOMER_ADVANCE', 'LESSON_REVENUE', 'TEACHER_EXPENSE', 'TEACHER_PAYABLE', 'REFUND_PAYABLE', 'CORRECTION');

-- CreateEnum
CREATE TYPE "AccrualRateBasis" AS ENUM ('ORDINARY_POINTS', 'INDIVIDUAL_PROMISE', 'FINANCIAL_EXCEPTION');

-- CreateEnum
CREATE TYPE "PayoutAttemptStatus" AS ENUM ('PENDING', 'UNKNOWN', 'FAILED', 'SUCCEEDED', 'RETURNED');

-- AlterTable
ALTER TABLE "student_accounts" ADD COLUMN     "activation_subscription_id" UUID NOT NULL;

-- CreateTable
CREATE TABLE "subjects" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_subject_enrollments" (
    "id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "subject_id" UUID NOT NULL,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "valid_from" TIMESTAMPTZ(3) NOT NULL,
    "valid_to" TIMESTAMPTZ(3),
    "source_operation_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_subject_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teaching_assignments" (
    "id" UUID NOT NULL,
    "enrollment_id" UUID NOT NULL,
    "teacher_id" UUID NOT NULL,
    "valid_from" TIMESTAMPTZ(3) NOT NULL,
    "valid_to" TIMESTAMPTZ(3),
    "basis" TEXT NOT NULL,
    "assigned_by_id" UUID NOT NULL,
    "source_operation_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teaching_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teacher_availabilities" (
    "id" UUID NOT NULL,
    "teacher_id" UUID NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "timezone" TEXT NOT NULL,
    "cancelled_at" TIMESTAMPTZ(3),
    "source_operation_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teacher_availabilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_slots" (
    "id" UUID NOT NULL,
    "enrollment_id" UUID NOT NULL,
    "teaching_assignment_id" UUID NOT NULL,
    "rule" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "active_from" TIMESTAMPTZ(3) NOT NULL,
    "active_until" TIMESTAMPTZ(3),
    "duration_min" INTEGER NOT NULL,
    "source_operation_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recurring_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_occurrences" (
    "actual_start_at" TIMESTAMPTZ(3),
    "actual_teacher_at_start_id" UUID,
    "rate_at_start_snapshot" DECIMAL(20,4),
    "points_at_start_snapshot" INTEGER,
    "rate_basis_at_start" "AccrualRateBasis",
    "rate_currency_at_start" VARCHAR(3),
    "id" UUID NOT NULL,
    "enrollment_id" UUID NOT NULL,
    "teaching_assignment_id" UUID NOT NULL,
    "recurring_slot_id" UUID,
    "scheduled_teacher_id" UUID NOT NULL,
    "original_scheduled_at" TIMESTAMPTZ(3) NOT NULL,
    "scheduled_at" TIMESTAMPTZ(3) NOT NULL,
    "scheduled_end_at" TIMESTAMPTZ(3) NOT NULL,
    "status" "LessonStatus" NOT NULL DEFAULT 'SCHEDULED',
    "version" INTEGER NOT NULL DEFAULT 1,
    "source_operation_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lesson_occurrences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_change_events" (
    "id" UUID NOT NULL,
    "lesson_occurrence_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "old_values" JSONB NOT NULL,
    "new_values" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "effective_at" TIMESTAMPTZ(3) NOT NULL,
    "server_recorded_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source_operation_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lesson_change_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_actual_outcomes" (
    "currency" VARCHAR(3) NOT NULL,
    "id" UUID NOT NULL,
    "lesson_occurrence_id" UUID NOT NULL,
    "actual_teacher_id" UUID NOT NULL,
    "actual_started_at" TIMESTAMPTZ(3) NOT NULL,
    "duration_min" INTEGER NOT NULL,
    "confirmed_at" TIMESTAMPTZ(3) NOT NULL,
    "confirmed_by_id" UUID NOT NULL,
    "temporary_access_permission_id" UUID,
    "rate_snapshot" DECIMAL(20,4) NOT NULL,
    "points_snapshot" INTEGER NOT NULL,
    "rate_basis" "AccrualRateBasis" NOT NULL,
    "basis" TEXT NOT NULL,
    "source_operation_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lesson_actual_outcomes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_conditions" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "lesson_count" INTEGER NOT NULL,
    "list_price" DECIMAL(20,4) NOT NULL,
    "discount_amount" DECIMAL(20,4) NOT NULL,
    "price" DECIMAL(20,4) NOT NULL,
    "lesson_unit_price" DECIMAL(20,4) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "valid_from" TIMESTAMPTZ(3) NOT NULL,
    "valid_to" TIMESTAMPTZ(3),
    "source_operation_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sale_conditions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "enrollment_id" UUID NOT NULL,
    "sale_condition_id" UUID NOT NULL,
    "lesson_count" INTEGER NOT NULL,
    "full_price" DECIMAL(20,4) NOT NULL,
    "initial_discount_amount" DECIMAL(20,4) NOT NULL,
    "original_paid_unit_price" DECIMAL(20,4) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "valid_from" TIMESTAMPTZ(3) NOT NULL,
    "valid_to" TIMESTAMPTZ(3),
    "frozen_from" TIMESTAMPTZ(3),
    "frozen_until" TIMESTAMPTZ(3),
    "source_operation_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_receipts" (
    "id" UUID NOT NULL,
    "amount" DECIMAL(20,4) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "registered_by_manager_id" UUID NOT NULL,
    "registered_at" TIMESTAMPTZ(3) NOT NULL,
    "confirmed_by_director_id" UUID,
    "confirmed_by_director_at" TIMESTAMPTZ(3),
    "confirmation_operation_id" UUID,
    "provider" TEXT,
    "external_reference" TEXT,
    "source_operation_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_distributions" (
    "id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "amount" DECIMAL(20,4) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "approved_by_director_id" UUID,
    "approved_at" TIMESTAMPTZ(3),
    "approval_operation_id" UUID,
    "source_operation_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_distributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "temporary_access_permissions" (
    "id" UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "approved_by_director_id" UUID NOT NULL,
    "approved_at" TIMESTAMPTZ(3) NOT NULL,
    "valid_from" TIMESTAMPTZ(3) NOT NULL,
    "valid_to" TIMESTAMPTZ(3) NOT NULL,
    "max_lessons" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "source_operation_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "temporary_access_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entitlement_grants" (
    "id" UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "payment_distribution_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "basis" "GrantBasis" NOT NULL,
    "granted_at" TIMESTAMPTZ(3) NOT NULL,
    "authorized_by_id" UUID NOT NULL,
    "source_operation_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entitlement_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entitlement_consumptions" (
    "id" UUID NOT NULL,
    "grant_id" UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "lesson_occurrence_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "basis" "ConsumptionBasis" NOT NULL,
    "reason" TEXT NOT NULL,
    "authorized_by_id" UUID NOT NULL,
    "consumed_at" TIMESTAMPTZ(3) NOT NULL,
    "cancelled_at" TIMESTAMPTZ(3),
    "cancellation_adjustment_id" UUID,
    "source_operation_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entitlement_consumptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entitlement_adjustments" (
    "id" UUID NOT NULL,
    "grant_id" UUID NOT NULL,
    "original_consumption_id" UUID,
    "kind" "EntitlementAdjustmentKind" NOT NULL,
    "delta_quantity" INTEGER NOT NULL,
    "author_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "effective_at" TIMESTAMPTZ(3) NOT NULL,
    "financial_period_id" UUID NOT NULL,
    "source_operation_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entitlement_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_periods" (
    "id" UUID NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "closed_at" TIMESTAMPTZ(3),
    "closed_by_id" UUID,
    "closure_operation_id" UUID,
    "source_operation_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refund_records" (
    "id" UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "calculated_amount" DECIMAL(20,4) NOT NULL,
    "original_paid_unit_price" DECIMAL(20,4) NOT NULL,
    "paid_unused_quantity" INTEGER NOT NULL,
    "calculation_basis" TEXT NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "approved_amount" DECIMAL(20,4),
    "approved_by_director_id" UUID,
    "approved_by_director_at" TIMESTAMPTZ(3),
    "approval_operation_id" UUID,
    "executed_amount" DECIMAL(20,4),
    "executed_at" TIMESTAMPTZ(3),
    "execution_reference" TEXT,
    "source_operation_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refund_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teacher_accruals" (
    "id" UUID NOT NULL,
    "lesson_actual_outcome_id" UUID NOT NULL,
    "teacher_id" UUID NOT NULL,
    "rate_snapshot" DECIMAL(20,4) NOT NULL,
    "points_snapshot" INTEGER NOT NULL,
    "rate_basis" "AccrualRateBasis" NOT NULL,
    "amount" DECIMAL(20,4) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "basis" TEXT NOT NULL,
    "recognized_at" TIMESTAMPTZ(3) NOT NULL,
    "authorized_by_id" UUID NOT NULL,
    "financial_period_id" UUID NOT NULL,
    "source_operation_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teacher_accruals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_obligations" (
    "id" UUID NOT NULL,
    "accrual_id" UUID NOT NULL,
    "amount" DECIMAL(20,4) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "recognized_at" TIMESTAMPTZ(3) NOT NULL,
    "recognition_entry_id" UUID,
    "source_operation_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_obligations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payout_attempts" (
    "id" UUID NOT NULL,
    "obligation_id" UUID NOT NULL,
    "amount" DECIMAL(20,4) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "status" "PayoutAttemptStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT NOT NULL,
    "provider_request_id" TEXT NOT NULL,
    "attempted_by_id" UUID NOT NULL,
    "attempted_at" TIMESTAMPTZ(3) NOT NULL,
    "source_operation_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payout_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "confirmed_payouts" (
    "id" UUID NOT NULL,
    "attempt_id" UUID NOT NULL,
    "amount" DECIMAL(20,4) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "confirmed_at" TIMESTAMPTZ(3) NOT NULL,
    "confirmed_by_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_confirmation_id" TEXT NOT NULL,
    "source_operation_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "confirmed_payouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_documents" (
    "id" UUID NOT NULL,
    "payment_id" UUID,
    "refund_id" UUID,
    "accrual_id" UUID,
    "payout_id" UUID,
    "correction_of_document_id" UUID,
    "basis" TEXT NOT NULL,
    "source_operation_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "financial_period_id" UUID NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "effective_at" TIMESTAMPTZ(3) NOT NULL,
    "balanced_at" TIMESTAMPTZ(3),
    "published_at" TIMESTAMPTZ(3),
    "published_by_id" UUID,
    "publication_operation_id" UUID,
    "balance_snapshot" JSONB,
    "reverses_entry_id" UUID,
    "source_operation_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_lines" (
    "id" UUID NOT NULL,
    "entry_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "account_type" "LedgerAccountType" NOT NULL,
    "amount" DECIMAL(20,4) NOT NULL,
    "direction" "LedgerDirection" NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subjects_code_key" ON "subjects"("code");

-- CreateIndex
CREATE UNIQUE INDEX "student_subject_enrollments_source_operation_id_key" ON "student_subject_enrollments"("source_operation_id");

-- CreateIndex
CREATE INDEX "student_subject_enrollments_student_id_idx" ON "student_subject_enrollments"("student_id");

-- CreateIndex
CREATE INDEX "student_subject_enrollments_subject_id_idx" ON "student_subject_enrollments"("subject_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_current_student_subject" ON "student_subject_enrollments"("student_id", "subject_id") WHERE (valid_to IS NULL);

-- CreateIndex
CREATE UNIQUE INDEX "teaching_assignments_source_operation_id_key" ON "teaching_assignments"("source_operation_id");

-- CreateIndex
CREATE INDEX "teaching_assignments_enrollment_id_idx" ON "teaching_assignments"("enrollment_id");

-- CreateIndex
CREATE INDEX "teaching_assignments_teacher_id_idx" ON "teaching_assignments"("teacher_id");

-- CreateIndex
CREATE INDEX "teaching_assignments_assigned_by_id_idx" ON "teaching_assignments"("assigned_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "teacher_availabilities_source_operation_id_key" ON "teacher_availabilities"("source_operation_id");

-- CreateIndex
CREATE INDEX "teacher_availabilities_teacher_id_idx" ON "teacher_availabilities"("teacher_id");

-- CreateIndex
CREATE UNIQUE INDEX "recurring_slots_source_operation_id_key" ON "recurring_slots"("source_operation_id");

-- CreateIndex
CREATE INDEX "recurring_slots_enrollment_id_idx" ON "recurring_slots"("enrollment_id");

-- CreateIndex
CREATE INDEX "recurring_slots_teaching_assignment_id_idx" ON "recurring_slots"("teaching_assignment_id");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_occurrences_source_operation_id_key" ON "lesson_occurrences"("source_operation_id");

-- CreateIndex
CREATE INDEX "lesson_occurrences_enrollment_id_idx" ON "lesson_occurrences"("enrollment_id");

-- CreateIndex
CREATE INDEX "lesson_occurrences_teaching_assignment_id_idx" ON "lesson_occurrences"("teaching_assignment_id");

-- CreateIndex
CREATE INDEX "lesson_occurrences_recurring_slot_id_idx" ON "lesson_occurrences"("recurring_slot_id");

-- CreateIndex
CREATE INDEX "lesson_occurrences_scheduled_teacher_id_idx" ON "lesson_occurrences"("scheduled_teacher_id");

-- CreateIndex
CREATE INDEX "lesson_occurrences_scheduled_teacher_id_scheduled_at_idx" ON "lesson_occurrences"("scheduled_teacher_id", "scheduled_at");

-- CreateIndex
CREATE INDEX "lesson_occurrences_actual_teacher_at_start_id_idx" ON "lesson_occurrences"("actual_teacher_at_start_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_recurring_lesson_origin" ON "lesson_occurrences"("recurring_slot_id", "original_scheduled_at");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_change_events_source_operation_id_key" ON "lesson_change_events"("source_operation_id");

-- CreateIndex
CREATE INDEX "lesson_change_events_lesson_occurrence_id_idx" ON "lesson_change_events"("lesson_occurrence_id");

-- CreateIndex
CREATE INDEX "lesson_change_events_author_id_idx" ON "lesson_change_events"("author_id");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_actual_outcomes_lesson_occurrence_id_key" ON "lesson_actual_outcomes"("lesson_occurrence_id");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_actual_outcomes_source_operation_id_key" ON "lesson_actual_outcomes"("source_operation_id");

-- CreateIndex
CREATE INDEX "lesson_actual_outcomes_actual_teacher_id_idx" ON "lesson_actual_outcomes"("actual_teacher_id");

-- CreateIndex
CREATE INDEX "lesson_actual_outcomes_confirmed_by_id_idx" ON "lesson_actual_outcomes"("confirmed_by_id");

-- CreateIndex
CREATE INDEX "lesson_actual_outcomes_temporary_access_permission_id_idx" ON "lesson_actual_outcomes"("temporary_access_permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "sale_conditions_source_operation_id_key" ON "sale_conditions"("source_operation_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_sale_condition_version" ON "sale_conditions"("code", "version");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_source_operation_id_key" ON "subscriptions"("source_operation_id");

-- CreateIndex
CREATE INDEX "subscriptions_enrollment_id_idx" ON "subscriptions"("enrollment_id");

-- CreateIndex
CREATE INDEX "subscriptions_sale_condition_id_idx" ON "subscriptions"("sale_condition_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_receipts_confirmation_operation_id_key" ON "payment_receipts"("confirmation_operation_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_receipts_source_operation_id_key" ON "payment_receipts"("source_operation_id");

-- CreateIndex
CREATE INDEX "payment_receipts_registered_by_manager_id_idx" ON "payment_receipts"("registered_by_manager_id");

-- CreateIndex
CREATE INDEX "payment_receipts_confirmed_by_director_id_idx" ON "payment_receipts"("confirmed_by_director_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_payment_provider_reference" ON "payment_receipts"("provider", "external_reference");

-- CreateIndex
CREATE UNIQUE INDEX "payment_distributions_approval_operation_id_key" ON "payment_distributions"("approval_operation_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_distributions_source_operation_id_key" ON "payment_distributions"("source_operation_id");

-- CreateIndex
CREATE INDEX "payment_distributions_payment_id_idx" ON "payment_distributions"("payment_id");

-- CreateIndex
CREATE INDEX "payment_distributions_subscription_id_idx" ON "payment_distributions"("subscription_id");

-- CreateIndex
CREATE INDEX "payment_distributions_approved_by_director_id_idx" ON "payment_distributions"("approved_by_director_id");

-- CreateIndex
CREATE UNIQUE INDEX "temporary_access_permissions_source_operation_id_key" ON "temporary_access_permissions"("source_operation_id");

-- CreateIndex
CREATE INDEX "temporary_access_permissions_subscription_id_idx" ON "temporary_access_permissions"("subscription_id");

-- CreateIndex
CREATE INDEX "temporary_access_permissions_approved_by_director_id_idx" ON "temporary_access_permissions"("approved_by_director_id");

-- CreateIndex
CREATE UNIQUE INDEX "entitlement_grants_source_operation_id_key" ON "entitlement_grants"("source_operation_id");

-- CreateIndex
CREATE INDEX "entitlement_grants_subscription_id_idx" ON "entitlement_grants"("subscription_id");

-- CreateIndex
CREATE INDEX "entitlement_grants_payment_distribution_id_idx" ON "entitlement_grants"("payment_distribution_id");

-- CreateIndex
CREATE INDEX "entitlement_grants_authorized_by_id_idx" ON "entitlement_grants"("authorized_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "entitlement_consumptions_cancellation_adjustment_id_key" ON "entitlement_consumptions"("cancellation_adjustment_id");

-- CreateIndex
CREATE UNIQUE INDEX "entitlement_consumptions_source_operation_id_key" ON "entitlement_consumptions"("source_operation_id");

-- CreateIndex
CREATE INDEX "entitlement_consumptions_grant_id_idx" ON "entitlement_consumptions"("grant_id");

-- CreateIndex
CREATE INDEX "entitlement_consumptions_subscription_id_idx" ON "entitlement_consumptions"("subscription_id");

-- CreateIndex
CREATE INDEX "entitlement_consumptions_lesson_occurrence_id_idx" ON "entitlement_consumptions"("lesson_occurrence_id");

-- CreateIndex
CREATE INDEX "entitlement_consumptions_authorized_by_id_idx" ON "entitlement_consumptions"("authorized_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_entitlement_consumption_lesson" ON "entitlement_consumptions"("lesson_occurrence_id", "subscription_id") WHERE (cancelled_at IS NULL);

-- CreateIndex
CREATE UNIQUE INDEX "uq_active_lesson_consumption" ON "entitlement_consumptions"("lesson_occurrence_id") WHERE (cancelled_at IS NULL);

-- CreateIndex
CREATE UNIQUE INDEX "entitlement_adjustments_source_operation_id_key" ON "entitlement_adjustments"("source_operation_id");

-- CreateIndex
CREATE INDEX "entitlement_adjustments_grant_id_idx" ON "entitlement_adjustments"("grant_id");

-- CreateIndex
CREATE INDEX "entitlement_adjustments_original_consumption_id_idx" ON "entitlement_adjustments"("original_consumption_id");

-- CreateIndex
CREATE INDEX "entitlement_adjustments_author_id_idx" ON "entitlement_adjustments"("author_id");

-- CreateIndex
CREATE INDEX "entitlement_adjustments_financial_period_id_idx" ON "entitlement_adjustments"("financial_period_id");

-- CreateIndex
CREATE UNIQUE INDEX "financial_periods_closure_operation_id_key" ON "financial_periods"("closure_operation_id");

-- CreateIndex
CREATE UNIQUE INDEX "financial_periods_source_operation_id_key" ON "financial_periods"("source_operation_id");

-- CreateIndex
CREATE INDEX "financial_periods_closed_by_id_idx" ON "financial_periods"("closed_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_financial_period_range" ON "financial_periods"("starts_at", "ends_at");

-- CreateIndex
CREATE UNIQUE INDEX "refund_records_approval_operation_id_key" ON "refund_records"("approval_operation_id");

-- CreateIndex
CREATE UNIQUE INDEX "refund_records_execution_reference_key" ON "refund_records"("execution_reference");

-- CreateIndex
CREATE UNIQUE INDEX "refund_records_source_operation_id_key" ON "refund_records"("source_operation_id");

-- CreateIndex
CREATE INDEX "refund_records_subscription_id_idx" ON "refund_records"("subscription_id");

-- CreateIndex
CREATE INDEX "refund_records_approved_by_director_id_idx" ON "refund_records"("approved_by_director_id");

-- CreateIndex
CREATE UNIQUE INDEX "teacher_accruals_lesson_actual_outcome_id_key" ON "teacher_accruals"("lesson_actual_outcome_id");

-- CreateIndex
CREATE UNIQUE INDEX "teacher_accruals_source_operation_id_key" ON "teacher_accruals"("source_operation_id");

-- CreateIndex
CREATE INDEX "teacher_accruals_teacher_id_idx" ON "teacher_accruals"("teacher_id");

-- CreateIndex
CREATE INDEX "teacher_accruals_authorized_by_id_idx" ON "teacher_accruals"("authorized_by_id");

-- CreateIndex
CREATE INDEX "teacher_accruals_financial_period_id_idx" ON "teacher_accruals"("financial_period_id");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_obligations_accrual_id_key" ON "payroll_obligations"("accrual_id");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_obligations_recognition_entry_id_key" ON "payroll_obligations"("recognition_entry_id");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_obligations_source_operation_id_key" ON "payroll_obligations"("source_operation_id");

-- CreateIndex
CREATE UNIQUE INDEX "payout_attempts_source_operation_id_key" ON "payout_attempts"("source_operation_id");

-- CreateIndex
CREATE INDEX "payout_attempts_obligation_id_idx" ON "payout_attempts"("obligation_id");

-- CreateIndex
CREATE INDEX "payout_attempts_attempted_by_id_idx" ON "payout_attempts"("attempted_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_payout_provider_request" ON "payout_attempts"("provider", "provider_request_id");

-- CreateIndex
CREATE UNIQUE INDEX "confirmed_payouts_attempt_id_key" ON "confirmed_payouts"("attempt_id");

-- CreateIndex
CREATE UNIQUE INDEX "confirmed_payouts_source_operation_id_key" ON "confirmed_payouts"("source_operation_id");

-- CreateIndex
CREATE INDEX "confirmed_payouts_confirmed_by_id_idx" ON "confirmed_payouts"("confirmed_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_payout_confirmation" ON "confirmed_payouts"("provider", "provider_confirmation_id");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_documents_payment_id_key" ON "ledger_documents"("payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_documents_refund_id_key" ON "ledger_documents"("refund_id");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_documents_accrual_id_key" ON "ledger_documents"("accrual_id");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_documents_payout_id_key" ON "ledger_documents"("payout_id");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_documents_source_operation_id_key" ON "ledger_documents"("source_operation_id");

-- CreateIndex
CREATE INDEX "ledger_documents_correction_of_document_id_idx" ON "ledger_documents"("correction_of_document_id");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_entries_document_id_key" ON "ledger_entries"("document_id");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_entries_publication_operation_id_key" ON "ledger_entries"("publication_operation_id");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_entries_source_operation_id_key" ON "ledger_entries"("source_operation_id");

-- CreateIndex
CREATE INDEX "ledger_entries_financial_period_id_idx" ON "ledger_entries"("financial_period_id");

-- CreateIndex
CREATE INDEX "ledger_entries_published_by_id_idx" ON "ledger_entries"("published_by_id");

-- CreateIndex
CREATE INDEX "ledger_entries_reverses_entry_id_idx" ON "ledger_entries"("reverses_entry_id");

-- CreateIndex
CREATE INDEX "ledger_lines_entry_id_idx" ON "ledger_lines"("entry_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_ledger_entry_position" ON "ledger_lines"("entry_id", "position");

-- CreateIndex
CREATE INDEX "student_accounts_activation_subscription_id_idx" ON "student_accounts"("activation_subscription_id");

-- CreateIndex
CREATE INDEX "student_accounts_activation_payment_confirmation_id_idx" ON "student_accounts"("activation_payment_confirmation_id");

-- CreateIndex
CREATE INDEX "student_accounts_activation_director_admission_id_idx" ON "student_accounts"("activation_director_admission_id");

-- AddForeignKey
ALTER TABLE "student_accounts" ADD CONSTRAINT "fk_t03_activation_subscription" FOREIGN KEY ("activation_subscription_id") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "student_accounts" ADD CONSTRAINT "fk_t03_activation_payment" FOREIGN KEY ("activation_payment_confirmation_id") REFERENCES "payment_receipts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "student_accounts" ADD CONSTRAINT "fk_t03_activation_director" FOREIGN KEY ("activation_director_admission_id") REFERENCES "temporary_access_permissions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "student_subject_enrollments" ADD CONSTRAINT "fk_t03_student_subject_enrollment_student" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "student_subject_enrollments" ADD CONSTRAINT "fk_t03_student_subject_enrollment_subject" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "teaching_assignments" ADD CONSTRAINT "fk_t03_teaching_assignment_enrollment" FOREIGN KEY ("enrollment_id") REFERENCES "student_subject_enrollments"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "teaching_assignments" ADD CONSTRAINT "fk_t03_teaching_assignment_teacher" FOREIGN KEY ("teacher_id") REFERENCES "teacher_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "teaching_assignments" ADD CONSTRAINT "fk_t03_teaching_assignment_assigned_by" FOREIGN KEY ("assigned_by_id") REFERENCES "staff_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "teacher_availabilities" ADD CONSTRAINT "fk_t03_teacher_availability_teacher" FOREIGN KEY ("teacher_id") REFERENCES "teacher_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "recurring_slots" ADD CONSTRAINT "fk_t03_recurring_slot_enrollment" FOREIGN KEY ("enrollment_id") REFERENCES "student_subject_enrollments"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "recurring_slots" ADD CONSTRAINT "fk_t03_recurring_slot_teaching_assignment" FOREIGN KEY ("teaching_assignment_id") REFERENCES "teaching_assignments"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "lesson_occurrences" ADD CONSTRAINT "fk_t03_lesson_start_teacher" FOREIGN KEY ("actual_teacher_at_start_id") REFERENCES "teacher_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "lesson_occurrences" ADD CONSTRAINT "fk_t03_lesson_occurrence_enrollment" FOREIGN KEY ("enrollment_id") REFERENCES "student_subject_enrollments"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "lesson_occurrences" ADD CONSTRAINT "fk_t03_lesson_occurrence_teaching_assignment" FOREIGN KEY ("teaching_assignment_id") REFERENCES "teaching_assignments"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "lesson_occurrences" ADD CONSTRAINT "fk_t03_lesson_occurrence_recurring_slot" FOREIGN KEY ("recurring_slot_id") REFERENCES "recurring_slots"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "lesson_occurrences" ADD CONSTRAINT "fk_t03_lesson_occurrence_scheduled_teacher" FOREIGN KEY ("scheduled_teacher_id") REFERENCES "teacher_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "lesson_change_events" ADD CONSTRAINT "fk_t03_lesson_change_event_lesson_occurrence" FOREIGN KEY ("lesson_occurrence_id") REFERENCES "lesson_occurrences"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "lesson_change_events" ADD CONSTRAINT "fk_t03_lesson_change_event_author" FOREIGN KEY ("author_id") REFERENCES "auth_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "lesson_actual_outcomes" ADD CONSTRAINT "fk_t03_lesson_actual_outcome_lesson_occurrence" FOREIGN KEY ("lesson_occurrence_id") REFERENCES "lesson_occurrences"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "lesson_actual_outcomes" ADD CONSTRAINT "fk_t03_lesson_actual_outcome_actual_teacher" FOREIGN KEY ("actual_teacher_id") REFERENCES "teacher_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "lesson_actual_outcomes" ADD CONSTRAINT "fk_t03_lesson_actual_outcome_confirmed_by" FOREIGN KEY ("confirmed_by_id") REFERENCES "staff_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "lesson_actual_outcomes" ADD CONSTRAINT "fk_t03_lesson_actual_outcome_temporary_access_permission" FOREIGN KEY ("temporary_access_permission_id") REFERENCES "temporary_access_permissions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "fk_t03_subscription_enrollment" FOREIGN KEY ("enrollment_id") REFERENCES "student_subject_enrollments"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "fk_t03_subscription_sale_condition" FOREIGN KEY ("sale_condition_id") REFERENCES "sale_conditions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "payment_receipts" ADD CONSTRAINT "fk_t03_payment_receipt_registered_by_manager" FOREIGN KEY ("registered_by_manager_id") REFERENCES "staff_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "payment_receipts" ADD CONSTRAINT "fk_t03_payment_receipt_confirmed_by_director" FOREIGN KEY ("confirmed_by_director_id") REFERENCES "staff_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "payment_distributions" ADD CONSTRAINT "fk_t03_payment_distribution_payment" FOREIGN KEY ("payment_id") REFERENCES "payment_receipts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "payment_distributions" ADD CONSTRAINT "fk_t03_payment_distribution_subscription" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "payment_distributions" ADD CONSTRAINT "fk_t03_payment_distribution_approved_by_director" FOREIGN KEY ("approved_by_director_id") REFERENCES "staff_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "temporary_access_permissions" ADD CONSTRAINT "fk_t03_temporary_access_permission_subscription" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "temporary_access_permissions" ADD CONSTRAINT "fk_t03_temporary_access_permission_approved_by_director" FOREIGN KEY ("approved_by_director_id") REFERENCES "staff_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "entitlement_grants" ADD CONSTRAINT "fk_t03_entitlement_grant_subscription" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "entitlement_grants" ADD CONSTRAINT "fk_t03_entitlement_grant_payment_distribution" FOREIGN KEY ("payment_distribution_id") REFERENCES "payment_distributions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "entitlement_grants" ADD CONSTRAINT "fk_t03_entitlement_grant_authorized_by" FOREIGN KEY ("authorized_by_id") REFERENCES "staff_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "entitlement_consumptions" ADD CONSTRAINT "fk_t03_entitlement_consumption_grant" FOREIGN KEY ("grant_id") REFERENCES "entitlement_grants"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "entitlement_consumptions" ADD CONSTRAINT "fk_t03_entitlement_consumption_subscription" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "entitlement_consumptions" ADD CONSTRAINT "fk_t03_entitlement_consumption_lesson_occurrence" FOREIGN KEY ("lesson_occurrence_id") REFERENCES "lesson_occurrences"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "entitlement_consumptions" ADD CONSTRAINT "fk_t03_entitlement_consumption_authorized_by" FOREIGN KEY ("authorized_by_id") REFERENCES "staff_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "entitlement_consumptions" ADD CONSTRAINT "fk_t03_entitlement_consumption_cancellation_adjustment" FOREIGN KEY ("cancellation_adjustment_id") REFERENCES "entitlement_adjustments"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "entitlement_adjustments" ADD CONSTRAINT "fk_t03_entitlement_adjustment_grant" FOREIGN KEY ("grant_id") REFERENCES "entitlement_grants"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "entitlement_adjustments" ADD CONSTRAINT "fk_t03_entitlement_adjustment_original_consumption" FOREIGN KEY ("original_consumption_id") REFERENCES "entitlement_consumptions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "entitlement_adjustments" ADD CONSTRAINT "fk_t03_entitlement_adjustment_author" FOREIGN KEY ("author_id") REFERENCES "staff_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "entitlement_adjustments" ADD CONSTRAINT "fk_t03_entitlement_adjustment_financial_period" FOREIGN KEY ("financial_period_id") REFERENCES "financial_periods"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "financial_periods" ADD CONSTRAINT "fk_t03_financial_period_closed_by" FOREIGN KEY ("closed_by_id") REFERENCES "staff_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "refund_records" ADD CONSTRAINT "fk_t03_refund_record_subscription" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "refund_records" ADD CONSTRAINT "fk_t03_refund_record_approved_by_director" FOREIGN KEY ("approved_by_director_id") REFERENCES "staff_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "teacher_accruals" ADD CONSTRAINT "fk_t03_teacher_accrual_lesson_actual_outcome" FOREIGN KEY ("lesson_actual_outcome_id") REFERENCES "lesson_actual_outcomes"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "teacher_accruals" ADD CONSTRAINT "fk_t03_teacher_accrual_teacher" FOREIGN KEY ("teacher_id") REFERENCES "teacher_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "teacher_accruals" ADD CONSTRAINT "fk_t03_teacher_accrual_authorized_by" FOREIGN KEY ("authorized_by_id") REFERENCES "staff_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "teacher_accruals" ADD CONSTRAINT "fk_t03_teacher_accrual_financial_period" FOREIGN KEY ("financial_period_id") REFERENCES "financial_periods"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "payroll_obligations" ADD CONSTRAINT "fk_t03_payroll_obligation_accrual" FOREIGN KEY ("accrual_id") REFERENCES "teacher_accruals"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "payroll_obligations" ADD CONSTRAINT "fk_t03_payroll_obligation_recognition_entry" FOREIGN KEY ("recognition_entry_id") REFERENCES "ledger_entries"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "payout_attempts" ADD CONSTRAINT "fk_t03_payout_attempt_obligation" FOREIGN KEY ("obligation_id") REFERENCES "payroll_obligations"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "payout_attempts" ADD CONSTRAINT "fk_t03_payout_attempt_attempted_by" FOREIGN KEY ("attempted_by_id") REFERENCES "staff_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "confirmed_payouts" ADD CONSTRAINT "fk_t03_confirmed_payout_attempt" FOREIGN KEY ("attempt_id") REFERENCES "payout_attempts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "confirmed_payouts" ADD CONSTRAINT "fk_t03_confirmed_payout_confirmed_by" FOREIGN KEY ("confirmed_by_id") REFERENCES "staff_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ledger_documents" ADD CONSTRAINT "fk_t03_ledger_document_payment" FOREIGN KEY ("payment_id") REFERENCES "payment_receipts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ledger_documents" ADD CONSTRAINT "fk_t03_ledger_document_refund" FOREIGN KEY ("refund_id") REFERENCES "refund_records"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ledger_documents" ADD CONSTRAINT "fk_t03_ledger_document_accrual" FOREIGN KEY ("accrual_id") REFERENCES "teacher_accruals"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ledger_documents" ADD CONSTRAINT "fk_t03_ledger_document_payout" FOREIGN KEY ("payout_id") REFERENCES "confirmed_payouts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ledger_documents" ADD CONSTRAINT "fk_t03_ledger_document_correction_of_document" FOREIGN KEY ("correction_of_document_id") REFERENCES "ledger_documents"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "fk_t03_ledger_entry_document" FOREIGN KEY ("document_id") REFERENCES "ledger_documents"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "fk_t03_ledger_entry_financial_period" FOREIGN KEY ("financial_period_id") REFERENCES "financial_periods"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "fk_t03_ledger_entry_published_by" FOREIGN KEY ("published_by_id") REFERENCES "staff_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "fk_t03_ledger_entry_reverses_entry" FOREIGN KEY ("reverses_entry_id") REFERENCES "ledger_entries"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ledger_lines" ADD CONSTRAINT "fk_t03_ledger_line_entry" FOREIGN KEY ("entry_id") REFERENCES "ledger_entries"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
