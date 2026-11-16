-- Teacher cabinet: private study materials (staged upload -> verified object -> per-student grant)
-- and the one self-service contact field a teacher may change (phone).
CREATE TABLE teacher_material_uploads (
  file_id      uuid PRIMARY KEY,
  teacher_id   uuid NOT NULL,
  staging_key  text NOT NULL UNIQUE,
  expires_at   timestamptz(3) NOT NULL,
  confirmed_at timestamptz(3),
  created_at   timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_teacher_material_staging CHECK (staging_key ~ '^materials/incoming/[0-9a-f-]{36}$'),
  CONSTRAINT teacher_material_uploads_file_id_fkey FOREIGN KEY (file_id)
    REFERENCES s3_objects(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT teacher_material_uploads_teacher_id_fkey FOREIGN KEY (teacher_id)
    REFERENCES teacher_accounts(id) ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE INDEX idx_teacher_material_uploads_teacher ON teacher_material_uploads(teacher_id, created_at);
REVOKE ALL ON teacher_material_uploads FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON teacher_material_uploads TO online_school_runtime;
-- Grants are validated by stu06_guard_material_context(); revocation is the only allowed update.
GRANT INSERT ON file_permissions TO online_school_runtime;
GRANT UPDATE (revoked_at, revoked_by, updated_at) ON file_permissions TO online_school_runtime;
GRANT UPDATE (phone, updated_at) ON teacher_accounts TO online_school_runtime;
