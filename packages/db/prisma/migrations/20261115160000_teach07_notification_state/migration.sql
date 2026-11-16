-- Teacher work notifications are derived from existing facts (lessons, submissions, checkpoints,
-- requests); only the "read" state is stored: individual event keys plus a "read everything before" mark.
CREATE TABLE teacher_notification_reads (
  teacher_id uuid NOT NULL,
  event_key  text NOT NULL,
  read_at    timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (teacher_id, event_key),
  CONSTRAINT ck_teacher_notification_key CHECK (event_key ~ '^[a-z-]+:[0-9a-f-]{36}$'),
  CONSTRAINT teacher_notification_reads_teacher_id_fkey FOREIGN KEY (teacher_id)
    REFERENCES teacher_accounts(id) ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE TABLE teacher_notification_state (
  teacher_id      uuid PRIMARY KEY,
  read_all_before timestamptz(3) NOT NULL,
  updated_at      timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT teacher_notification_state_teacher_id_fkey FOREIGN KEY (teacher_id)
    REFERENCES teacher_accounts(id) ON DELETE RESTRICT ON UPDATE RESTRICT
);
REVOKE ALL ON teacher_notification_reads, teacher_notification_state FROM PUBLIC;
GRANT SELECT, INSERT ON teacher_notification_reads TO online_school_runtime;
GRANT SELECT, INSERT, UPDATE ON teacher_notification_state TO online_school_runtime;
