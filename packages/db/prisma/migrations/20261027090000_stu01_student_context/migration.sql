-- Forward-only StudentModule support. Existing STUDENT logins must replace their temporary password.
-- STAFF and TEACHER accounts are unaffected; no financial or activation constraint is weakened.
BEGIN;
ALTER TABLE student_accounts ADD COLUMN must_change_password boolean NOT NULL DEFAULT true;
COMMIT;
