-- Unified TASK-02/03/04 baseline. Exact original SQL history is preserved in migrations-history/.
BEGIN;
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AccountKind" AS ENUM ('STUDENT', 'STAFF', 'TEACHER');

-- CreateEnum
CREATE TYPE "RoleCode" AS ENUM ('DIRECTOR', 'MANAGER', 'TEACHER', 'STUDENT', 'TECH_OPERATOR');

-- CreateEnum
CREATE TYPE "RelationshipRole" AS ENUM ('PARENT', 'LEGAL_GUARDIAN', 'AUTHORIZED_CONTACT', 'OTHER');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'DISPUTED', 'REVOKED');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'ENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StudentActivationBasis" AS ENUM ('FULL_PAYMENT', 'LIMITED_DIRECTOR_ADMISSION');

-- CreateEnum
CREATE TYPE "MfaChallengePurpose" AS ENUM ('REGISTRATION', 'AUTHENTICATION', 'RECOVERY');

-- CreateEnum
CREATE TYPE "LeadStage" AS ENUM ('NEW', 'CONTACTED', 'TRIAL_SCHEDULED', 'TRIAL_DONE', 'AWAITING_PAYMENT', 'CONVERTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ContactChannel" AS ENUM ('CALL', 'MESSAGE', 'EMAIL', 'OTHER');

-- CreateEnum
CREATE TYPE "CrmTaskType" AS ENUM ('MANUAL', 'FOLLOW_UP', 'TRIAL_FOLLOW_UP', 'PAYMENT_FOLLOW_UP');

-- CreateEnum
CREATE TYPE "CrmTaskStatus" AS ENUM ('OPEN', 'RESOLVED', 'CANCELLED');

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

-- CreateEnum
CREATE TYPE "HomeworkReviewResult" AS ENUM ('NEEDS_REVISION', 'ACCEPTED');

-- CreateEnum
CREATE TYPE "SkillLevel" AS ENUM ('INTRODUCING', 'PRACTICING', 'APPLYING');

-- CreateEnum
CREATE TYPE "CheckpointType" AS ENUM ('LESSON_4', 'LESSON_8');

-- CreateEnum
CREATE TYPE "EducationReportStatus" AS ENUM ('DRAFT', 'GENERATED', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "S3ObjectStatus" AS ENUM ('PENDING', 'UPLOADED', 'VERIFIED', 'QUARANTINED', 'DELETED');

-- CreateEnum
CREATE TYPE "FileAuditAction" AS ENUM ('VIEW', 'DOWNLOAD', 'REVOKE');

-- CreateEnum
CREATE TYPE "AuditActorKind" AS ENUM ('ACCOUNT', 'SYSTEM', 'ANONYMOUS');

-- CreateEnum
CREATE TYPE "AuditResult" AS ENUM ('SUCCESS', 'DENIED', 'ERROR');

-- CreateEnum
CREATE TYPE "IdempotencyStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'RETRY_WAIT', 'FAILED', 'RECONCILIATION_REQUIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "JobRetryPolicy" AS ENUM ('SAFE_RETRY', 'RECONCILE_BEFORE_RETRY');

-- CreateEnum
CREATE TYPE "JobAttemptResult" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "RecoveryStatus" AS ENUM ('UNKNOWN', 'RECONCILING', 'CONFIRMED', 'ABSENT', 'MANUAL_REQUIRED');

-- CreateTable
CREATE TABLE "students" (
    "id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "birth_date" DATE,
    "phone" TEXT,
    "email" TEXT,
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "representatives" (
    "id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "representatives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_representative_links" (
    "id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "representative_id" UUID NOT NULL,
    "role" "RelationshipRole" NOT NULL,
    "basis" TEXT NOT NULL,
    "verification_status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verified_at" TIMESTAMPTZ(3),
    "verified_by_staff_id" UUID,
    "valid_from" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_to" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_representative_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "households" (
    "id" UUID NOT NULL,
    "label" TEXT,
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "households_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "household_memberships" (
    "id" UUID NOT NULL,
    "household_id" UUID NOT NULL,
    "student_id" UUID,
    "representative_id" UUID,
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "valid_from" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_to" TIMESTAMPTZ(3),
    "basis" TEXT NOT NULL,
    "recorded_by_staff_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "household_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "relationship_verifications" (
    "id" UUID NOT NULL,
    "link_id" UUID NOT NULL,
    "result" "VerificationStatus" NOT NULL,
    "basis" TEXT NOT NULL,
    "evidence_ref" TEXT,
    "verified_by_staff_id" UUID NOT NULL,
    "verified_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "relationship_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_accounts" (
    "id" UUID NOT NULL,
    "kind" "AccountKind" NOT NULL,
    "login_id" TEXT NOT NULL,
    "password_hash" TEXT,
    "disabled_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_accounts" (
    "id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "account_kind" "AccountKind" NOT NULL DEFAULT 'STUDENT',
    "activation_basis" "StudentActivationBasis" NOT NULL,
    "activation_subscription_id" UUID NOT NULL,
    "activation_payment_confirmation_id" UUID NOT NULL,
    "activation_director_admission_id" UUID,
    "activation_confirmed_by_staff_id" UUID NOT NULL,
    "activated_at" TIMESTAMPTZ(3) NOT NULL,
    "deactivated_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_accounts" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "account_kind" "AccountKind" NOT NULL DEFAULT 'STAFF',
    "full_name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "deactivated_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teacher_accounts" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "account_kind" "AccountKind" NOT NULL DEFAULT 'TEACHER',
    "full_name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "deactivated_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teacher_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "code" "RoleCode" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_assignments" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "assigned_by_staff_id" UUID,
    "valid_from" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_to" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "csrf_token_hash" CHAR(64),
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "mfa_verified_at" TIMESTAMPTZ(3),
    "last_seen_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webauthn_credentials" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "aaguid" UUID,
    "credential_id" BYTEA NOT NULL,
    "public_key" BYTEA NOT NULL,
    "sign_count" BIGINT NOT NULL DEFAULT 0,
    "transports" TEXT[],
    "backup_eligible" BOOLEAN NOT NULL DEFAULT false,
    "backed_up" BOOLEAN NOT NULL DEFAULT false,
    "last_used_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webauthn_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mfa_challenges" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "session_id" UUID,
    "purpose" "MfaChallengePurpose" NOT NULL,
    "challenge_hash" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mfa_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_revocations" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "session_id" UUID,
    "revoked_by_account_id" UUID,
    "reason" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "revoked_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "access_revocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" UUID NOT NULL,
    "stage" "LeadStage" NOT NULL DEFAULT 'NEW',
    "full_name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "source" TEXT,
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_student_links" (
    "id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "checked_by_staff_id" UUID NOT NULL,
    "basis" TEXT NOT NULL,
    "linked_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unlinked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_student_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assigned_managers" (
    "id" UUID NOT NULL,
    "manager_id" UUID NOT NULL,
    "lead_id" UUID,
    "student_id" UUID,
    "assigned_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assigned_managers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_logs" (
    "id" UUID NOT NULL,
    "lead_id" UUID,
    "student_id" UUID,
    "representative_id" UUID,
    "manager_id" UUID NOT NULL,
    "channel" "ContactChannel" NOT NULL,
    "outcome" TEXT NOT NULL,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_tasks" (
    "id" UUID NOT NULL,
    "lead_id" UUID,
    "student_id" UUID,
    "assigned_manager_id" UUID,
    "type" "CrmTaskType" NOT NULL,
    "status" "CrmTaskStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "due_at" TIMESTAMPTZ(3) NOT NULL,
    "resolved_at" TIMESTAMPTZ(3),
    "resolved_by_staff_id" UUID,
    "source_event_id" UUID,
    "idempotency_key" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_tasks_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "homework_assignments" (
    "id" UUID NOT NULL,
    "subject_id" UUID NOT NULL,
    "issued_by" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "due_at" TIMESTAMPTZ(3),
    "lesson_occurrence_id" UUID,
    "archived_at" TIMESTAMPTZ(3),
    "source_operation_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "homework_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "homework_deliveries" (
    "id" UUID NOT NULL,
    "assignment_id" UUID NOT NULL,
    "enrollment_id" UUID NOT NULL,
    "issued_by" UUID NOT NULL,
    "issued_at" TIMESTAMPTZ(3) NOT NULL,
    "due_at" TIMESTAMPTZ(3) NOT NULL,
    "cancelled_at" TIMESTAMPTZ(3),
    "source_operation_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "homework_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "homework_submissions" (
    "id" UUID NOT NULL,
    "delivery_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "submitted_at" TIMESTAMPTZ(3) NOT NULL,
    "version" INTEGER NOT NULL,
    "content" JSONB NOT NULL,
    "supersedes_submission_id" UUID,
    "source_operation_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "homework_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submission_reviews" (
    "id" UUID NOT NULL,
    "submission_id" UUID NOT NULL,
    "reviewer_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "result" "HomeworkReviewResult" NOT NULL,
    "grade" TEXT,
    "comment" TEXT,
    "reviewed_at" TIMESTAMPTZ(3) NOT NULL,
    "source_operation_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submission_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_entries" (
    "id" UUID NOT NULL,
    "subject_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "archived_at" TIMESTAMPTZ(3),
    "source_operation_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skill_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_assessments" (
    "id" UUID NOT NULL,
    "skill_id" UUID NOT NULL,
    "enrollment_id" UUID NOT NULL,
    "assessed_by" UUID NOT NULL,
    "assessed_at" TIMESTAMPTZ(3) NOT NULL,
    "lesson_ref" UUID,
    "level" "SkillLevel" NOT NULL,
    "version" INTEGER NOT NULL,
    "basis" TEXT NOT NULL,
    "supersedes_assessment_id" UUID,
    "source_operation_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skill_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "progress_checkpoints" (
    "id" UUID NOT NULL,
    "enrollment_id" UUID NOT NULL,
    "type" "CheckpointType" NOT NULL,
    "confirmed_lesson_count" INTEGER NOT NULL,
    "lesson_actual_outcome_id" UUID NOT NULL,
    "triggered_at" TIMESTAMPTZ(3) NOT NULL,
    "completed_at" TIMESTAMPTZ(3),
    "source_operation_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "progress_checkpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "education_reports" (
    "id" UUID NOT NULL,
    "checkpoint_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "period_start" TIMESTAMPTZ(3) NOT NULL,
    "period_end" TIMESTAMPTZ(3) NOT NULL,
    "content" JSONB NOT NULL,
    "status" "EducationReportStatus" NOT NULL DEFAULT 'DRAFT',
    "generated_at" TIMESTAMPTZ(3),
    "published_at" TIMESTAMPTZ(3),
    "published_by" UUID,
    "supersedes_report_id" UUID,
    "source_operation_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "education_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "s3_objects" (
    "id" UUID NOT NULL,
    "bucket" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "size" BIGINT NOT NULL,
    "content_type" TEXT NOT NULL,
    "status" "S3ObjectStatus" NOT NULL DEFAULT 'PENDING',
    "uploaded_at" TIMESTAMPTZ(3),
    "verified_at" TIMESTAMPTZ(3),
    "sha256" CHAR(64),
    "uploaded_by" UUID NOT NULL,
    "source_operation_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "s3_objects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_permissions" (
    "id" UUID NOT NULL,
    "s3_object_id" UUID NOT NULL,
    "subject_id" UUID NOT NULL,
    "subject_type" "AccountKind" NOT NULL,
    "granted_by" UUID NOT NULL,
    "granted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "can_download" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "revoked_by" UUID,
    "source_operation_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_audit_logs" (
    "id" UUID NOT NULL,
    "s3_object_id" UUID NOT NULL,
    "permission_id" UUID,
    "action" "FileAuditAction" NOT NULL,
    "actor_id" UUID NOT NULL,
    "at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "result" "AuditResult" NOT NULL,
    "request_id" UUID NOT NULL,
    "event_key" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "actor_kind" "AuditActorKind" NOT NULL,
    "system_actor_ref" TEXT,
    "action" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT,
    "result" "AuditResult" NOT NULL,
    "request_id" UUID NOT NULL,
    "source_operation_id" UUID,
    "event_key" TEXT NOT NULL,
    "metadata" JSONB,
    "recorded_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_records" (
    "id" UUID NOT NULL,
    "scope" TEXT NOT NULL,
    "key" VARCHAR(200) NOT NULL,
    "command_type" TEXT NOT NULL,
    "request_hash" CHAR(64) NOT NULL,
    "status" "IdempotencyStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "result_hash" CHAR(64),
    "result" JSONB,
    "completed_at" TIMESTAMPTZ(3),
    "expires_at" TIMESTAMPTZ(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP + '48:00:00'::interval),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL,
    "topic" TEXT NOT NULL,
    "schema_version" INTEGER NOT NULL DEFAULT 1,
    "aggregate_type" TEXT NOT NULL,
    "aggregate_id" UUID NOT NULL,
    "source_operation_id" UUID NOT NULL,
    "audit_event_id" UUID NOT NULL,
    "event_key" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "published_at" TIMESTAMPTZ(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_attempt_at" TIMESTAMPTZ(3),
    "next_attempt_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_by" TEXT,
    "locked_until" TIMESTAMPTZ(3),
    "delivery_reference" TEXT,
    "last_error_code" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_records" (
    "id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB NOT NULL,
    "source_operation_id" UUID NOT NULL,
    "source_outbox_event_id" UUID,
    "deduplication_key" TEXT NOT NULL,
    "retry_policy" "JobRetryPolicy" NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL,
    "next_run_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_by" TEXT,
    "locked_until" TIMESTAMPTZ(3),
    "started_at" TIMESTAMPTZ(3),
    "finished_at" TIMESTAMPTZ(3),
    "last_error_code" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_attempts" (
    "id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "attempt_no" INTEGER NOT NULL,
    "started_at" TIMESTAMPTZ(3) NOT NULL,
    "finished_at" TIMESTAMPTZ(3),
    "result" "JobAttemptResult" NOT NULL DEFAULT 'RUNNING',
    "error" TEXT,
    "provider_request_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recovery_states" (
    "id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "attempt_no" INTEGER NOT NULL,
    "operation_key" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_request_id" TEXT NOT NULL,
    "ext_resource_id" TEXT,
    "status" "RecoveryStatus" NOT NULL DEFAULT 'UNKNOWN',
    "last_checked_at" TIMESTAMPTZ(3),
    "next_check_at" TIMESTAMPTZ(3),
    "reconciled_at" TIMESTAMPTZ(3),
    "evidence_ref" TEXT,
    "reason_code" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recovery_states_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "student_representative_links_student_id_verification_status_idx" ON "student_representative_links"("student_id", "verification_status");

-- CreateIndex
CREATE INDEX "student_representative_links_representative_id_idx" ON "student_representative_links"("representative_id");

-- CreateIndex
CREATE INDEX "student_representative_links_verified_by_staff_id_idx" ON "student_representative_links"("verified_by_staff_id");

-- CreateIndex
CREATE INDEX "household_memberships_household_id_status_idx" ON "household_memberships"("household_id", "status");

-- CreateIndex
CREATE INDEX "household_memberships_student_id_valid_from_idx" ON "household_memberships"("student_id", "valid_from");

-- CreateIndex
CREATE INDEX "household_memberships_representative_id_idx" ON "household_memberships"("representative_id");

-- CreateIndex
CREATE INDEX "household_memberships_recorded_by_staff_id_idx" ON "household_memberships"("recorded_by_staff_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_student_active_household" ON "household_memberships"("student_id") WHERE (status = 'ACTIVE');

-- CreateIndex
CREATE UNIQUE INDEX "uq_representative_active_household" ON "household_memberships"("household_id", "representative_id") WHERE (status = 'ACTIVE');

-- CreateIndex
CREATE INDEX "relationship_verifications_link_id_verified_at_idx" ON "relationship_verifications"("link_id", "verified_at");

-- CreateIndex
CREATE INDEX "relationship_verifications_verified_by_staff_id_idx" ON "relationship_verifications"("verified_by_staff_id");

-- CreateIndex
CREATE UNIQUE INDEX "auth_accounts_login_id_key" ON "auth_accounts"("login_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_account_id_kind" ON "auth_accounts"("id", "kind");

-- CreateIndex
CREATE INDEX "student_accounts_student_id_activated_at_idx" ON "student_accounts"("student_id", "activated_at");

-- CreateIndex
CREATE INDEX "student_accounts_activation_confirmed_by_staff_id_idx" ON "student_accounts"("activation_confirmed_by_staff_id");

-- CreateIndex
CREATE INDEX "student_accounts_activation_subscription_id_idx" ON "student_accounts"("activation_subscription_id");

-- CreateIndex
CREATE INDEX "student_accounts_activation_payment_confirmation_id_idx" ON "student_accounts"("activation_payment_confirmation_id");

-- CreateIndex
CREATE INDEX "student_accounts_activation_director_admission_id_idx" ON "student_accounts"("activation_director_admission_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_student_auth_profile" ON "student_accounts"("account_id", "account_kind");

-- CreateIndex
CREATE UNIQUE INDEX "uq_student_active_account" ON "student_accounts"("student_id") WHERE (deactivated_at IS NULL);

-- CreateIndex
CREATE UNIQUE INDEX "uq_staff_auth_profile" ON "staff_accounts"("account_id", "account_kind");

-- CreateIndex
CREATE UNIQUE INDEX "uq_teacher_auth_profile" ON "teacher_accounts"("account_id", "account_kind");

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE INDEX "role_assignments_role_id_idx" ON "role_assignments"("role_id");

-- CreateIndex
CREATE INDEX "role_assignments_assigned_by_staff_id_idx" ON "role_assignments"("assigned_by_staff_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_account_current_role" ON "role_assignments"("account_id", "role_id") WHERE (valid_to IS NULL);

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_account_id_expires_at_idx" ON "sessions"("account_id", "expires_at");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_session_id_account" ON "sessions"("id", "account_id");

-- CreateIndex
CREATE UNIQUE INDEX "webauthn_credentials_credential_id_key" ON "webauthn_credentials"("credential_id");

-- CreateIndex
CREATE INDEX "webauthn_credentials_account_id_idx" ON "webauthn_credentials"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "mfa_challenges_challenge_hash_key" ON "mfa_challenges"("challenge_hash");

-- CreateIndex
CREATE INDEX "mfa_challenges_account_id_expires_at_idx" ON "mfa_challenges"("account_id", "expires_at");

-- CreateIndex
CREATE INDEX "mfa_challenges_session_id_account_id_idx" ON "mfa_challenges"("session_id", "account_id");

-- CreateIndex
CREATE INDEX "mfa_challenges_expires_at_idx" ON "mfa_challenges"("expires_at");

-- CreateIndex
CREATE INDEX "access_revocations_account_id_revoked_at_idx" ON "access_revocations"("account_id", "revoked_at");

-- CreateIndex
CREATE INDEX "access_revocations_session_id_account_id_idx" ON "access_revocations"("session_id", "account_id");

-- CreateIndex
CREATE INDEX "access_revocations_revoked_by_account_id_idx" ON "access_revocations"("revoked_by_account_id");

-- CreateIndex
CREATE INDEX "leads_stage_created_at_idx" ON "leads"("stage", "created_at");

-- CreateIndex
CREATE INDEX "leads_phone_idx" ON "leads"("phone");

-- CreateIndex
CREATE INDEX "leads_email_idx" ON "leads"("email");

-- CreateIndex
CREATE INDEX "lead_student_links_student_id_idx" ON "lead_student_links"("student_id");

-- CreateIndex
CREATE INDEX "lead_student_links_checked_by_staff_id_idx" ON "lead_student_links"("checked_by_staff_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_current_lead_student" ON "lead_student_links"("lead_id", "student_id") WHERE (unlinked_at IS NULL);

-- CreateIndex
CREATE INDEX "assigned_managers_manager_id_ended_at_idx" ON "assigned_managers"("manager_id", "ended_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_lead_current_manager" ON "assigned_managers"("lead_id") WHERE (ended_at IS NULL);

-- CreateIndex
CREATE UNIQUE INDEX "uq_student_current_manager" ON "assigned_managers"("student_id") WHERE (ended_at IS NULL);

-- CreateIndex
CREATE INDEX "contact_logs_lead_id_occurred_at_idx" ON "contact_logs"("lead_id", "occurred_at");

-- CreateIndex
CREATE INDEX "contact_logs_student_id_occurred_at_idx" ON "contact_logs"("student_id", "occurred_at");

-- CreateIndex
CREATE INDEX "contact_logs_representative_id_idx" ON "contact_logs"("representative_id");

-- CreateIndex
CREATE INDEX "contact_logs_manager_id_idx" ON "contact_logs"("manager_id");

-- CreateIndex
CREATE UNIQUE INDEX "crm_tasks_idempotency_key_key" ON "crm_tasks"("idempotency_key");

-- CreateIndex
CREATE INDEX "crm_tasks_assigned_manager_id_status_due_at_idx" ON "crm_tasks"("assigned_manager_id", "status", "due_at");

-- CreateIndex
CREATE INDEX "crm_tasks_lead_id_idx" ON "crm_tasks"("lead_id");

-- CreateIndex
CREATE INDEX "crm_tasks_student_id_idx" ON "crm_tasks"("student_id");

-- CreateIndex
CREATE INDEX "crm_tasks_resolved_by_staff_id_idx" ON "crm_tasks"("resolved_by_staff_id");

-- CreateIndex
CREATE INDEX "crm_tasks_source_event_id_idx" ON "crm_tasks"("source_event_id");

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
CREATE UNIQUE INDEX "homework_assignments_source_operation_id_key" ON "homework_assignments"("source_operation_id");

-- CreateIndex
CREATE INDEX "homework_assignments_subject_id_idx" ON "homework_assignments"("subject_id");

-- CreateIndex
CREATE INDEX "homework_assignments_issued_by_idx" ON "homework_assignments"("issued_by");

-- CreateIndex
CREATE INDEX "homework_assignments_lesson_occurrence_id_idx" ON "homework_assignments"("lesson_occurrence_id");

-- CreateIndex
CREATE UNIQUE INDEX "homework_deliveries_source_operation_id_key" ON "homework_deliveries"("source_operation_id");

-- CreateIndex
CREATE INDEX "homework_deliveries_assignment_id_idx" ON "homework_deliveries"("assignment_id");

-- CreateIndex
CREATE INDEX "homework_deliveries_enrollment_id_idx" ON "homework_deliveries"("enrollment_id");

-- CreateIndex
CREATE INDEX "homework_deliveries_issued_by_idx" ON "homework_deliveries"("issued_by");

-- CreateIndex
CREATE UNIQUE INDEX "uq_homework_delivery" ON "homework_deliveries"("assignment_id", "enrollment_id");

-- CreateIndex
CREATE UNIQUE INDEX "homework_submissions_supersedes_submission_id_key" ON "homework_submissions"("supersedes_submission_id");

-- CreateIndex
CREATE UNIQUE INDEX "homework_submissions_source_operation_id_key" ON "homework_submissions"("source_operation_id");

-- CreateIndex
CREATE INDEX "homework_submissions_delivery_id_idx" ON "homework_submissions"("delivery_id");

-- CreateIndex
CREATE INDEX "homework_submissions_student_id_idx" ON "homework_submissions"("student_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_submission_version" ON "homework_submissions"("delivery_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "submission_reviews_source_operation_id_key" ON "submission_reviews"("source_operation_id");

-- CreateIndex
CREATE INDEX "submission_reviews_submission_id_idx" ON "submission_reviews"("submission_id");

-- CreateIndex
CREATE INDEX "submission_reviews_reviewer_id_idx" ON "submission_reviews"("reviewer_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_submission_review_version" ON "submission_reviews"("submission_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "skill_entries_source_operation_id_key" ON "skill_entries"("source_operation_id");

-- CreateIndex
CREATE INDEX "skill_entries_subject_id_idx" ON "skill_entries"("subject_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_subject_skill_code" ON "skill_entries"("subject_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "skill_assessments_supersedes_assessment_id_key" ON "skill_assessments"("supersedes_assessment_id");

-- CreateIndex
CREATE UNIQUE INDEX "skill_assessments_source_operation_id_key" ON "skill_assessments"("source_operation_id");

-- CreateIndex
CREATE INDEX "skill_assessments_skill_id_idx" ON "skill_assessments"("skill_id");

-- CreateIndex
CREATE INDEX "skill_assessments_enrollment_id_idx" ON "skill_assessments"("enrollment_id");

-- CreateIndex
CREATE INDEX "skill_assessments_assessed_by_idx" ON "skill_assessments"("assessed_by");

-- CreateIndex
CREATE INDEX "skill_assessments_lesson_ref_idx" ON "skill_assessments"("lesson_ref");

-- CreateIndex
CREATE UNIQUE INDEX "uq_skill_assessment_version" ON "skill_assessments"("enrollment_id", "skill_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "progress_checkpoints_source_operation_id_key" ON "progress_checkpoints"("source_operation_id");

-- CreateIndex
CREATE INDEX "progress_checkpoints_enrollment_id_idx" ON "progress_checkpoints"("enrollment_id");

-- CreateIndex
CREATE INDEX "progress_checkpoints_lesson_actual_outcome_id_idx" ON "progress_checkpoints"("lesson_actual_outcome_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_enrollment_checkpoint" ON "progress_checkpoints"("enrollment_id", "type", "confirmed_lesson_count");

-- CreateIndex
CREATE UNIQUE INDEX "education_reports_supersedes_report_id_key" ON "education_reports"("supersedes_report_id");

-- CreateIndex
CREATE UNIQUE INDEX "education_reports_source_operation_id_key" ON "education_reports"("source_operation_id");

-- CreateIndex
CREATE INDEX "education_reports_checkpoint_id_idx" ON "education_reports"("checkpoint_id");

-- CreateIndex
CREATE INDEX "education_reports_author_id_idx" ON "education_reports"("author_id");

-- CreateIndex
CREATE INDEX "education_reports_published_by_idx" ON "education_reports"("published_by");

-- CreateIndex
CREATE UNIQUE INDEX "uq_report_version" ON "education_reports"("checkpoint_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "s3_objects_key_key" ON "s3_objects"("key");

-- CreateIndex
CREATE UNIQUE INDEX "s3_objects_source_operation_id_key" ON "s3_objects"("source_operation_id");

-- CreateIndex
CREATE INDEX "s3_objects_uploaded_by_idx" ON "s3_objects"("uploaded_by");

-- CreateIndex
CREATE UNIQUE INDEX "file_permissions_source_operation_id_key" ON "file_permissions"("source_operation_id");

-- CreateIndex
CREATE INDEX "file_permissions_s3_object_id_idx" ON "file_permissions"("s3_object_id");

-- CreateIndex
CREATE INDEX "file_permissions_granted_by_idx" ON "file_permissions"("granted_by");

-- CreateIndex
CREATE INDEX "file_permissions_revoked_by_idx" ON "file_permissions"("revoked_by");

-- CreateIndex
CREATE INDEX "file_permissions_expires_at_idx" ON "file_permissions"("expires_at");

-- CreateIndex
CREATE INDEX "file_permissions_subject_id_subject_type_idx" ON "file_permissions"("subject_id", "subject_type");

-- CreateIndex
CREATE UNIQUE INDEX "uq_active_file_permission" ON "file_permissions"("s3_object_id", "subject_id", "subject_type") WHERE (revoked_at IS NULL);

-- CreateIndex
CREATE UNIQUE INDEX "file_audit_logs_event_key_key" ON "file_audit_logs"("event_key");

-- CreateIndex
CREATE INDEX "file_audit_logs_s3_object_id_idx" ON "file_audit_logs"("s3_object_id");

-- CreateIndex
CREATE INDEX "file_audit_logs_permission_id_idx" ON "file_audit_logs"("permission_id");

-- CreateIndex
CREATE INDEX "file_audit_logs_actor_id_idx" ON "file_audit_logs"("actor_id");

-- CreateIndex
CREATE UNIQUE INDEX "audit_events_event_key_key" ON "audit_events"("event_key");

-- CreateIndex
CREATE INDEX "audit_events_actor_id_idx" ON "audit_events"("actor_id");

-- CreateIndex
CREATE INDEX "audit_events_request_id_idx" ON "audit_events"("request_id");

-- CreateIndex
CREATE INDEX "audit_events_source_operation_id_idx" ON "audit_events"("source_operation_id");

-- CreateIndex
CREATE INDEX "audit_events_resource_type_resource_id_recorded_at_idx" ON "audit_events"("resource_type", "resource_id", "recorded_at");

-- CreateIndex
CREATE INDEX "idempotency_records_expires_at_idx" ON "idempotency_records"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_idempotency_scope_command_key" ON "idempotency_records"("scope", "command_type", "key");

-- CreateIndex
CREATE UNIQUE INDEX "outbox_events_event_key_key" ON "outbox_events"("event_key");

-- CreateIndex
CREATE INDEX "outbox_events_audit_event_id_idx" ON "outbox_events"("audit_event_id");

-- CreateIndex
CREATE INDEX "outbox_events_published_at_next_attempt_at_idx" ON "outbox_events"("published_at", "next_attempt_at");

-- CreateIndex
CREATE INDEX "outbox_events_source_operation_id_idx" ON "outbox_events"("source_operation_id");

-- CreateIndex
CREATE UNIQUE INDEX "job_records_deduplication_key_key" ON "job_records"("deduplication_key");

-- CreateIndex
CREATE INDEX "job_records_source_outbox_event_id_idx" ON "job_records"("source_outbox_event_id");

-- CreateIndex
CREATE INDEX "job_records_status_next_run_at_idx" ON "job_records"("status", "next_run_at");

-- CreateIndex
CREATE INDEX "job_records_source_operation_id_idx" ON "job_records"("source_operation_id");

-- CreateIndex
CREATE INDEX "job_attempts_job_id_idx" ON "job_attempts"("job_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_job_attempt_number" ON "job_attempts"("job_id", "attempt_no");

-- CreateIndex
CREATE UNIQUE INDEX "recovery_states_operation_key_key" ON "recovery_states"("operation_key");

-- CreateIndex
CREATE INDEX "recovery_states_provider_provider_request_id_idx" ON "recovery_states"("provider", "provider_request_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_recovery_job_attempt" ON "recovery_states"("job_id", "attempt_no");

-- AddForeignKey
ALTER TABLE "student_representative_links" ADD CONSTRAINT "fk_relation_student" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "student_representative_links" ADD CONSTRAINT "fk_relation_representative" FOREIGN KEY ("representative_id") REFERENCES "representatives"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "student_representative_links" ADD CONSTRAINT "fk_relation_verifier" FOREIGN KEY ("verified_by_staff_id") REFERENCES "staff_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "household_memberships" ADD CONSTRAINT "fk_membership_household" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "household_memberships" ADD CONSTRAINT "fk_membership_student" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "household_memberships" ADD CONSTRAINT "fk_membership_representative" FOREIGN KEY ("representative_id") REFERENCES "representatives"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "household_memberships" ADD CONSTRAINT "fk_membership_recorder" FOREIGN KEY ("recorded_by_staff_id") REFERENCES "staff_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "relationship_verifications" ADD CONSTRAINT "fk_verification_link" FOREIGN KEY ("link_id") REFERENCES "student_representative_links"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "relationship_verifications" ADD CONSTRAINT "fk_verification_staff" FOREIGN KEY ("verified_by_staff_id") REFERENCES "staff_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "student_accounts" ADD CONSTRAINT "fk_student_account_student" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "student_accounts" ADD CONSTRAINT "fk_student_account_auth" FOREIGN KEY ("account_id", "account_kind") REFERENCES "auth_accounts"("id", "kind") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "student_accounts" ADD CONSTRAINT "fk_student_activation_staff" FOREIGN KEY ("activation_confirmed_by_staff_id") REFERENCES "staff_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "student_accounts" ADD CONSTRAINT "fk_t03_activation_subscription" FOREIGN KEY ("activation_subscription_id") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "student_accounts" ADD CONSTRAINT "fk_t03_activation_payment" FOREIGN KEY ("activation_payment_confirmation_id") REFERENCES "payment_receipts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "student_accounts" ADD CONSTRAINT "fk_t03_activation_director" FOREIGN KEY ("activation_director_admission_id") REFERENCES "temporary_access_permissions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "staff_accounts" ADD CONSTRAINT "fk_staff_account_auth" FOREIGN KEY ("account_id", "account_kind") REFERENCES "auth_accounts"("id", "kind") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "teacher_accounts" ADD CONSTRAINT "fk_teacher_account_auth" FOREIGN KEY ("account_id", "account_kind") REFERENCES "auth_accounts"("id", "kind") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "role_assignments" ADD CONSTRAINT "fk_role_assignment_account" FOREIGN KEY ("account_id") REFERENCES "auth_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "role_assignments" ADD CONSTRAINT "fk_role_assignment_role" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "role_assignments" ADD CONSTRAINT "fk_role_assignment_staff" FOREIGN KEY ("assigned_by_staff_id") REFERENCES "staff_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "fk_session_account" FOREIGN KEY ("account_id") REFERENCES "auth_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "webauthn_credentials" ADD CONSTRAINT "fk_credential_account" FOREIGN KEY ("account_id") REFERENCES "auth_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "mfa_challenges" ADD CONSTRAINT "fk_challenge_account" FOREIGN KEY ("account_id") REFERENCES "auth_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "mfa_challenges" ADD CONSTRAINT "fk_challenge_session_owner" FOREIGN KEY ("session_id", "account_id") REFERENCES "sessions"("id", "account_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "access_revocations" ADD CONSTRAINT "fk_revocation_account" FOREIGN KEY ("account_id") REFERENCES "auth_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "access_revocations" ADD CONSTRAINT "fk_revocation_session_owner" FOREIGN KEY ("session_id", "account_id") REFERENCES "sessions"("id", "account_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "access_revocations" ADD CONSTRAINT "fk_revocation_actor" FOREIGN KEY ("revoked_by_account_id") REFERENCES "auth_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "lead_student_links" ADD CONSTRAINT "fk_lead_link_lead" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "lead_student_links" ADD CONSTRAINT "fk_lead_link_student" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "lead_student_links" ADD CONSTRAINT "fk_lead_link_staff" FOREIGN KEY ("checked_by_staff_id") REFERENCES "staff_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "assigned_managers" ADD CONSTRAINT "fk_manager_staff" FOREIGN KEY ("manager_id") REFERENCES "staff_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "assigned_managers" ADD CONSTRAINT "fk_manager_lead" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "assigned_managers" ADD CONSTRAINT "fk_manager_student" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "contact_logs" ADD CONSTRAINT "fk_contact_lead" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "contact_logs" ADD CONSTRAINT "fk_contact_student" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "contact_logs" ADD CONSTRAINT "fk_contact_representative" FOREIGN KEY ("representative_id") REFERENCES "representatives"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "contact_logs" ADD CONSTRAINT "fk_contact_staff" FOREIGN KEY ("manager_id") REFERENCES "staff_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "crm_tasks" ADD CONSTRAINT "fk_task_lead" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "crm_tasks" ADD CONSTRAINT "fk_task_student" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "crm_tasks" ADD CONSTRAINT "fk_task_assigned_staff" FOREIGN KEY ("assigned_manager_id") REFERENCES "staff_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "crm_tasks" ADD CONSTRAINT "fk_task_resolved_staff" FOREIGN KEY ("resolved_by_staff_id") REFERENCES "staff_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "crm_tasks" ADD CONSTRAINT "fk_t04_crm_source_event" FOREIGN KEY ("source_event_id") REFERENCES "outbox_events"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

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

-- AddForeignKey
ALTER TABLE "homework_assignments" ADD CONSTRAINT "fk_t04_homework_assignment_subject" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "homework_assignments" ADD CONSTRAINT "fk_t04_homework_assignment_issued_by" FOREIGN KEY ("issued_by") REFERENCES "teacher_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "homework_assignments" ADD CONSTRAINT "fk_t04_homework_assignment_lesson_occurrence" FOREIGN KEY ("lesson_occurrence_id") REFERENCES "lesson_occurrences"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "homework_deliveries" ADD CONSTRAINT "fk_t04_homework_delivery_assignment" FOREIGN KEY ("assignment_id") REFERENCES "homework_assignments"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "homework_deliveries" ADD CONSTRAINT "fk_t04_homework_delivery_enrollment" FOREIGN KEY ("enrollment_id") REFERENCES "student_subject_enrollments"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "homework_deliveries" ADD CONSTRAINT "fk_t04_homework_delivery_issued_by" FOREIGN KEY ("issued_by") REFERENCES "teacher_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "homework_submissions" ADD CONSTRAINT "fk_t04_homework_submission_delivery" FOREIGN KEY ("delivery_id") REFERENCES "homework_deliveries"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "homework_submissions" ADD CONSTRAINT "fk_t04_homework_submission_student" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "homework_submissions" ADD CONSTRAINT "fk_t04_homework_submission_supersedes_submission" FOREIGN KEY ("supersedes_submission_id") REFERENCES "homework_submissions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "submission_reviews" ADD CONSTRAINT "fk_t04_submission_review_submission" FOREIGN KEY ("submission_id") REFERENCES "homework_submissions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "submission_reviews" ADD CONSTRAINT "fk_t04_submission_review_reviewer" FOREIGN KEY ("reviewer_id") REFERENCES "teacher_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "skill_entries" ADD CONSTRAINT "fk_t04_skill_entry_subject" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "skill_assessments" ADD CONSTRAINT "fk_t04_skill_assessment_skill" FOREIGN KEY ("skill_id") REFERENCES "skill_entries"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "skill_assessments" ADD CONSTRAINT "fk_t04_skill_assessment_enrollment" FOREIGN KEY ("enrollment_id") REFERENCES "student_subject_enrollments"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "skill_assessments" ADD CONSTRAINT "fk_t04_skill_assessment_assessed_by" FOREIGN KEY ("assessed_by") REFERENCES "teacher_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "skill_assessments" ADD CONSTRAINT "fk_t04_skill_assessment_lesson_ref" FOREIGN KEY ("lesson_ref") REFERENCES "lesson_occurrences"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "skill_assessments" ADD CONSTRAINT "fk_t04_skill_assessment_supersedes_assessment" FOREIGN KEY ("supersedes_assessment_id") REFERENCES "skill_assessments"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "progress_checkpoints" ADD CONSTRAINT "fk_t04_progress_checkpoint_enrollment" FOREIGN KEY ("enrollment_id") REFERENCES "student_subject_enrollments"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "progress_checkpoints" ADD CONSTRAINT "fk_t04_progress_checkpoint_lesson_actual_outcome" FOREIGN KEY ("lesson_actual_outcome_id") REFERENCES "lesson_actual_outcomes"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "education_reports" ADD CONSTRAINT "fk_t04_education_report_checkpoint" FOREIGN KEY ("checkpoint_id") REFERENCES "progress_checkpoints"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "education_reports" ADD CONSTRAINT "fk_t04_education_report_author" FOREIGN KEY ("author_id") REFERENCES "teacher_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "education_reports" ADD CONSTRAINT "fk_t04_education_report_published_by" FOREIGN KEY ("published_by") REFERENCES "teacher_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "education_reports" ADD CONSTRAINT "fk_t04_education_report_supersedes_report" FOREIGN KEY ("supersedes_report_id") REFERENCES "education_reports"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "s3_objects" ADD CONSTRAINT "fk_t04_s3_object_uploaded_by" FOREIGN KEY ("uploaded_by") REFERENCES "auth_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "file_permissions" ADD CONSTRAINT "fk_t04_file_permission_s3_object" FOREIGN KEY ("s3_object_id") REFERENCES "s3_objects"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "file_permissions" ADD CONSTRAINT "fk_t04_file_permission_granted_by" FOREIGN KEY ("granted_by") REFERENCES "auth_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "file_permissions" ADD CONSTRAINT "fk_t04_file_permission_revoked_by" FOREIGN KEY ("revoked_by") REFERENCES "auth_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "file_permissions" ADD CONSTRAINT "fk_t04_permission_subject" FOREIGN KEY ("subject_id", "subject_type") REFERENCES "auth_accounts"("id", "kind") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "file_audit_logs" ADD CONSTRAINT "fk_t04_file_audit_log_s3_object" FOREIGN KEY ("s3_object_id") REFERENCES "s3_objects"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "file_audit_logs" ADD CONSTRAINT "fk_t04_file_audit_log_permission" FOREIGN KEY ("permission_id") REFERENCES "file_permissions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "file_audit_logs" ADD CONSTRAINT "fk_t04_file_audit_log_actor" FOREIGN KEY ("actor_id") REFERENCES "auth_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "fk_t04_audit_event_actor" FOREIGN KEY ("actor_id") REFERENCES "auth_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "outbox_events" ADD CONSTRAINT "fk_t04_outbox_event_audit_event" FOREIGN KEY ("audit_event_id") REFERENCES "audit_events"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "job_records" ADD CONSTRAINT "fk_t04_job_record_source_outbox_event" FOREIGN KEY ("source_outbox_event_id") REFERENCES "outbox_events"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "job_attempts" ADD CONSTRAINT "fk_t04_job_attempt_job" FOREIGN KEY ("job_id") REFERENCES "job_records"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "recovery_states" ADD CONSTRAINT "fk_t04_recovery_state_job" FOREIGN KEY ("job_id") REFERENCES "job_records"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Preserved SQL from 20261025210500_task02_identity_access_crm_invariants
-- SQL-only invariants are part of the reviewed migration history.
-- Prisma partialIndexes represents the partial UNIQUE indexes in the first migration.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "household_memberships"
  ADD CONSTRAINT "ck_membership_one_person"
    CHECK (num_nonnulls(student_id, representative_id) = 1),
  ADD CONSTRAINT "ck_membership_period"
    CHECK (valid_to IS NULL OR valid_to > valid_from),
  ADD CONSTRAINT "ck_membership_status_period"
    CHECK ((status = 'ACTIVE' AND valid_to IS NULL)
       OR (status = 'ENDED' AND valid_to IS NOT NULL)
       OR status = 'CANCELLED'),
  ADD CONSTRAINT "ex_student_household_period"
    EXCLUDE USING gist (
      student_id WITH =,
      tstzrange(valid_from, valid_to, '[)') WITH &&
    ) WHERE (student_id IS NOT NULL AND status IN ('ACTIVE', 'ENDED'));

ALTER TABLE "student_representative_links"
  ADD CONSTRAINT "ck_relation_period"
    CHECK (valid_to IS NULL OR valid_to > valid_from),
  ADD CONSTRAINT "ck_relation_verification"
    CHECK (verification_status <> 'VERIFIED'
      OR (verified_at IS NOT NULL AND verified_by_staff_id IS NOT NULL)),
  ADD CONSTRAINT "ck_relation_basis" CHECK (length(trim(basis)) > 0);

ALTER TABLE "relationship_verifications"
  ADD CONSTRAINT "ck_verification_result" CHECK (result <> 'PENDING'),
  ADD CONSTRAINT "ck_verification_basis" CHECK (length(trim(basis)) > 0);

ALTER TABLE "auth_accounts"
  ADD CONSTRAINT "ck_account_login" CHECK (length(trim(login_id)) > 0);

ALTER TABLE "student_accounts"
  ADD CONSTRAINT "ck_student_account_kind" CHECK (account_kind = 'STUDENT'),
  ADD CONSTRAINT "ck_student_account_period"
    CHECK (deactivated_at IS NULL OR deactivated_at >= activated_at),
  -- CON-02/B: every incomplete payment needs its own limited director decision.
  -- Finance FK and actual paid-total verification are deferred to TASK-03/05.
  ADD CONSTRAINT "ck_student_activation_admission"
    CHECK ((activation_basis = 'FULL_PAYMENT' AND activation_director_admission_id IS NULL)
       OR (activation_basis = 'LIMITED_DIRECTOR_ADMISSION' AND activation_director_admission_id IS NOT NULL));

ALTER TABLE "staff_accounts"
  ADD CONSTRAINT "ck_staff_account_kind" CHECK (account_kind = 'STAFF');

ALTER TABLE "teacher_accounts"
  ADD CONSTRAINT "ck_teacher_account_kind" CHECK (account_kind = 'TEACHER');

ALTER TABLE "role_assignments"
  ADD CONSTRAINT "ck_role_assignment_period"
    CHECK (valid_to IS NULL OR valid_to > valid_from),
  ADD CONSTRAINT "ex_account_role_period"
    EXCLUDE USING gist (
      account_id WITH =,
      role_id WITH =,
      tstzrange(valid_from, valid_to, '[)') WITH &&
    );

-- Prevent a student/teacher principal from being assigned a staff role by mistake.
-- This is structural integrity, not a substitute for the future grant/revoke ACL.
CREATE FUNCTION check_role_account_kind() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  principal_kind "AccountKind";
  assigned_role "RoleCode";
BEGIN
  SELECT kind INTO principal_kind FROM auth_accounts WHERE id = NEW.account_id;
  SELECT code INTO assigned_role FROM roles WHERE id = NEW.role_id;
  IF (principal_kind = 'STUDENT' AND assigned_role <> 'STUDENT')
     OR (principal_kind = 'TEACHER' AND assigned_role <> 'TEACHER')
     OR (principal_kind = 'STAFF' AND assigned_role NOT IN ('DIRECTOR', 'MANAGER', 'TECH_OPERATOR')) THEN
    RAISE EXCEPTION 'Role is incompatible with account kind'
      USING ERRCODE = '23514', CONSTRAINT = 'ck_role_account_kind';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_role_account_kind
  BEFORE INSERT OR UPDATE ON role_assignments
  FOR EACH ROW EXECUTE FUNCTION check_role_account_kind();

-- A role code is a stable identity. Renaming would change every historical grant.
CREATE FUNCTION protect_role_code() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.code IS DISTINCT FROM OLD.code THEN
    RAISE EXCEPTION 'Role code is immutable'
      USING ERRCODE = '23514', CONSTRAINT = 'ck_role_code_immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_role_code_immutable
  BEFORE UPDATE OF code ON roles
  FOR EACH ROW EXECUTE FUNCTION protect_role_code();

CREATE FUNCTION protect_account_kind() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.kind IS DISTINCT FROM OLD.kind THEN
    RAISE EXCEPTION 'Account kind is immutable'
      USING ERRCODE = '23514', CONSTRAINT = 'ck_account_kind_immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_account_kind_immutable
  BEFORE UPDATE OF kind ON auth_accounts
  FOR EACH ROW EXECUTE FUNCTION protect_account_kind();

-- The finance confirmation itself must become an FK in TASK-03/05.
-- For now, at least the recorded confirming actor must be a director at activation time.
CREATE FUNCTION check_student_activation_director() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM staff_accounts staff
    JOIN auth_accounts account ON account.id = staff.account_id
    JOIN role_assignments assignment ON assignment.account_id = account.id
    JOIN roles role ON role.id = assignment.role_id
    WHERE staff.id = NEW.activation_confirmed_by_staff_id
      AND role.code = 'DIRECTOR'
      AND assignment.valid_from <= NEW.activated_at
      AND (assignment.valid_to IS NULL OR assignment.valid_to > NEW.activated_at)
      AND (staff.deactivated_at IS NULL OR staff.deactivated_at > NEW.activated_at)
      AND (account.disabled_at IS NULL OR account.disabled_at > NEW.activated_at)
  ) THEN
    RAISE EXCEPTION 'Student activation requires a director confirmation'
      USING ERRCODE = '23514', CONSTRAINT = 'ck_student_activation_director';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_student_activation_director
  BEFORE INSERT OR UPDATE OF activation_confirmed_by_staff_id, activated_at ON student_accounts
  FOR EACH ROW EXECUTE FUNCTION check_student_activation_director();

ALTER TABLE "sessions"
  ADD CONSTRAINT "ck_session_expiry" CHECK (expires_at > created_at),
  ADD CONSTRAINT "ck_session_token_hash" CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "ck_session_csrf_hash"
    CHECK (csrf_token_hash IS NULL OR csrf_token_hash ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "ck_session_revocation"
    CHECK (revoked_at IS NULL OR revoked_at >= created_at),
  ADD CONSTRAINT "ck_session_mfa_time"
    CHECK (mfa_verified_at IS NULL OR (mfa_verified_at >= created_at AND mfa_verified_at < expires_at));

ALTER TABLE "mfa_challenges"
  ADD CONSTRAINT "ck_challenge_expiry" CHECK (expires_at > created_at),
  ADD CONSTRAINT "ck_challenge_hash" CHECK (challenge_hash ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "ck_challenge_used_time"
    CHECK (used_at IS NULL OR (used_at >= created_at AND used_at < expires_at));

ALTER TABLE "webauthn_credentials"
  ADD CONSTRAINT "ck_credential_sign_count" CHECK (sign_count BETWEEN 0 AND 4294967295),
  ADD CONSTRAINT "ck_credential_id" CHECK (octet_length(credential_id) > 0),
  ADD CONSTRAINT "ck_credential_public_key" CHECK (octet_length(public_key) > 0),
  ADD CONSTRAINT "ck_credential_backup" CHECK (NOT backed_up OR backup_eligible);

ALTER TABLE "access_revocations"
  ADD CONSTRAINT "ck_revocation_reason" CHECK (length(trim(reason)) > 0),
  ADD CONSTRAINT "ck_revocation_source" CHECK (length(trim(source)) > 0);

ALTER TABLE "lead_student_links"
  ADD CONSTRAINT "ck_lead_link_period"
    CHECK (unlinked_at IS NULL OR unlinked_at >= linked_at),
  ADD CONSTRAINT "ck_lead_link_basis" CHECK (length(trim(basis)) > 0);

ALTER TABLE "assigned_managers"
  ADD CONSTRAINT "ck_manager_one_target" CHECK (num_nonnulls(lead_id, student_id) = 1),
  ADD CONSTRAINT "ck_manager_period" CHECK (ended_at IS NULL OR ended_at > assigned_at);

ALTER TABLE "contact_logs"
  ADD CONSTRAINT "ck_contact_target" CHECK (num_nonnulls(lead_id, student_id) >= 1);

ALTER TABLE "crm_tasks"
  ADD CONSTRAINT "ck_task_target" CHECK (num_nonnulls(lead_id, student_id) >= 1),
  ADD CONSTRAINT "ck_task_resolution"
    CHECK ((status = 'RESOLVED' AND resolved_at IS NOT NULL AND resolved_by_staff_id IS NOT NULL)
       OR (status <> 'RESOLVED' AND resolved_at IS NULL AND resolved_by_staff_id IS NULL));

-- Reference roles are seeded explicitly via prisma db seed.

-- Preserved SQL from 20261026010100_task03_financial_invariants
-- Cross-table rules require triggers; a PostgreSQL CHECK cannot read another table.
ALTER TABLE student_subject_enrollments ADD CONSTRAINT ck_enrollment_period CHECK (valid_to IS NULL OR valid_to > valid_from);
ALTER TABLE teaching_assignments ADD CONSTRAINT ck_teaching_period CHECK (valid_to IS NULL OR valid_to > valid_from);
ALTER TABLE teacher_availabilities ADD CONSTRAINT ck_availability_period CHECK (ends_at > starts_at);
ALTER TABLE recurring_slots ADD CONSTRAINT ck_slot_period CHECK ((active_until IS NULL OR active_until > active_from) AND duration_min > 0);
ALTER TABLE lesson_occurrences
  ADD CONSTRAINT ck_lesson_status CHECK (status IN ('SCHEDULED','STAR_PENDING','CONDUCTED','CANCELLED','DISPUTED')),
  ADD CONSTRAINT ck_lesson_time CHECK (scheduled_end_at > scheduled_at AND version > 0),
  ADD CONSTRAINT ck_lesson_start_snapshot CHECK (num_nonnulls(actual_start_at,actual_teacher_at_start_id,rate_at_start_snapshot,points_at_start_snapshot,rate_basis_at_start,rate_currency_at_start) IN (0,6)),
  ADD CONSTRAINT ck_lesson_start_rate CHECK (actual_start_at IS NULL OR (rate_at_start_snapshot>=0 AND points_at_start_snapshot BETWEEN 0 AND 10 AND rate_currency_at_start ~ '^[A-Z]{3}$'
    AND (rate_basis_at_start<>'ORDINARY_POINTS' OR (rate_currency_at_start='MDL' AND rate_at_start_snapshot=CASE WHEN points_at_start_snapshot<5 THEN 200 WHEN points_at_start_snapshot<10 THEN 220 ELSE 250 END))));
ALTER TABLE lesson_actual_outcomes
  ADD CONSTRAINT ck_outcome_duration CHECK (duration_min > 0 AND confirmed_at >= actual_started_at),
  ADD CONSTRAINT ck_outcome_points CHECK (points_snapshot BETWEEN 0 AND 10 AND rate_snapshot >= 0),
  ADD CONSTRAINT ck_outcome_ordinary_rate CHECK (rate_basis <> 'ORDINARY_POINTS' OR
    (currency = 'MDL' AND rate_snapshot = CASE WHEN points_snapshot < 5 THEN 200 WHEN points_snapshot < 10 THEN 220 ELSE 250 END));
ALTER TABLE sale_conditions
  ADD CONSTRAINT ck_sale_amounts CHECK (lesson_count > 0 AND list_price >= 0 AND discount_amount >= 0 AND price > 0 AND lesson_unit_price > 0 AND list_price - discount_amount = price),
  ADD CONSTRAINT ck_sale_period CHECK (valid_to IS NULL OR valid_to > valid_from);
ALTER TABLE subscriptions
  ADD CONSTRAINT ck_subscription_amounts CHECK (lesson_count > 0 AND full_price > 0 AND initial_discount_amount >= 0 AND original_paid_unit_price > 0),
  ADD CONSTRAINT ck_subscription_period CHECK (valid_to IS NULL OR valid_to > valid_from),
  ADD CONSTRAINT ck_subscription_freeze CHECK (num_nonnulls(frozen_from, frozen_until) = 0 OR (frozen_from IS NOT NULL AND frozen_until > frozen_from));
ALTER TABLE payment_receipts
  ADD CONSTRAINT ck_payment_amount CHECK (amount > 0),
  ADD CONSTRAINT ck_payment_confirmation CHECK (num_nonnulls(confirmed_by_director_id, confirmed_by_director_at, confirmation_operation_id) IN (0,3)),
  ADD CONSTRAINT ck_payment_provider CHECK (num_nonnulls(provider, external_reference) IN (0,2));
ALTER TABLE payment_distributions
  ADD CONSTRAINT ck_distribution_amount CHECK (amount > 0),
  ADD CONSTRAINT ck_distribution_approval CHECK (num_nonnulls(approved_by_director_id, approved_at, approval_operation_id) IN (0,3));
ALTER TABLE temporary_access_permissions
  ADD CONSTRAINT ck_permission_limits CHECK (valid_to > valid_from AND max_lessons > 0 AND approved_at <= valid_from AND length(trim(reason)) > 0);
ALTER TABLE entitlement_grants ADD CONSTRAINT ck_grant_quantity CHECK (quantity > 0);
ALTER TABLE entitlement_consumptions
  ADD CONSTRAINT ck_consumption_quantity CHECK (quantity > 0 AND length(trim(reason)) > 0),
  ADD CONSTRAINT ck_consumption_cancel CHECK (num_nonnulls(cancelled_at, cancellation_adjustment_id) IN (0,2));
ALTER TABLE entitlement_adjustments ADD CONSTRAINT ck_adjustment_basis CHECK (
  length(trim(reason)) > 0 AND ((kind = 'GRANT_DELTA' AND delta_quantity <> 0)
   OR (kind = 'CONSUMPTION_CANCELLATION' AND delta_quantity = 0 AND original_consumption_id IS NOT NULL)));
ALTER TABLE financial_periods
  ADD CONSTRAINT ck_financial_period_range CHECK (ends_at > starts_at),
  ADD CONSTRAINT ck_financial_period_close CHECK (num_nonnulls(closed_at, closed_by_id, closure_operation_id) IN (0,3)),
  ADD CONSTRAINT ex_financial_period_overlap EXCLUDE USING gist (tstzrange(starts_at, ends_at, '[)') WITH &&);
ALTER TABLE refund_records
  ADD CONSTRAINT ck_refund_amounts CHECK (calculated_amount >= 0 AND original_paid_unit_price > 0 AND paid_unused_quantity >= 0 AND (approved_amount IS NULL OR approved_amount >= 0)),
  ADD CONSTRAINT ck_refund_approval CHECK (num_nonnulls(approved_amount, approved_by_director_id, approved_by_director_at, approval_operation_id) IN (0,4)),
  ADD CONSTRAINT ck_refund_execution CHECK (num_nonnulls(executed_amount, executed_at, execution_reference) = 0 OR
    (num_nonnulls(executed_amount, executed_at, execution_reference) = 3 AND approved_by_director_at IS NOT NULL AND executed_at >= approved_by_director_at AND executed_amount > 0 AND executed_amount <= approved_amount));
ALTER TABLE teacher_accruals
  ADD CONSTRAINT ck_accrual_amounts CHECK (amount >= 0 AND rate_snapshot >= 0 AND points_snapshot BETWEEN 0 AND 10 AND length(trim(basis)) > 0);
ALTER TABLE payroll_obligations ADD CONSTRAINT ck_obligation_amount CHECK (amount >= 0);
ALTER TABLE payout_attempts ADD CONSTRAINT ck_attempt_amount CHECK (amount > 0);
ALTER TABLE confirmed_payouts ADD CONSTRAINT ck_payout_amount CHECK (amount > 0);
ALTER TABLE ledger_documents ADD CONSTRAINT ck_ledger_document_source CHECK (
  num_nonnulls(payment_id, refund_id, accrual_id, payout_id, correction_of_document_id) = 1 AND length(trim(basis)) > 0);
ALTER TABLE ledger_entries ADD CONSTRAINT ck_ledger_publication CHECK (
  num_nonnulls(published_at, published_by_id, publication_operation_id, balanced_at, balance_snapshot) = 0 OR
  (num_nonnulls(published_at, published_by_id, publication_operation_id, balanced_at, balance_snapshot) = 5 AND balanced_at <= published_at));
ALTER TABLE ledger_lines ADD CONSTRAINT ck_ledger_line_amount CHECK (amount > 0 AND position > 0);

-- Every monetary currency is explicit. No floating point columns are introduced.
DO $$ DECLARE table_name text; BEGIN
  FOREACH table_name IN ARRAY ARRAY['lesson_actual_outcomes','sale_conditions','subscriptions','payment_receipts',
    'payment_distributions','refund_records','teacher_accruals','payroll_obligations','payout_attempts',
    'confirmed_payouts','ledger_entries','ledger_lines'] LOOP
    EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I CHECK (currency ~ ''^[A-Z]{3}$'')', table_name, 'ck_' || table_name || '_currency');
  END LOOP;
END $$;

CREATE FUNCTION t03_assert_director(staff_id uuid, at_time timestamptz) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM staff_accounts s JOIN auth_accounts a ON a.id=s.account_id
    JOIN role_assignments ra ON ra.account_id=a.id JOIN roles r ON r.id=ra.role_id
    WHERE s.id=staff_id AND r.code='DIRECTOR' AND ra.valid_from<=at_time AND (ra.valid_to IS NULL OR ra.valid_to>at_time)
    AND (s.deactivated_at IS NULL OR s.deactivated_at>at_time) AND (a.disabled_at IS NULL OR a.disabled_at>at_time)) THEN
    RAISE EXCEPTION 'Director decision required' USING ERRCODE='23514', CONSTRAINT='ck_finance_director';
  END IF;
END $$;

CREATE FUNCTION t03_paid_at(sub_id uuid, at_time timestamptz) RETURNS numeric LANGUAGE sql STABLE AS $$
  SELECT coalesce(sum(d.amount),0) FROM payment_distributions d JOIN payment_receipts p ON p.id=d.payment_id
  WHERE d.subscription_id=sub_id AND d.approved_at<=at_time AND p.confirmed_by_director_at<=at_time
$$;

-- Locking an existing nonoverlapping period serializes consumption/publication with closure.
CREATE FUNCTION t03_require_open_period(at_time timestamptz, expected_id uuid DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE period financial_periods;
BEGIN
  SELECT * INTO period FROM financial_periods WHERE starts_at<=at_time AND ends_at>at_time FOR UPDATE;
  IF period.id IS NULL OR period.closed_at IS NOT NULL OR (expected_id IS NOT NULL AND period.id<>expected_id) THEN
    RAISE EXCEPTION 'An open matching financial period is required' USING ERRCODE='23514', CONSTRAINT='ck_open_financial_period';
  END IF;
  RETURN period.id;
END $$;

CREATE FUNCTION t03_immutable_record() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Historical record is immutable; create a linked correction' USING ERRCODE='23514', CONSTRAINT='ck_financial_history_immutable';
END $$;

CREATE FUNCTION t03_guard_payment() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='UPDATE' AND OLD.confirmed_by_director_at IS NOT NULL THEN
    RAISE EXCEPTION 'Confirmed payment is immutable' USING ERRCODE='23514', CONSTRAINT='ck_confirmed_payment_immutable';
  END IF;
  IF NEW.confirmed_by_director_at IS NOT NULL THEN
    PERFORM t03_assert_director(NEW.confirmed_by_director_id,NEW.confirmed_by_director_at);
    IF NEW.confirmed_by_director_at<NEW.registered_at THEN RAISE EXCEPTION 'Invalid confirmation time' USING ERRCODE='23514'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_t03_payment BEFORE INSERT OR UPDATE ON payment_receipts FOR EACH ROW EXECUTE FUNCTION t03_guard_payment();

CREATE FUNCTION t03_guard_distribution() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE receipt payment_receipts; sub subscriptions; allocated numeric;
BEGIN
  IF TG_OP='UPDATE' AND OLD.approved_at IS NOT NULL THEN RAISE EXCEPTION 'Approved distribution is immutable' USING ERRCODE='23514'; END IF;
  SELECT * INTO receipt FROM payment_receipts WHERE id=NEW.payment_id FOR UPDATE;
  SELECT * INTO sub FROM subscriptions WHERE id=NEW.subscription_id FOR UPDATE;
  IF receipt.currency<>NEW.currency OR sub.currency<>NEW.currency THEN RAISE EXCEPTION 'Currency mismatch' USING ERRCODE='23514', CONSTRAINT='ck_distribution_currency'; END IF;
  IF NEW.approved_at IS NOT NULL THEN
    PERFORM t03_assert_director(NEW.approved_by_director_id,NEW.approved_at);
    IF receipt.confirmed_by_director_at IS NULL OR receipt.confirmed_by_director_at>NEW.approved_at THEN
      RAISE EXCEPTION 'Unconfirmed payment cannot be allocated' USING ERRCODE='23514', CONSTRAINT='ck_distribution_confirmed_payment';
    END IF;
    SELECT coalesce(sum(amount),0) INTO allocated FROM payment_distributions WHERE payment_id=NEW.payment_id AND approved_at IS NOT NULL AND id<>NEW.id;
    IF allocated+NEW.amount>receipt.amount THEN RAISE EXCEPTION 'Payment over-allocation' USING ERRCODE='23514', CONSTRAINT='ck_distribution_total'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_t03_distribution BEFORE INSERT OR UPDATE ON payment_distributions FOR EACH ROW EXECUTE FUNCTION t03_guard_distribution();

CREATE FUNCTION t03_guard_subscription_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(NEW)-'valid_to'-'frozen_from'-'frozen_until'-'updated_at') IS DISTINCT FROM
     (to_jsonb(OLD)-'valid_to'-'frozen_from'-'frozen_until'-'updated_at') THEN
    RAISE EXCEPTION 'Initial sale snapshot is immutable' USING ERRCODE='23514', CONSTRAINT='ck_subscription_snapshot';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_t03_subscription_snapshot BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION t03_guard_subscription_snapshot();

CREATE FUNCTION t03_guard_permission() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE sub subscriptions;
BEGIN
  IF TG_OP='UPDATE' THEN
    IF (to_jsonb(NEW)-'revoked_at'-'updated_at') IS DISTINCT FROM (to_jsonb(OLD)-'revoked_at'-'updated_at') OR OLD.revoked_at IS NOT NULL THEN
      RAISE EXCEPTION 'Director admission cannot be extended or rewritten' USING ERRCODE='23514', CONSTRAINT='ck_permission_immutable_limits';
    END IF;
  ELSE
    SELECT * INTO sub FROM subscriptions WHERE id=NEW.subscription_id FOR UPDATE;
    PERFORM t03_assert_director(NEW.approved_by_director_id,NEW.approved_at);
    IF t03_paid_at(sub.id,NEW.approved_at)>=sub.full_price THEN RAISE EXCEPTION 'Fully paid subscription uses normal access' USING ERRCODE='23514'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_t03_permission BEFORE INSERT OR UPDATE ON temporary_access_permissions FOR EACH ROW EXECUTE FUNCTION t03_guard_permission();

CREATE FUNCTION t03_guard_activation_finance() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE sub subscriptions; enrollment student_subject_enrollments; receipt payment_receipts; permission temporary_access_permissions; paid numeric;
BEGIN
  SELECT * INTO sub FROM subscriptions WHERE id=NEW.activation_subscription_id FOR UPDATE;
  SELECT * INTO enrollment FROM student_subject_enrollments WHERE id=sub.enrollment_id;
  SELECT * INTO receipt FROM payment_receipts WHERE id=NEW.activation_payment_confirmation_id;
  IF enrollment.student_id IS DISTINCT FROM NEW.student_id OR receipt.confirmed_by_director_at IS NULL
    OR receipt.confirmed_by_director_at>NEW.activated_at OR NOT EXISTS
    (SELECT 1 FROM payment_distributions WHERE subscription_id=sub.id AND payment_id=receipt.id AND approved_at<=NEW.activated_at) THEN
    RAISE EXCEPTION 'Activation requires a confirmed allocated payment for this student' USING ERRCODE='23514', CONSTRAINT='ck_activation_payment_basis';
  END IF;
  paid:=t03_paid_at(sub.id,NEW.activated_at);
  IF NEW.activation_basis='FULL_PAYMENT' THEN
    IF paid<sub.full_price THEN RAISE EXCEPTION 'Incomplete payment needs a separate director admission' USING ERRCODE='23514', CONSTRAINT='ck_activation_full_payment'; END IF;
  ELSE
    SELECT * INTO permission FROM temporary_access_permissions WHERE id=NEW.activation_director_admission_id FOR UPDATE;
    IF paid>=sub.full_price OR permission.subscription_id IS DISTINCT FROM sub.id OR permission.approved_at>NEW.activated_at
      OR permission.valid_from>NEW.activated_at OR permission.valid_to<=NEW.activated_at
      OR (permission.revoked_at IS NOT NULL AND permission.revoked_at<=NEW.activated_at) THEN
      RAISE EXCEPTION 'Invalid or expired limited director admission' USING ERRCODE='23514', CONSTRAINT='ck_activation_limited_admission';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_t03_activation_finance BEFORE INSERT OR UPDATE OF student_id,activation_subscription_id,activation_payment_confirmation_id,activation_director_admission_id,activation_basis,activated_at
  ON student_accounts FOR EACH ROW EXECUTE FUNCTION t03_guard_activation_finance();

CREATE FUNCTION t03_guard_schedule() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE assignment teaching_assignments; slot recurring_slots;
BEGIN
  IF TG_TABLE_NAME='recurring_slots' THEN
    SELECT * INTO assignment FROM teaching_assignments WHERE id=NEW.teaching_assignment_id;
    IF assignment.enrollment_id IS DISTINCT FROM NEW.enrollment_id THEN RAISE EXCEPTION 'Slot assignment mismatch' USING ERRCODE='23514'; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name=NEW.timezone) THEN RAISE EXCEPTION 'Unknown timezone' USING ERRCODE='23514'; END IF;
  ELSE
    IF TG_OP='UPDATE' AND OLD.actual_start_at IS NOT NULL AND
      (ROW(NEW.actual_start_at,NEW.actual_teacher_at_start_id,NEW.rate_at_start_snapshot,NEW.points_at_start_snapshot,NEW.rate_basis_at_start,NEW.rate_currency_at_start)
       IS DISTINCT FROM ROW(OLD.actual_start_at,OLD.actual_teacher_at_start_id,OLD.rate_at_start_snapshot,OLD.points_at_start_snapshot,OLD.rate_basis_at_start,OLD.rate_currency_at_start)) THEN
      RAISE EXCEPTION 'Actual-start rate snapshot is immutable' USING ERRCODE='23514', CONSTRAINT='ck_lesson_start_immutable';
    END IF;
    SELECT * INTO assignment FROM teaching_assignments WHERE id=NEW.teaching_assignment_id;
    IF assignment.enrollment_id IS DISTINCT FROM NEW.enrollment_id OR assignment.teacher_id IS DISTINCT FROM NEW.scheduled_teacher_id THEN
      RAISE EXCEPTION 'Lesson assignment mismatch' USING ERRCODE='23514', CONSTRAINT='ck_lesson_assignment';
    END IF;
    IF NEW.recurring_slot_id IS NOT NULL THEN
      SELECT * INTO slot FROM recurring_slots WHERE id=NEW.recurring_slot_id;
      IF slot.enrollment_id IS DISTINCT FROM NEW.enrollment_id THEN RAISE EXCEPTION 'Lesson slot mismatch' USING ERRCODE='23514'; END IF;
    END IF;
    IF TG_OP='UPDATE' AND (NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at) AND EXISTS
      (SELECT 1 FROM entitlement_consumptions WHERE lesson_occurrence_id=OLD.id) THEN
      PERFORM t03_require_open_period(OLD.scheduled_at);
      PERFORM t03_require_open_period(NEW.scheduled_at);
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_t03_slot BEFORE INSERT OR UPDATE ON recurring_slots FOR EACH ROW EXECUTE FUNCTION t03_guard_schedule();
CREATE TRIGGER trg_t03_lesson BEFORE INSERT OR UPDATE ON lesson_occurrences FOR EACH ROW EXECUTE FUNCTION t03_guard_schedule();

CREATE FUNCTION t03_guard_outcome() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE lesson lesson_occurrences; permission temporary_access_permissions; sub subscriptions; used integer;
BEGIN
  SELECT * INTO lesson FROM lesson_occurrences WHERE id=NEW.lesson_occurrence_id FOR UPDATE;
  IF lesson.actual_start_at IS DISTINCT FROM NEW.actual_started_at OR lesson.actual_teacher_at_start_id IS DISTINCT FROM NEW.actual_teacher_id
    OR lesson.rate_at_start_snapshot IS DISTINCT FROM NEW.rate_snapshot OR lesson.points_at_start_snapshot IS DISTINCT FROM NEW.points_snapshot
    OR lesson.rate_basis_at_start IS DISTINCT FROM NEW.rate_basis OR lesson.rate_currency_at_start IS DISTINCT FROM NEW.currency THEN
    RAISE EXCEPTION 'Outcome must reuse the actual-start snapshot' USING ERRCODE='23514', CONSTRAINT='ck_outcome_start_snapshot';
  END IF;
  IF NEW.temporary_access_permission_id IS NOT NULL THEN
    SELECT * INTO permission FROM temporary_access_permissions WHERE id=NEW.temporary_access_permission_id FOR UPDATE;
    SELECT * INTO sub FROM subscriptions WHERE id=permission.subscription_id;
    SELECT count(*) INTO used FROM lesson_actual_outcomes WHERE temporary_access_permission_id=permission.id;
    IF sub.enrollment_id IS DISTINCT FROM lesson.enrollment_id OR NEW.actual_started_at<permission.valid_from OR NEW.actual_started_at>=permission.valid_to
      OR permission.approved_at>NEW.actual_started_at OR used>=permission.max_lessons
      OR (permission.revoked_at IS NOT NULL AND permission.revoked_at<=NEW.actual_started_at)
      OR t03_paid_at(sub.id,NEW.actual_started_at)>=sub.full_price THEN
      RAISE EXCEPTION 'Director admission limit or period exceeded' USING ERRCODE='23514', CONSTRAINT='ck_outcome_admission';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_t03_outcome BEFORE INSERT ON lesson_actual_outcomes FOR EACH ROW EXECUTE FUNCTION t03_guard_outcome();

CREATE FUNCTION t03_guard_grant() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE sub subscriptions; distribution payment_distributions; granted integer;
BEGIN
  SELECT * INTO sub FROM subscriptions WHERE id=NEW.subscription_id FOR UPDATE;
  SELECT * INTO distribution FROM payment_distributions WHERE id=NEW.payment_distribution_id;
  IF distribution.subscription_id IS DISTINCT FROM sub.id OR distribution.approved_at IS NULL OR distribution.approved_at>NEW.granted_at OR t03_paid_at(sub.id,NEW.granted_at)<sub.full_price THEN
    RAISE EXCEPTION 'Paid rights require full confirmed allocated payment' USING ERRCODE='23514', CONSTRAINT='ck_grant_paid_basis';
  END IF;
  SELECT coalesce(sum(quantity),0) INTO granted FROM entitlement_grants WHERE subscription_id=sub.id;
  IF granted+NEW.quantity>sub.lesson_count THEN RAISE EXCEPTION 'Duplicate/excess rights issuance' USING ERRCODE='23514', CONSTRAINT='ck_grant_total'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_t03_grant BEFORE INSERT ON entitlement_grants FOR EACH ROW EXECUTE FUNCTION t03_guard_grant();

CREATE FUNCTION t03_guard_consumption() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE grant_row entitlement_grants; sub subscriptions; lesson lesson_occurrences; adjustment entitlement_adjustments; remaining integer;
BEGIN
  SELECT * INTO grant_row FROM entitlement_grants WHERE id=NEW.grant_id FOR UPDATE;
  SELECT * INTO sub FROM subscriptions WHERE id=NEW.subscription_id;
  SELECT * INTO lesson FROM lesson_occurrences WHERE id=NEW.lesson_occurrence_id FOR UPDATE;
  PERFORM t03_require_open_period(lesson.scheduled_at);
  IF grant_row.subscription_id IS DISTINCT FROM sub.id OR lesson.enrollment_id IS DISTINCT FROM sub.enrollment_id THEN
    RAISE EXCEPTION 'Consumption student/subject mismatch' USING ERRCODE='23514', CONSTRAINT='ck_consumption_scope';
  END IF;
  IF TG_OP='UPDATE' THEN
    IF (to_jsonb(NEW)-'cancelled_at'-'cancellation_adjustment_id'-'updated_at') IS DISTINCT FROM (to_jsonb(OLD)-'cancelled_at'-'cancellation_adjustment_id'-'updated_at') OR OLD.cancelled_at IS NOT NULL THEN
      RAISE EXCEPTION 'Original consumption cannot be rewritten' USING ERRCODE='23514';
    END IF;
    SELECT * INTO adjustment FROM entitlement_adjustments WHERE id=NEW.cancellation_adjustment_id;
    IF adjustment.original_consumption_id IS DISTINCT FROM OLD.id OR adjustment.kind<>'CONSUMPTION_CANCELLATION' THEN
      RAISE EXCEPTION 'Linked cancellation adjustment required' USING ERRCODE='23514';
    END IF;
  ELSE
    IF NEW.cancelled_at IS NOT NULL THEN RAISE EXCEPTION 'New consumption cannot start cancelled' USING ERRCODE='23514'; END IF;
    IF NEW.basis='CONFIRMED_LESSON' AND NOT EXISTS
      (SELECT 1 FROM lesson_actual_outcomes WHERE lesson_occurrence_id=lesson.id AND confirmed_at<=NEW.consumed_at) THEN
      RAISE EXCEPTION 'Confirmed lesson fact required' USING ERRCODE='23514', CONSTRAINT='ck_consumption_lesson_fact';
    END IF;
    IF NEW.basis='APPROVED_CANCELLATION' AND lesson.status<>'CANCELLED' THEN RAISE EXCEPTION 'Specific cancellation basis required' USING ERRCODE='23514'; END IF;
  END IF;
  SELECT grant_row.quantity + coalesce((SELECT sum(delta_quantity) FROM entitlement_adjustments WHERE grant_id=grant_row.id),0)
    - coalesce((SELECT sum(quantity) FROM entitlement_consumptions WHERE grant_id=grant_row.id AND cancelled_at IS NULL AND id<>NEW.id),0) INTO remaining;
  IF NEW.cancelled_at IS NULL AND NEW.quantity>remaining THEN RAISE EXCEPTION 'Insufficient paid rights' USING ERRCODE='23514', CONSTRAINT='ck_entitlement_nonnegative'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_t03_consumption BEFORE INSERT OR UPDATE ON entitlement_consumptions FOR EACH ROW EXECUTE FUNCTION t03_guard_consumption();

CREATE FUNCTION t03_guard_adjustment() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE grant_row entitlement_grants; original entitlement_consumptions; remaining integer;
BEGIN
  SELECT * INTO grant_row FROM entitlement_grants WHERE id=NEW.grant_id FOR UPDATE;
  PERFORM t03_require_open_period(NEW.effective_at,NEW.financial_period_id);
  PERFORM t03_assert_director(NEW.author_id,NEW.effective_at);
  IF NEW.original_consumption_id IS NOT NULL THEN
    SELECT * INTO original FROM entitlement_consumptions WHERE id=NEW.original_consumption_id;
    IF original.grant_id IS DISTINCT FROM NEW.grant_id THEN RAISE EXCEPTION 'Adjustment source mismatch' USING ERRCODE='23514'; END IF;
  END IF;
  SELECT grant_row.quantity + coalesce((SELECT sum(delta_quantity) FROM entitlement_adjustments WHERE grant_id=grant_row.id),0)
    - coalesce((SELECT sum(quantity) FROM entitlement_consumptions WHERE grant_id=grant_row.id AND cancelled_at IS NULL),0) INTO remaining;
  IF remaining+NEW.delta_quantity<0 THEN RAISE EXCEPTION 'Adjustment overdraw' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_t03_adjustment BEFORE INSERT ON entitlement_adjustments FOR EACH ROW EXECUTE FUNCTION t03_guard_adjustment();

CREATE FUNCTION t03_guard_refund() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE sub subscriptions; refunded numeric;
BEGIN
  IF TG_OP='UPDATE' AND OLD.executed_at IS NOT NULL THEN RAISE EXCEPTION 'Executed refund is immutable' USING ERRCODE='23514'; END IF;
  SELECT * INTO sub FROM subscriptions WHERE id=NEW.subscription_id FOR UPDATE;
  IF NEW.currency<>sub.currency OR NEW.original_paid_unit_price<>sub.original_paid_unit_price THEN RAISE EXCEPTION 'Original paid rights price must be retained' USING ERRCODE='23514'; END IF;
  IF NEW.approved_by_director_at IS NOT NULL THEN PERFORM t03_assert_director(NEW.approved_by_director_id,NEW.approved_by_director_at); END IF;
  IF NEW.executed_at IS NOT NULL THEN
    SELECT coalesce(sum(executed_amount),0) INTO refunded FROM refund_records WHERE subscription_id=sub.id AND executed_at IS NOT NULL AND id<>NEW.id;
    IF refunded+NEW.executed_amount>t03_paid_at(sub.id,NEW.executed_at) THEN RAISE EXCEPTION 'Refund exceeds confirmed allocated money' USING ERRCODE='23514'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_t03_refund BEFORE INSERT OR UPDATE ON refund_records FOR EACH ROW EXECUTE FUNCTION t03_guard_refund();

CREATE FUNCTION t03_guard_accrual() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE outcome lesson_actual_outcomes;
BEGIN
  SELECT * INTO outcome FROM lesson_actual_outcomes WHERE id=NEW.lesson_actual_outcome_id;
  PERFORM t03_require_open_period(NEW.recognized_at,NEW.financial_period_id);
  IF outcome.actual_teacher_id IS DISTINCT FROM NEW.teacher_id OR outcome.rate_snapshot IS DISTINCT FROM NEW.rate_snapshot
    OR outcome.points_snapshot IS DISTINCT FROM NEW.points_snapshot OR outcome.rate_basis IS DISTINCT FROM NEW.rate_basis
    OR outcome.currency IS DISTINCT FROM NEW.currency OR outcome.confirmed_at>NEW.recognized_at THEN
    RAISE EXCEPTION 'Accrual must retain actual teacher and start-time rate snapshot' USING ERRCODE='23514', CONSTRAINT='ck_accrual_snapshot';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_t03_accrual BEFORE INSERT ON teacher_accruals FOR EACH ROW EXECUTE FUNCTION t03_guard_accrual();

CREATE FUNCTION t03_guard_obligation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE accrual teacher_accruals; entry ledger_entries; document ledger_documents;
BEGIN
  IF TG_OP='UPDATE' THEN
    IF (to_jsonb(NEW)-'recognition_entry_id'-'updated_at') IS DISTINCT FROM (to_jsonb(OLD)-'recognition_entry_id'-'updated_at') THEN
      RAISE EXCEPTION 'Recognized obligation cannot be rewritten' USING ERRCODE='23514';
    END IF;
    IF OLD.recognition_entry_id IS NOT NULL AND NEW.recognition_entry_id IS DISTINCT FROM OLD.recognition_entry_id THEN
      RAISE EXCEPTION 'Recognition entry cannot be replaced' USING ERRCODE='23514';
    END IF;
  END IF;
  SELECT * INTO accrual FROM teacher_accruals WHERE id=NEW.accrual_id;
  IF NEW.amount<>accrual.amount OR NEW.currency<>accrual.currency THEN RAISE EXCEPTION 'Obligation/accrual mismatch' USING ERRCODE='23514'; END IF;
  IF NEW.recognition_entry_id IS NOT NULL THEN
    SELECT * INTO entry FROM ledger_entries WHERE id=NEW.recognition_entry_id;
    SELECT * INTO document FROM ledger_documents WHERE id=entry.document_id;
    IF document.accrual_id IS DISTINCT FROM NEW.accrual_id OR entry.published_at IS NULL THEN RAISE EXCEPTION 'Published matching accrual entry required' USING ERRCODE='23514'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_t03_obligation BEFORE INSERT OR UPDATE ON payroll_obligations FOR EACH ROW EXECUTE FUNCTION t03_guard_obligation();

CREATE FUNCTION t03_guard_payout() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE attempt payout_attempts; obligation payroll_obligations; paid numeric;
BEGIN
  SELECT * INTO attempt FROM payout_attempts WHERE id=NEW.attempt_id FOR UPDATE;
  SELECT * INTO obligation FROM payroll_obligations WHERE id=attempt.obligation_id FOR UPDATE;
  SELECT coalesce(sum(p.amount),0) INTO paid FROM confirmed_payouts p JOIN payout_attempts a ON a.id=p.attempt_id WHERE a.obligation_id=obligation.id;
  IF attempt.status<>'SUCCEEDED' OR NEW.amount>attempt.amount OR NEW.currency<>attempt.currency OR NEW.currency<>obligation.currency
    OR paid+NEW.amount>obligation.amount OR obligation.recognition_entry_id IS NULL THEN
    RAISE EXCEPTION 'Unconfirmed, excessive or unrecognized payout' USING ERRCODE='23514', CONSTRAINT='ck_confirmed_payout_basis';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_t03_payout BEFORE INSERT ON confirmed_payouts FOR EACH ROW EXECUTE FUNCTION t03_guard_payout();

CREATE FUNCTION t03_guard_period() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' OR OLD.closed_at IS NOT NULL OR NEW.starts_at<>OLD.starts_at OR NEW.ends_at<>OLD.ends_at THEN
    RAISE EXCEPTION 'Financial period boundaries and closure are immutable' USING ERRCODE='23514', CONSTRAINT='ck_closed_period_immutable';
  END IF;
  IF NEW.closed_at IS NOT NULL THEN PERFORM t03_assert_director(NEW.closed_by_id,NEW.closed_at); END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_t03_period BEFORE INSERT OR UPDATE OR DELETE ON financial_periods FOR EACH ROW EXECUTE FUNCTION t03_guard_period();

CREATE FUNCTION t03_guard_ledger_entry() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE document ledger_documents; expected_balance jsonb;
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') AND OLD.published_at IS NOT NULL THEN
    RAISE EXCEPTION 'Published ledger entry is immutable' USING ERRCODE='23514', CONSTRAINT='ck_published_ledger_immutable';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  PERFORM t03_require_open_period(NEW.effective_at,NEW.financial_period_id);
  IF NEW.published_at IS NOT NULL THEN
    IF TG_OP='INSERT' THEN RAISE EXCEPTION 'Create draft with lines before publishing' USING ERRCODE='23514'; END IF;
    IF EXISTS (SELECT 1 FROM ledger_lines WHERE entry_id=NEW.id GROUP BY currency
      HAVING sum(CASE WHEN direction='DEBIT' THEN amount ELSE -amount END)<>0 OR count(*)<2)
      OR NOT EXISTS (SELECT 1 FROM ledger_lines WHERE entry_id=NEW.id) THEN
      RAISE EXCEPTION 'Entry must balance in every currency' USING ERRCODE='23514', CONSTRAINT='ck_ledger_currency_balance';
    END IF;
    SELECT jsonb_object_agg(currency,jsonb_build_object('debit',debit::text,'credit',credit::text)) INTO expected_balance
      FROM (SELECT currency,sum(amount) FILTER (WHERE direction='DEBIT') AS debit,sum(amount) FILTER (WHERE direction='CREDIT') AS credit
        FROM ledger_lines WHERE entry_id=NEW.id GROUP BY currency) totals;
    IF NEW.balance_snapshot IS DISTINCT FROM expected_balance THEN RAISE EXCEPTION 'Stale balance snapshot' USING ERRCODE='23514', CONSTRAINT='ck_ledger_balance_snapshot'; END IF;
    SELECT * INTO document FROM ledger_documents WHERE id=NEW.document_id;
    IF (document.payment_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM payment_receipts WHERE id=document.payment_id AND confirmed_by_director_at IS NOT NULL))
      OR (document.refund_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM refund_records WHERE id=document.refund_id AND executed_at IS NOT NULL))
      OR (document.correction_of_document_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ledger_entries WHERE document_id=document.correction_of_document_id AND published_at IS NOT NULL)) THEN
      RAISE EXCEPTION 'Ledger source is not confirmed/executed' USING ERRCODE='23514', CONSTRAINT='ck_ledger_confirmed_source';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_t03_ledger_entry BEFORE INSERT OR UPDATE OR DELETE ON ledger_entries FOR EACH ROW EXECUTE FUNCTION t03_guard_ledger_entry();

CREATE FUNCTION t03_guard_ledger_line() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE entry ledger_entries; parent_ids uuid[];
BEGIN
  IF TG_OP='INSERT' THEN parent_ids:=ARRAY[NEW.entry_id];
  ELSIF TG_OP='DELETE' THEN parent_ids:=ARRAY[OLD.entry_id];
  ELSE parent_ids:=ARRAY[OLD.entry_id,NEW.entry_id]; END IF;
  FOR entry IN SELECT * FROM ledger_entries WHERE id=ANY(parent_ids) ORDER BY id FOR UPDATE LOOP
    IF entry.published_at IS NOT NULL THEN RAISE EXCEPTION 'Published ledger lines are immutable' USING ERRCODE='23514', CONSTRAINT='ck_published_ledger_immutable'; END IF;
    PERFORM t03_require_open_period(entry.effective_at,entry.financial_period_id);
  END LOOP;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_t03_ledger_line BEFORE INSERT OR UPDATE OR DELETE ON ledger_lines FOR EACH ROW EXECUTE FUNCTION t03_guard_ledger_line();

DO $$ DECLARE table_name text; BEGIN
  FOREACH table_name IN ARRAY ARRAY['lesson_change_events','lesson_actual_outcomes','entitlement_grants','entitlement_adjustments','teacher_accruals','confirmed_payouts','ledger_documents','sale_conditions'] LOOP
    EXECUTE format('CREATE TRIGGER trg_t03_history BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION t03_immutable_record()',table_name);
  END LOOP;
  FOREACH table_name IN ARRAY ARRAY['payment_receipts','payment_distributions','refund_records','entitlement_consumptions','payroll_obligations','payout_attempts','temporary_access_permissions'] LOOP
    EXECUTE format('CREATE TRIGGER trg_t03_no_delete BEFORE DELETE ON %I FOR EACH ROW EXECUTE FUNCTION t03_immutable_record()',table_name);
  END LOOP;
END $$;

-- No login/password or application membership is provisioned here. The deployment
-- must use a separate non-owner login with this role; never the migration owner.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='online_school_runtime') THEN
    CREATE ROLE online_school_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='online_school_runtime' AND (rolsuper OR rolbypassrls OR rolcreaterole)) THEN
    RAISE EXCEPTION 'Existing online_school_runtime role has unsafe privileges';
  END IF;
END $$;
GRANT USAGE ON SCHEMA public TO online_school_runtime;
GRANT SELECT ON ledger_entries,ledger_lines,ledger_documents,financial_periods,payment_receipts,refund_records,teacher_accruals,confirmed_payouts,staff_accounts,auth_accounts,roles,role_assignments TO online_school_runtime;
GRANT INSERT,UPDATE ON ledger_entries,ledger_lines TO online_school_runtime;
ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY ledger_entry_read ON ledger_entries FOR SELECT TO online_school_runtime USING (true);
CREATE POLICY ledger_entry_insert ON ledger_entries FOR INSERT TO online_school_runtime WITH CHECK (published_at IS NULL);
CREATE POLICY ledger_entry_draft_update ON ledger_entries FOR UPDATE TO online_school_runtime USING (published_at IS NULL) WITH CHECK (true);
CREATE POLICY ledger_line_read ON ledger_lines FOR SELECT TO online_school_runtime USING (true);
CREATE POLICY ledger_line_insert ON ledger_lines FOR INSERT TO online_school_runtime WITH CHECK (EXISTS (SELECT 1 FROM ledger_entries e WHERE e.id=entry_id AND e.published_at IS NULL));
CREATE POLICY ledger_line_draft_update ON ledger_lines FOR UPDATE TO online_school_runtime
  USING (EXISTS (SELECT 1 FROM ledger_entries e WHERE e.id=entry_id AND e.published_at IS NULL))
  WITH CHECK (EXISTS (SELECT 1 FROM ledger_entries e WHERE e.id=entry_id AND e.published_at IS NULL));


-- TASK-04: structural consistency. Runtime ACL, S3 adapters and worker commands follow separately.
ALTER TABLE homework_assignments ADD CONSTRAINT ck_homework_content CHECK (jsonb_typeof(content)='object' AND length(trim(title))>0);
ALTER TABLE homework_deliveries ADD CONSTRAINT ck_homework_due CHECK (due_at>=issued_at AND (cancelled_at IS NULL OR cancelled_at>=issued_at));
ALTER TABLE homework_submissions ADD CONSTRAINT ck_submission_content CHECK (version>0 AND jsonb_typeof(content)='object');
ALTER TABLE submission_reviews ADD CONSTRAINT ck_review_version CHECK (version>0);
ALTER TABLE skill_assessments ADD CONSTRAINT ck_skill_assessment_version CHECK (version>0 AND length(trim(basis))>0);
ALTER TABLE progress_checkpoints ADD CONSTRAINT ck_checkpoint_count CHECK (
  confirmed_lesson_count>0 AND ((type='LESSON_4' AND confirmed_lesson_count%4=0) OR (type='LESSON_8' AND confirmed_lesson_count%8=0))
  AND (completed_at IS NULL OR completed_at>=triggered_at));
ALTER TABLE education_reports
  ADD CONSTRAINT ck_report_version CHECK (version>0 AND period_end>period_start AND jsonb_typeof(content)='object'),
  ADD CONSTRAINT ck_report_publication CHECK (
    (status='DRAFT' AND published_at IS NULL AND published_by IS NULL)
    OR (status='GENERATED' AND generated_at IS NOT NULL AND published_at IS NULL AND published_by IS NULL)
    OR (status='PUBLISHED' AND generated_at IS NOT NULL AND published_at IS NOT NULL AND published_at>=generated_at AND published_by IS NOT NULL));

ALTER TABLE s3_objects
  ADD CONSTRAINT ck_s3_metadata CHECK (size>=0 AND length(trim(bucket))>0 AND length(trim(key))>0 AND key NOT LIKE '%://%' AND length(trim(content_type))>0),
  ADD CONSTRAINT ck_s3_hash CHECK (sha256 IS NULL OR sha256 ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT ck_s3_state CHECK (
    status IN ('PENDING','QUARANTINED','DELETED')
    OR (status='UPLOADED' AND uploaded_at IS NOT NULL)
    OR (status='VERIFIED' AND uploaded_at IS NOT NULL AND verified_at IS NOT NULL AND verified_at>=uploaded_at));
ALTER TABLE file_permissions
  ADD CONSTRAINT ck_file_permission_expiry CHECK (expires_at IS NULL OR expires_at>granted_at),
  ADD CONSTRAINT ck_file_permission_revocation CHECK (
    (revoked_at IS NULL AND revoked_by IS NULL) OR (revoked_at IS NOT NULL AND revoked_at>=granted_at AND revoked_by IS NOT NULL));

ALTER TABLE audit_events ADD CONSTRAINT ck_audit_actor CHECK (
  (actor_kind='ACCOUNT' AND actor_id IS NOT NULL AND system_actor_ref IS NULL)
  OR (actor_kind='SYSTEM' AND actor_id IS NULL AND system_actor_ref IS NOT NULL AND length(trim(system_actor_ref))>0)
  OR (actor_kind='ANONYMOUS' AND actor_id IS NULL AND system_actor_ref IS NULL));
ALTER TABLE audit_events ADD CONSTRAINT ck_audit_identity CHECK (length(trim(action))>0 AND length(trim(resource_type))>0 AND length(trim(event_key))>0);
ALTER TABLE idempotency_records
  ADD CONSTRAINT ck_idempotency_identity CHECK (length(trim(scope))>0 AND length(trim(key))>0 AND length(trim(command_type))>0),
  ADD CONSTRAINT ck_idempotency_ttl CHECK (expires_at>created_at),
  ADD CONSTRAINT ck_idempotency_hash CHECK (request_hash ~ '^[0-9a-f]{64}$' AND (result_hash IS NULL OR result_hash ~ '^[0-9a-f]{64}$')),
  ADD CONSTRAINT ck_idempotency_state CHECK (
    (status='IN_PROGRESS' AND completed_at IS NULL AND result_hash IS NULL AND result IS NULL)
    OR (status IN ('COMPLETED','FAILED') AND completed_at IS NOT NULL AND completed_at>=created_at AND result_hash IS NOT NULL));
ALTER TABLE outbox_events
  ADD CONSTRAINT ck_outbox_payload CHECK (jsonb_typeof(payload)='object' AND schema_version>0 AND length(trim(topic))>0 AND length(trim(event_key))>0),
  ADD CONSTRAINT ck_outbox_attempts CHECK (attempts>=0 AND (last_attempt_at IS NULL OR attempts>0)),
  ADD CONSTRAINT ck_outbox_lease CHECK (num_nonnulls(locked_by,locked_until) IN (0,2)),
  ADD CONSTRAINT ck_outbox_delivery CHECK (published_at IS NULL OR
    (attempts>0 AND last_attempt_at IS NOT NULL AND published_at>=last_attempt_at AND delivery_reference IS NOT NULL AND locked_by IS NULL AND locked_until IS NULL));
ALTER TABLE job_records
  ADD CONSTRAINT ck_job_payload CHECK (jsonb_typeof(payload)='object' AND length(trim(type))>0 AND length(trim(deduplication_key))>0),
  ADD CONSTRAINT ck_job_attempts CHECK (max_attempts>0 AND attempts>=0 AND attempts<=max_attempts),
  ADD CONSTRAINT ck_job_lease CHECK (num_nonnulls(locked_by,locked_until) IN (0,2) AND
    ((status='RUNNING' AND locked_by IS NOT NULL AND started_at IS NOT NULL AND locked_until>started_at) OR (status<>'RUNNING' AND locked_by IS NULL AND locked_until IS NULL))),
  ADD CONSTRAINT ck_job_finish CHECK (
    (status IN ('SUCCEEDED','FAILED','CANCELLED') AND finished_at IS NOT NULL AND (started_at IS NULL OR finished_at>=started_at))
    OR (status NOT IN ('SUCCEEDED','FAILED','CANCELLED') AND finished_at IS NULL));
ALTER TABLE job_attempts ADD CONSTRAINT ck_job_attempt_state CHECK (attempt_no>0 AND
  ((result='RUNNING' AND finished_at IS NULL) OR (result<>'RUNNING' AND finished_at IS NOT NULL AND finished_at>=started_at)));
ALTER TABLE recovery_states ADD CONSTRAINT ck_recovery_resolution CHECK (
  (status IN ('UNKNOWN','RECONCILING','MANUAL_REQUIRED') AND reconciled_at IS NULL)
  OR (status='CONFIRMED' AND ext_resource_id IS NOT NULL AND reconciled_at IS NOT NULL AND evidence_ref IS NOT NULL AND length(trim(evidence_ref))>0)
  OR (status='ABSENT' AND ext_resource_id IS NULL AND reconciled_at IS NOT NULL AND evidence_ref IS NOT NULL AND length(trim(evidence_ref))>0));
ALTER TABLE recovery_states ADD CONSTRAINT ck_recovery_attempt CHECK (attempt_no>0);

CREATE FUNCTION t04_education_context() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE assignment homework_assignments; delivery homework_deliveries; enrollment student_subject_enrollments;
  submission homework_submissions; skill skill_entries; checkpoint progress_checkpoints; outcome lesson_actual_outcomes;
  lesson lesson_occurrences; previous record; confirmed_count bigint;
BEGIN
  CASE TG_TABLE_NAME
  WHEN 'homework_assignments' THEN
    IF NEW.lesson_occurrence_id IS NOT NULL THEN
      SELECT * INTO lesson FROM lesson_occurrences WHERE id=NEW.lesson_occurrence_id;
      SELECT * INTO enrollment FROM student_subject_enrollments WHERE id=lesson.enrollment_id;
      IF enrollment.subject_id IS DISTINCT FROM NEW.subject_id THEN RAISE EXCEPTION 'Homework subject/lesson mismatch' USING ERRCODE='23514',CONSTRAINT='ck_education_context'; END IF;
    END IF;
  WHEN 'homework_deliveries' THEN
    SELECT * INTO assignment FROM homework_assignments WHERE id=NEW.assignment_id;
    SELECT * INTO enrollment FROM student_subject_enrollments WHERE id=NEW.enrollment_id;
    IF assignment.subject_id IS DISTINCT FROM enrollment.subject_id THEN RAISE EXCEPTION 'Homework delivery subject mismatch' USING ERRCODE='23514',CONSTRAINT='ck_education_context'; END IF;
  WHEN 'homework_submissions' THEN
    SELECT * INTO delivery FROM homework_deliveries WHERE id=NEW.delivery_id FOR UPDATE;
    SELECT * INTO enrollment FROM student_subject_enrollments WHERE id=delivery.enrollment_id;
    IF enrollment.student_id IS DISTINCT FROM NEW.student_id OR NEW.submitted_at<delivery.issued_at OR (delivery.cancelled_at IS NOT NULL AND delivery.cancelled_at<=NEW.submitted_at) THEN
      RAISE EXCEPTION 'Submission student/delivery mismatch' USING ERRCODE='23514',CONSTRAINT='ck_education_context';
    END IF;
    IF NEW.supersedes_submission_id IS NOT NULL THEN
      SELECT * INTO submission FROM homework_submissions WHERE id=NEW.supersedes_submission_id;
      IF submission.delivery_id IS DISTINCT FROM NEW.delivery_id OR submission.student_id IS DISTINCT FROM NEW.student_id OR submission.version>=NEW.version THEN
        RAISE EXCEPTION 'Invalid submission revision' USING ERRCODE='23514',CONSTRAINT='ck_submission_revision';
      END IF;
    END IF;
  WHEN 'submission_reviews' THEN
    SELECT * INTO submission FROM homework_submissions WHERE id=NEW.submission_id;
    IF NEW.reviewed_at<submission.submitted_at THEN RAISE EXCEPTION 'Review precedes submission' USING ERRCODE='23514'; END IF;
  WHEN 'skill_assessments' THEN
    SELECT * INTO skill FROM skill_entries WHERE id=NEW.skill_id;
    SELECT * INTO enrollment FROM student_subject_enrollments WHERE id=NEW.enrollment_id;
    IF skill.subject_id IS DISTINCT FROM enrollment.subject_id THEN RAISE EXCEPTION 'Assessment subject mismatch' USING ERRCODE='23514',CONSTRAINT='ck_education_context'; END IF;
    IF NEW.lesson_ref IS NOT NULL AND NOT EXISTS (SELECT 1 FROM lesson_occurrences WHERE id=NEW.lesson_ref AND enrollment_id=NEW.enrollment_id) THEN
      RAISE EXCEPTION 'Assessment lesson mismatch' USING ERRCODE='23514',CONSTRAINT='ck_education_context';
    END IF;
    IF NEW.supersedes_assessment_id IS NOT NULL AND NOT EXISTS
      (SELECT 1 FROM skill_assessments WHERE id=NEW.supersedes_assessment_id AND skill_id=NEW.skill_id AND enrollment_id=NEW.enrollment_id AND version<NEW.version) THEN
      RAISE EXCEPTION 'Invalid assessment revision' USING ERRCODE='23514';
    END IF;
  WHEN 'progress_checkpoints' THEN
    PERFORM 1 FROM student_subject_enrollments WHERE id=NEW.enrollment_id FOR UPDATE;
    SELECT * INTO outcome FROM lesson_actual_outcomes WHERE id=NEW.lesson_actual_outcome_id;
    SELECT * INTO lesson FROM lesson_occurrences WHERE id=outcome.lesson_occurrence_id;
    SELECT count(*) INTO confirmed_count FROM lesson_actual_outcomes o JOIN lesson_occurrences l ON l.id=o.lesson_occurrence_id
      WHERE l.enrollment_id=NEW.enrollment_id AND l.status='CONDUCTED' AND o.confirmed_at<=NEW.triggered_at;
    IF lesson.enrollment_id IS DISTINCT FROM NEW.enrollment_id OR lesson.status<>'CONDUCTED' OR outcome.confirmed_at>NEW.triggered_at OR NEW.confirmed_lesson_count>confirmed_count THEN
      RAISE EXCEPTION 'Checkpoint needs confirmed conducted lessons' USING ERRCODE='23514',CONSTRAINT='ck_checkpoint_confirmed_lessons';
    END IF;
  WHEN 'education_reports' THEN
    IF TG_OP='UPDATE' AND OLD.published_at IS NOT NULL THEN RAISE EXCEPTION 'Published report is immutable' USING ERRCODE='23514',CONSTRAINT='ck_published_report_immutable'; END IF;
    SELECT * INTO checkpoint FROM progress_checkpoints WHERE id=NEW.checkpoint_id;
    IF checkpoint.type IS DISTINCT FROM 'LESSON_8'::"CheckpointType" THEN
      RAISE EXCEPTION 'Report belongs to the 8-lesson checkpoint' USING ERRCODE='23514',CONSTRAINT='ck_report_checkpoint';
    END IF;
    IF NEW.supersedes_report_id IS NOT NULL AND NOT EXISTS
      (SELECT 1 FROM education_reports WHERE id=NEW.supersedes_report_id AND checkpoint_id=NEW.checkpoint_id AND version<NEW.version) THEN
      RAISE EXCEPTION 'Invalid report revision' USING ERRCODE='23514';
    END IF;
  END CASE;
  RETURN NEW;
END $$;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['homework_assignments','homework_deliveries','homework_submissions','submission_reviews','skill_assessments','progress_checkpoints','education_reports'] LOOP
    EXECUTE format('CREATE TRIGGER trg_t04_education BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION t04_education_context()',t);
  END LOOP;
END $$;

CREATE FUNCTION t04_guard_file_permission() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE object s3_objects;
BEGIN
  SELECT * INTO object FROM s3_objects WHERE id=NEW.s3_object_id FOR UPDATE;
  IF TG_OP='INSERT' AND (object.status IS DISTINCT FROM 'VERIFIED'::"S3ObjectStatus" OR NEW.revoked_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Read permission needs a verified object' USING ERRCODE='23514',CONSTRAINT='ck_file_verified_object';
  END IF;
  IF TG_OP='UPDATE' AND ((to_jsonb(NEW)-'revoked_at'-'revoked_by'-'updated_at') IS DISTINCT FROM (to_jsonb(OLD)-'revoked_at'-'revoked_by'-'updated_at') OR OLD.revoked_at IS NOT NULL) THEN
    RAISE EXCEPTION 'File permission can only be revoked; issue a new grant' USING ERRCODE='23514',CONSTRAINT='ck_file_permission_immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_t04_file_permission BEFORE INSERT OR UPDATE ON file_permissions FOR EACH ROW EXECUTE FUNCTION t04_guard_file_permission();

CREATE FUNCTION t04_guard_s3_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.bucket IS DISTINCT FROM OLD.bucket OR NEW.key IS DISTINCT FROM OLD.key OR NEW.uploaded_by IS DISTINCT FROM OLD.uploaded_by THEN
    RAISE EXCEPTION 'Object identity is immutable' USING ERRCODE='23514';
  END IF;
  IF OLD.verified_at IS NOT NULL AND (NEW.size IS DISTINCT FROM OLD.size OR NEW.sha256 IS DISTINCT FROM OLD.sha256 OR NEW.content_type IS DISTINCT FROM OLD.content_type) THEN
    RAISE EXCEPTION 'Verified object content needs a new object key' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_t04_s3_identity BEFORE UPDATE ON s3_objects FOR EACH ROW EXECUTE FUNCTION t04_guard_s3_identity();

CREATE FUNCTION t04_guard_file_audit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.permission_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM file_permissions WHERE id=NEW.permission_id AND s3_object_id=NEW.s3_object_id) THEN
    RAISE EXCEPTION 'File audit permission/object mismatch' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_t04_file_audit BEFORE INSERT ON file_audit_logs FOR EACH ROW EXECUTE FUNCTION t04_guard_file_audit();

CREATE FUNCTION t04_guard_idempotency() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN
    IF OLD.expires_at>clock_timestamp() THEN RAISE EXCEPTION 'Unexpired idempotency record cannot be removed' USING ERRCODE='23514',CONSTRAINT='ck_idempotency_not_expired'; END IF;
    RETURN OLD;
  END IF;
  IF OLD.status<>'IN_PROGRESS' OR NEW.scope<>OLD.scope OR NEW.key<>OLD.key OR NEW.command_type<>OLD.command_type OR NEW.request_hash<>OLD.request_hash OR NEW.expires_at<>OLD.expires_at THEN
    RAISE EXCEPTION 'Idempotency identity/result is immutable' USING ERRCODE='23514',CONSTRAINT='ck_idempotency_immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_t04_idempotency BEFORE UPDATE OR DELETE ON idempotency_records FOR EACH ROW EXECUTE FUNCTION t04_guard_idempotency();

CREATE FUNCTION t04_guard_outbox() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE audit audit_events;
BEGIN
  IF TG_OP='INSERT' THEN
    SELECT * INTO audit FROM audit_events WHERE id=NEW.audit_event_id;
    IF audit.result IS DISTINCT FROM 'SUCCESS'::"AuditResult" OR audit.source_operation_id IS DISTINCT FROM NEW.source_operation_id THEN
      RAISE EXCEPTION 'Outbox needs matching successful audit' USING ERRCODE='23514',CONSTRAINT='ck_outbox_audit';
    END IF;
    IF NEW.published_at IS NOT NULL OR NEW.attempts<>0 THEN RAISE EXCEPTION 'Outbox starts undelivered' USING ERRCODE='23514'; END IF;
  ELSE
    IF OLD.published_at IS NOT NULL OR NEW.attempts<OLD.attempts OR
      (to_jsonb(NEW)-ARRAY['attempts','last_attempt_at','next_attempt_at','locked_by','locked_until','published_at','delivery_reference','last_error_code','updated_at']) IS DISTINCT FROM
      (to_jsonb(OLD)-ARRAY['attempts','last_attempt_at','next_attempt_at','locked_by','locked_until','published_at','delivery_reference','last_error_code','updated_at']) THEN
      RAISE EXCEPTION 'Outbox source/payload or delivered state is immutable' USING ERRCODE='23514',CONSTRAINT='ck_outbox_immutable';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_t04_outbox BEFORE INSERT OR UPDATE ON outbox_events FOR EACH ROW EXECUTE FUNCTION t04_guard_outbox();

CREATE FUNCTION t04_guard_job() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE event outbox_events; recovery recovery_states;
BEGIN
  IF TG_OP='INSERT' AND (NEW.status<>'PENDING' OR NEW.attempts<>0) THEN
    RAISE EXCEPTION 'Jobs start pending with no attempted work' USING ERRCODE='23514';
  END IF;
  IF NEW.source_outbox_event_id IS NOT NULL THEN
    SELECT * INTO event FROM outbox_events WHERE id=NEW.source_outbox_event_id;
    IF event.source_operation_id IS DISTINCT FROM NEW.source_operation_id THEN RAISE EXCEPTION 'Job source mismatch' USING ERRCODE='23514'; END IF;
  END IF;
  IF TG_OP='UPDATE' THEN
    IF OLD.status IN ('SUCCEEDED','FAILED','CANCELLED') OR NEW.attempts<OLD.attempts OR
      (to_jsonb(NEW)-ARRAY['status','attempts','next_run_at','locked_by','locked_until','started_at','finished_at','last_error_code','updated_at']) IS DISTINCT FROM
      (to_jsonb(OLD)-ARRAY['status','attempts','next_run_at','locked_by','locked_until','started_at','finished_at','last_error_code','updated_at']) THEN
      RAISE EXCEPTION 'Job identity/policy or terminal state is immutable' USING ERRCODE='23514',CONSTRAINT='ck_job_immutable';
    END IF;
    IF NEW.retry_policy='RECONCILE_BEFORE_RETRY' AND OLD.attempts>0 AND
      ((NEW.status IN ('PENDING','RETRY_WAIT') AND NEW.status<>OLD.status)
       OR (NEW.status='RUNNING' AND (OLD.status<>'RUNNING' OR NEW.attempts>OLD.attempts))) THEN
      SELECT * INTO recovery FROM recovery_states WHERE job_id=NEW.id AND attempt_no=OLD.attempts FOR UPDATE;
      IF recovery.status IS DISTINCT FROM 'ABSENT'::"RecoveryStatus" THEN
        RAISE EXCEPTION 'Unknown external result requires reconciliation before retry' USING ERRCODE='23514',CONSTRAINT='ck_job_reconciliation_required';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_t04_job BEFORE INSERT OR UPDATE ON job_records FOR EACH ROW EXECUTE FUNCTION t04_guard_job();

CREATE FUNCTION t04_guard_attempt() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE job job_records;
BEGIN
  SELECT * INTO job FROM job_records WHERE id=NEW.job_id FOR UPDATE;
  IF TG_OP='INSERT' THEN
    IF job.status IS DISTINCT FROM 'RUNNING'::"JobStatus" OR NEW.attempt_no>job.max_attempts OR NEW.attempt_no>job.attempts OR NEW.started_at>=job.locked_until THEN
      RAISE EXCEPTION 'Attempt needs a running leased job and reserved attempt number' USING ERRCODE='23514',CONSTRAINT='ck_job_attempt_lease';
    END IF;
  ELSIF OLD.finished_at IS NOT NULL OR NEW.job_id<>OLD.job_id OR NEW.attempt_no<>OLD.attempt_no OR NEW.started_at<>OLD.started_at THEN
    RAISE EXCEPTION 'Finished attempt/history is immutable' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_t04_attempt BEFORE INSERT OR UPDATE ON job_attempts FOR EACH ROW EXECUTE FUNCTION t04_guard_attempt();

CREATE FUNCTION t04_guard_recovery() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM job_attempts WHERE job_id=NEW.job_id AND attempt_no=NEW.attempt_no) THEN
    RAISE EXCEPTION 'Recovery needs the original attempt' USING ERRCODE='23514';
  END IF;
  IF TG_OP='UPDATE' AND (OLD.status IN ('CONFIRMED','ABSENT') OR NEW.job_id<>OLD.job_id OR NEW.attempt_no<>OLD.attempt_no OR NEW.operation_key<>OLD.operation_key OR NEW.provider<>OLD.provider OR NEW.provider_request_id<>OLD.provider_request_id) THEN
    RAISE EXCEPTION 'Recovery identity or verified resolution is immutable' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_t04_recovery BEFORE INSERT OR UPDATE ON recovery_states FOR EACH ROW EXECUTE FUNCTION t04_guard_recovery();

-- Same append-only guard as the existing financial history. Retention/legal hold is a separate controlled process.
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['audit_events','file_audit_logs','homework_submissions','submission_reviews','skill_assessments'] LOOP
    EXECUTE format('CREATE TRIGGER trg_t04_append_only BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION t03_immutable_record()',t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['outbox_events','job_records','job_attempts','recovery_states','file_permissions','education_reports','homework_deliveries'] LOOP
    EXECUTE format('CREATE TRIGGER trg_t04_no_delete BEFORE DELETE ON %I FOR EACH ROW EXECUTE FUNCTION t03_immutable_record()',t);
  END LOOP;
END $$;

GRANT SELECT,INSERT ON audit_events,file_audit_logs TO online_school_runtime;
REVOKE UPDATE,DELETE,TRUNCATE ON audit_events,file_audit_logs FROM online_school_runtime;
GRANT SELECT,INSERT,UPDATE,DELETE ON idempotency_records TO online_school_runtime;
GRANT SELECT,INSERT,UPDATE ON outbox_events,job_records,job_attempts,recovery_states TO online_school_runtime;

COMMIT;
