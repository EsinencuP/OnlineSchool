BEGIN;
-- AlterEnum
ALTER TYPE "LedgerAccountType" ADD VALUE 'UNALLOCATED_FUNDS';

-- DropIndex
DROP INDEX "ledger_entries_reverses_entry_id_idx";

-- AlterTable
ALTER TABLE "lesson_occurrences" ADD COLUMN     "rate_context_snapshot" JSONB;

-- AlterTable
ALTER TABLE "payment_receipts" ADD COLUMN     "student_id" UUID;

-- AlterTable
ALTER TABLE "teacher_accruals" ADD COLUMN     "exception_authorized_by_id" UUID;

-- AlterTable
ALTER TABLE "ledger_documents" ADD COLUMN     "consumption_id" UUID,
ADD COLUMN     "distribution_id" UUID;

-- CreateTable
CREATE TABLE "teacher_engagements" (
    "id" UUID NOT NULL,
    "teacher_id" UUID NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3),
    "basis" TEXT NOT NULL,
    "recorded_by_id" UUID NOT NULL,
    "source_operation_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teacher_engagements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teacher_tenure_credits" (
    "id" UUID NOT NULL,
    "engagement_id" UUID NOT NULL,
    "starts_on" DATE NOT NULL,
    "ends_on" DATE NOT NULL,
    "basis" TEXT NOT NULL,
    "recorded_by_id" UUID NOT NULL,
    "source_operation_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teacher_tenure_credits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teacher_rate_promises" (
    "id" UUID NOT NULL,
    "teacher_id" UUID NOT NULL,
    "valid_from" TIMESTAMPTZ(3) NOT NULL,
    "valid_to" TIMESTAMPTZ(3),
    "minimum_rate" DECIMAL(20,4) NOT NULL,
    "additive_rate" DECIMAL(20,4) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "basis" TEXT NOT NULL,
    "recorded_by_id" UUID NOT NULL,
    "source_operation_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teacher_rate_promises_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "teacher_engagements_source_operation_id_key" ON "teacher_engagements"("source_operation_id");

-- CreateIndex
CREATE INDEX "teacher_engagements_teacher_id_starts_at_idx" ON "teacher_engagements"("teacher_id", "starts_at");

-- CreateIndex
CREATE UNIQUE INDEX "teacher_tenure_credits_source_operation_id_key" ON "teacher_tenure_credits"("source_operation_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_tenure_month" ON "teacher_tenure_credits"("engagement_id", "starts_on");

-- CreateIndex
CREATE UNIQUE INDEX "teacher_rate_promises_source_operation_id_key" ON "teacher_rate_promises"("source_operation_id");

-- CreateIndex
CREATE INDEX "teacher_rate_promises_teacher_id_valid_from_idx" ON "teacher_rate_promises"("teacher_id", "valid_from");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_documents_distribution_id_key" ON "ledger_documents"("distribution_id");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_documents_consumption_id_key" ON "ledger_documents"("consumption_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_ledger_single_reversal" ON "ledger_entries"("reverses_entry_id") WHERE (reverses_entry_id IS NOT NULL);

-- AddForeignKey
ALTER TABLE "payment_receipts" ADD CONSTRAINT "fk_payment_contact_student" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "teacher_accruals" ADD CONSTRAINT "fk_accrual_exception_director" FOREIGN KEY ("exception_authorized_by_id") REFERENCES "staff_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ledger_documents" ADD CONSTRAINT "fk_ledger_document_distribution" FOREIGN KEY ("distribution_id") REFERENCES "payment_distributions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ledger_documents" ADD CONSTRAINT "fk_ledger_document_consumption" FOREIGN KEY ("consumption_id") REFERENCES "entitlement_consumptions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "teacher_engagements" ADD CONSTRAINT "fk_engagement_teacher" FOREIGN KEY ("teacher_id") REFERENCES "teacher_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "teacher_engagements" ADD CONSTRAINT "fk_engagement_recorder" FOREIGN KEY ("recorded_by_id") REFERENCES "staff_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "teacher_tenure_credits" ADD CONSTRAINT "fk_tenure_engagement" FOREIGN KEY ("engagement_id") REFERENCES "teacher_engagements"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "teacher_tenure_credits" ADD CONSTRAINT "fk_tenure_recorder" FOREIGN KEY ("recorded_by_id") REFERENCES "staff_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "teacher_rate_promises" ADD CONSTRAINT "fk_rate_promise_teacher" FOREIGN KEY ("teacher_id") REFERENCES "teacher_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "teacher_rate_promises" ADD CONSTRAINT "fk_rate_promise_recorder" FOREIGN KEY ("recorded_by_id") REFERENCES "staff_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE ledger_documents DROP CONSTRAINT ck_ledger_document_source;
ALTER TABLE ledger_documents ADD CONSTRAINT ck_ledger_document_source CHECK(num_nonnulls(payment_id,refund_id,accrual_id,payout_id,correction_of_document_id,distribution_id,consumption_id)=1 AND length(trim(basis))>0);
ALTER TABLE teacher_engagements ADD CONSTRAINT ck_engagement_period CHECK(ends_at IS NULL OR ends_at>starts_at),
 ADD CONSTRAINT ex_teacher_engagement_overlap EXCLUDE USING gist(teacher_id WITH =,tstzrange(starts_at,ends_at,'[)') WITH &&);
ALTER TABLE teacher_tenure_credits ADD CONSTRAINT ck_tenure_full_month CHECK(ends_on=(starts_on+interval '1 month')::date AND length(trim(basis))>0),
 ADD CONSTRAINT ex_tenure_credit_overlap EXCLUDE USING gist(engagement_id WITH =,daterange(starts_on,ends_on,'[)') WITH &&);
ALTER TABLE teacher_rate_promises ADD CONSTRAINT ck_rate_promise CHECK(currency='MDL' AND minimum_rate>=0 AND additive_rate>=0 AND minimum_rate+additive_rate>0 AND length(trim(basis))>0 AND (valid_to IS NULL OR valid_to>valid_from)),
 ADD CONSTRAINT ex_teacher_rate_promise_overlap EXCLUDE USING gist(teacher_id WITH =,tstzrange(valid_from,valid_to,'[)') WITH &&);

CREATE FUNCTION t08_guard_hr_fact() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE engagement teacher_engagements;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'HR evidence cannot be deleted' USING ERRCODE='23514'; END IF;
 IF TG_OP='INSERT' THEN
  PERFORM t03_assert_director(NEW.recorded_by_id,clock_timestamp());
 ELSIF TG_TABLE_NAME='teacher_engagements' THEN
  IF OLD.ends_at IS NOT NULL OR (to_jsonb(NEW)-'ends_at'-'updated_at') IS DISTINCT FROM (to_jsonb(OLD)-'ends_at'-'updated_at') OR EXISTS(SELECT 1 FROM teacher_tenure_credits WHERE engagement_id=OLD.id AND ends_on::timestamptz>NEW.ends_at) THEN
   RAISE EXCEPTION 'Engagement history cannot be rewritten' USING ERRCODE='23514';
  END IF;
 ELSIF TG_TABLE_NAME='teacher_rate_promises' THEN
  IF OLD.valid_to IS NOT NULL OR (to_jsonb(NEW)-'valid_to'-'updated_at') IS DISTINCT FROM (to_jsonb(OLD)-'valid_to'-'updated_at') THEN RAISE EXCEPTION 'Promised terms cannot be rewritten' USING ERRCODE='23514'; END IF;
 ELSE RAISE EXCEPTION 'Tenure credits are immutable evidence' USING ERRCODE='23514';
 END IF;
 IF TG_TABLE_NAME='teacher_tenure_credits' THEN
  SELECT * INTO engagement FROM teacher_engagements WHERE id=NEW.engagement_id FOR UPDATE;
  IF NEW.starts_on::timestamptz<engagement.starts_at OR (engagement.ends_at IS NOT NULL AND NEW.ends_on::timestamptz>engagement.ends_at) THEN RAISE EXCEPTION 'Credit must belong to actual engagement' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER trg_t08_engagement BEFORE INSERT OR UPDATE OR DELETE ON teacher_engagements FOR EACH ROW EXECUTE FUNCTION t08_guard_hr_fact();
CREATE TRIGGER trg_t08_tenure BEFORE INSERT OR UPDATE OR DELETE ON teacher_tenure_credits FOR EACH ROW EXECUTE FUNCTION t08_guard_hr_fact();
CREATE TRIGGER trg_t08_promise BEFORE INSERT OR UPDATE OR DELETE ON teacher_rate_promises FOR EACH ROW EXECUTE FUNCTION t08_guard_hr_fact();

CREATE FUNCTION t08_finance_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE doc ledger_documents;
BEGIN
 IF TG_TABLE_NAME='teacher_accruals' THEN
  IF NEW.exception_authorized_by_id IS NOT NULL THEN PERFORM t03_assert_director(NEW.exception_authorized_by_id,NEW.recognized_at); END IF;
 ELSIF TG_TABLE_NAME='lesson_occurrences' THEN
  IF OLD.actual_start_at IS NOT NULL AND NEW.rate_context_snapshot IS DISTINCT FROM OLD.rate_context_snapshot THEN RAISE EXCEPTION 'Start-time rate evidence is immutable' USING ERRCODE='23514',CONSTRAINT='ck_lesson_rate_context_immutable'; END IF;
 ELSIF TG_TABLE_NAME='payout_attempts' THEN
  IF (to_jsonb(NEW)-'status'-'updated_at') IS DISTINCT FROM (to_jsonb(OLD)-'status'-'updated_at') OR OLD.status IN ('FAILED','RETURNED') OR (OLD.status='SUCCEEDED' AND NEW.status<>'RETURNED') THEN RAISE EXCEPTION 'Payout attempt identity is immutable' USING ERRCODE='23514'; END IF;
 ELSE
  SELECT * INTO doc FROM ledger_documents WHERE id=NEW.document_id;
  IF (doc.distribution_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM payment_distributions WHERE id=doc.distribution_id AND approved_at<=NEW.published_at)) OR
     (doc.consumption_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM entitlement_consumptions WHERE id=doc.consumption_id AND cancelled_at IS NULL AND consumed_at<=NEW.published_at)) THEN
   RAISE EXCEPTION 'Posted financial fact must be authorized' USING ERRCODE='23514',CONSTRAINT='ck_ledger_finance_source';
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER trg_t08_accrual BEFORE INSERT ON teacher_accruals FOR EACH ROW EXECUTE FUNCTION t08_finance_guard();
CREATE TRIGGER trg_t08_rate_context BEFORE UPDATE ON lesson_occurrences FOR EACH ROW EXECUTE FUNCTION t08_finance_guard();
CREATE TRIGGER trg_t08_attempt BEFORE UPDATE ON payout_attempts FOR EACH ROW EXECUTE FUNCTION t08_finance_guard();
CREATE TRIGGER trg_t08_ledger_source BEFORE UPDATE OF published_at ON ledger_entries FOR EACH ROW WHEN (OLD.published_at IS NULL AND NEW.published_at IS NOT NULL) EXECUTE FUNCTION t08_finance_guard();

GRANT SELECT ON teacher_engagements,teacher_tenure_credits,teacher_rate_promises TO online_school_runtime;
REVOKE INSERT,UPDATE,DELETE ON teacher_engagements,teacher_tenure_credits,teacher_rate_promises FROM online_school_runtime;
GRANT SELECT,INSERT,UPDATE ON payment_receipts,payment_distributions,subscriptions,entitlement_consumptions,payroll_obligations,payout_attempts,temporary_access_permissions,crm_tasks TO online_school_runtime;
GRANT SELECT,INSERT ON ledger_documents,teacher_accruals,confirmed_payouts,entitlement_grants,entitlement_adjustments TO online_school_runtime;
GRANT SELECT,INSERT,UPDATE ON financial_periods TO online_school_runtime;
GRANT SELECT ON students,representatives,student_representative_links,households,household_memberships,assigned_managers,teaching_assignments,student_subject_enrollments,subjects,sale_conditions,teacher_accounts,student_accounts,lesson_occurrences,lesson_actual_outcomes TO online_school_runtime;
GRANT SELECT ON auth_accounts,staff_accounts,roles,role_assignments TO online_school_runtime;
GRANT SELECT,INSERT,UPDATE ON sessions,mfa_challenges,webauthn_credentials TO online_school_runtime;
GRANT SELECT,INSERT ON access_revocations TO online_school_runtime;
GRANT UPDATE(recovery_registration_required,updated_at) ON auth_accounts TO online_school_runtime;
-- PostgreSQL row locking requires UPDATE on at least one column. Historical
-- grants remain immutable under trg_t03_*; this privilege only permits locking.
GRANT UPDATE(id) ON entitlement_grants TO online_school_runtime;
GRANT UPDATE(id,actual_start_at,actual_teacher_at_start_id,rate_at_start_snapshot,points_at_start_snapshot,rate_basis_at_start,rate_currency_at_start,rate_context_snapshot,updated_at) ON lesson_occurrences TO online_school_runtime;
COMMIT;
