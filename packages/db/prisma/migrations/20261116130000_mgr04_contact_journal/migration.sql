-- DEV-10/B + 8.2/B: structured, append-only journal of manager contacts. Event time (occurred_at) and
-- server record time (created_at) are separate; a mistake is fixed by a new entry that points at the old one.
BEGIN;
ALTER TYPE "ContactChannel" ADD VALUE IF NOT EXISTS 'WHATSAPP';
ALTER TYPE "ContactChannel" ADD VALUE IF NOT EXISTS 'TELEGRAM';

ALTER TABLE contact_logs
  ADD COLUMN teacher_id uuid,
  ADD COLUMN task_id uuid,
  ADD COLUMN corrects_id uuid,
  ADD COLUMN result text NOT NULL DEFAULT 'OTHER',
  ADD COLUMN next_action text;
ALTER TABLE contact_logs ALTER COLUMN result DROP DEFAULT;
-- The old rule (lead or student) predates teacher contacts; ck_contact_subject below is exact.
ALTER TABLE contact_logs DROP CONSTRAINT ck_contact_target;
ALTER TABLE contact_logs
  ADD CONSTRAINT fk_contact_teacher FOREIGN KEY (teacher_id) REFERENCES teacher_accounts(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT fk_contact_task FOREIGN KEY (task_id) REFERENCES crm_tasks(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT fk_contact_corrects FOREIGN KEY (corrects_id) REFERENCES contact_logs(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT ck_contact_subject CHECK (num_nonnulls(lead_id, student_id, teacher_id) = 1),
  ADD CONSTRAINT ck_contact_representative CHECK (representative_id IS NULL OR student_id IS NOT NULL),
  ADD CONSTRAINT ck_contact_result CHECK (result IN ('REACHED','NO_ANSWER','CALLBACK_REQUESTED','DECLINED','WRONG_CONTACT','OTHER')),
  ADD CONSTRAINT ck_contact_text CHECK (char_length(outcome) BETWEEN 3 AND 300 AND (next_action IS NULL OR char_length(next_action) BETWEEN 3 AND 300));
CREATE INDEX idx_contact_teacher ON contact_logs (teacher_id, occurred_at) WHERE teacher_id IS NOT NULL;
CREATE INDEX idx_contact_task ON contact_logs (task_id) WHERE task_id IS NOT NULL;
CREATE UNIQUE INDEX uq_contact_one_correction ON contact_logs (corrects_id) WHERE corrects_id IS NOT NULL;

CREATE TRIGGER trg_mgr04_contact_history BEFORE UPDATE OR DELETE ON contact_logs
  FOR EACH ROW EXECUTE FUNCTION t03_immutable_record();
GRANT SELECT, INSERT ON contact_logs TO online_school_runtime;
COMMIT;
