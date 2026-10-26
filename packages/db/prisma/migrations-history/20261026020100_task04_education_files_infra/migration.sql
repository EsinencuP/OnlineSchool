-- Non-destructive upgrade from the exact TASK-02/03 chain.
BEGIN;
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
ALTER TABLE "crm_tasks" ADD CONSTRAINT "fk_t04_crm_source_event" FOREIGN KEY ("source_event_id") REFERENCES "outbox_events"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

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
