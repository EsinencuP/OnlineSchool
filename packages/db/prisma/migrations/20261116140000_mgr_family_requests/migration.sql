-- DEV-17/C and DEV-21/B: a manager formalises a family's request; only the director decides.
-- TEMPORARY_ACCESS: admission to limited lessons while a subscription is only partly paid.
-- REFUND: request to prepare a refund calculation; approving it moves no money (the calculation and its
-- execution are separate director/manager steps).
BEGIN;
CREATE TABLE manager_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind            text NOT NULL,
  student_id      uuid NOT NULL,
  subscription_id uuid NOT NULL,
  requested_by_id uuid NOT NULL,
  reason          text NOT NULL,
  proposed_lessons integer,
  proposed_until  timestamptz(3),
  status          text NOT NULL DEFAULT 'PENDING',
  requested_at    timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
  decided_by_id   uuid,
  decided_at      timestamptz(3),
  decision_note   text,
  permission_id   uuid,
  CONSTRAINT ck_manager_request_kind CHECK (kind IN ('TEMPORARY_ACCESS','REFUND')),
  CONSTRAINT ck_manager_request_status CHECK (status IN ('PENDING','APPROVED','DECLINED','WITHDRAWN')),
  CONSTRAINT ck_manager_request_reason CHECK (char_length(reason) BETWEEN 5 AND 500),
  CONSTRAINT ck_manager_request_note CHECK (decision_note IS NULL OR char_length(decision_note) BETWEEN 3 AND 500),
  CONSTRAINT ck_manager_request_decided CHECK ((status = 'PENDING') = (decided_at IS NULL) AND (decided_at IS NULL) = (decided_by_id IS NULL)),
  CONSTRAINT ck_manager_request_proposal CHECK (
    (proposed_lessons IS NULL OR proposed_lessons >= 1)
    AND (kind = 'TEMPORARY_ACCESS' OR (proposed_lessons IS NULL AND proposed_until IS NULL AND permission_id IS NULL))),
  CONSTRAINT manager_requests_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT manager_requests_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT manager_requests_requested_by_id_fkey FOREIGN KEY (requested_by_id) REFERENCES staff_accounts(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT manager_requests_decided_by_id_fkey FOREIGN KEY (decided_by_id) REFERENCES staff_accounts(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT manager_requests_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES temporary_access_permissions(id) ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE UNIQUE INDEX uq_manager_request_pending ON manager_requests (subscription_id, kind) WHERE status = 'PENDING';
CREATE INDEX idx_manager_requests_student ON manager_requests (student_id, requested_at);
CREATE INDEX idx_manager_requests_pending ON manager_requests (requested_at, id) WHERE status = 'PENDING';

CREATE FUNCTION mgr_request_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status <> 'PENDING' THEN
    RAISE EXCEPTION 'Decided request is immutable' USING ERRCODE = '23514';
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.kind IS DISTINCT FROM OLD.kind OR NEW.student_id IS DISTINCT FROM OLD.student_id
     OR NEW.subscription_id IS DISTINCT FROM OLD.subscription_id OR NEW.requested_by_id IS DISTINCT FROM OLD.requested_by_id
     OR NEW.reason IS DISTINCT FROM OLD.reason OR NEW.proposed_lessons IS DISTINCT FROM OLD.proposed_lessons
     OR NEW.proposed_until IS DISTINCT FROM OLD.proposed_until OR NEW.requested_at IS DISTINCT FROM OLD.requested_at THEN
    RAISE EXCEPTION 'Request facts are immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_mgr_request_guard BEFORE UPDATE ON manager_requests FOR EACH ROW EXECUTE FUNCTION mgr_request_guard();
CREATE TRIGGER trg_mgr_request_no_delete BEFORE DELETE ON manager_requests FOR EACH ROW EXECUTE FUNCTION t03_immutable_record();

REVOKE ALL ON manager_requests FROM PUBLIC;
GRANT SELECT, INSERT ON manager_requests TO online_school_runtime;
GRANT UPDATE (status, decided_by_id, decided_at, decision_note, permission_id) ON manager_requests TO online_school_runtime;
COMMIT;
