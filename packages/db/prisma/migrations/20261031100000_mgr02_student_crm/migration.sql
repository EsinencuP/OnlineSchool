BEGIN;
ALTER TABLE students ADD COLUMN version integer NOT NULL DEFAULT 1,
  ADD COLUMN manager_note text,
  ADD CONSTRAINT ck_mgr02_version CHECK(version > 0),
  ADD CONSTRAINT ck_mgr02_note CHECK(manager_note IS NULL OR length(manager_note)<=2000);
CREATE INDEX idx_mgr02_student_name ON students(full_name,id);
CREATE INDEX idx_mgr02_student_created ON students(created_at,id);
CREATE INDEX idx_mgr02_portfolio ON assigned_managers(manager_id,ended_at,assigned_at,student_id);
CREATE INDEX idx_mgr02_student_tasks ON crm_tasks(student_id,status,due_at,id);
CREATE INDEX idx_mgr02_student_payments ON payment_receipts(student_id,registered_at,id);
-- Include other writers of these CRM fields in optimistic locking. No data is rewritten.
CREATE FUNCTION mgr02_student_version() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF ROW(NEW.full_name,NEW.phone,NEW.email,NEW.manager_note) IS DISTINCT FROM
     ROW(OLD.full_name,OLD.phone,OLD.email,OLD.manager_note) OR NEW.version<>OLD.version THEN
    NEW.version:=OLD.version+1;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_mgr02_student_version BEFORE UPDATE ON students
  FOR EACH ROW EXECUTE FUNCTION mgr02_student_version();
GRANT UPDATE(phone,email,manager_note,version,updated_at) ON students TO online_school_runtime;
GRANT INSERT(id,full_name,phone,email,manager_note,version,created_at,updated_at) ON students TO online_school_runtime;
GRANT INSERT(id,full_name,created_at,updated_at) ON representatives TO online_school_runtime;
GRANT INSERT(id,student_id,representative_id,role,basis,verification_status,valid_from,created_at,updated_at)
  ON student_representative_links TO online_school_runtime;
GRANT UPDATE(valid_to,updated_at) ON student_representative_links TO online_school_runtime;
GRANT INSERT(id,manager_id,student_id,assigned_at,created_at,updated_at) ON assigned_managers TO online_school_runtime;
-- Optional acceleration: do not install extensions or assume elevated extension privileges.
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM pg_extension WHERE extname='pg_trgm') THEN
    EXECUTE 'CREATE INDEX idx_mgr02_student_search ON students USING gin(lower(full_name) gin_trgm_ops)';
  END IF;
END $$;
COMMIT;
