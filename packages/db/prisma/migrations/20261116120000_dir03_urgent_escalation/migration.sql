-- OPS-01/B: manager working status and the server-side escalation of urgent tasks to the director.
-- Neither table is a financial fact; escalation rows are append-only except for the one-time director acceptance.
BEGIN;
CREATE TABLE manager_availability (
  manager_id uuid PRIMARY KEY,
  status     text NOT NULL,
  changed_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_manager_availability_status CHECK (status IN ('AVAILABLE','UNAVAILABLE','OFF_SHIFT')),
  CONSTRAINT manager_availability_manager_id_fkey FOREIGN KEY (manager_id)
    REFERENCES staff_accounts(id) ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE TABLE task_escalations (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id            uuid NOT NULL,
  primary_manager_id uuid,
  reason             text NOT NULL,
  manager_status     text NOT NULL,
  accept_due_at      timestamptz(3) NOT NULL,
  escalated_at       timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
  accepted_by_id     uuid,
  accepted_at        timestamptz(3),
  CONSTRAINT uq_task_escalation_task UNIQUE (task_id),
  CONSTRAINT ck_task_escalation_reason CHECK (reason IN ('MANAGER_UNAVAILABLE','ACCEPT_TIMEOUT')),
  CONSTRAINT ck_task_escalation_status CHECK (manager_status IN ('AVAILABLE','UNAVAILABLE','OFF_SHIFT','UNASSIGNED')),
  CONSTRAINT ck_task_escalation_accept CHECK ((accepted_by_id IS NULL) = (accepted_at IS NULL)),
  CONSTRAINT task_escalations_task_id_fkey FOREIGN KEY (task_id)
    REFERENCES crm_tasks(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT task_escalations_primary_manager_id_fkey FOREIGN KEY (primary_manager_id)
    REFERENCES staff_accounts(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT task_escalations_accepted_by_id_fkey FOREIGN KEY (accepted_by_id)
    REFERENCES staff_accounts(id) ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE INDEX idx_task_escalations_open ON task_escalations (escalated_at, id) WHERE accepted_at IS NULL;

CREATE FUNCTION dir03_escalation_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Accepted escalation is immutable' USING ERRCODE = '23514';
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.task_id IS DISTINCT FROM OLD.task_id
     OR NEW.primary_manager_id IS DISTINCT FROM OLD.primary_manager_id OR NEW.reason IS DISTINCT FROM OLD.reason
     OR NEW.manager_status IS DISTINCT FROM OLD.manager_status OR NEW.accept_due_at IS DISTINCT FROM OLD.accept_due_at
     OR NEW.escalated_at IS DISTINCT FROM OLD.escalated_at THEN
    RAISE EXCEPTION 'Escalation facts are immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_dir03_escalation_guard BEFORE UPDATE ON task_escalations
  FOR EACH ROW EXECUTE FUNCTION dir03_escalation_guard();
CREATE TRIGGER trg_dir03_escalation_no_delete BEFORE DELETE ON task_escalations
  FOR EACH ROW EXECUTE FUNCTION t03_immutable_record();

REVOKE ALL ON manager_availability, task_escalations FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON manager_availability TO online_school_runtime;
GRANT SELECT, INSERT ON task_escalations TO online_school_runtime;
GRANT UPDATE (accepted_by_id, accepted_at) ON task_escalations TO online_school_runtime;
COMMIT;
