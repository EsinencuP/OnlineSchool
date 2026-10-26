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
