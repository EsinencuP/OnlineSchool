-- Forward-only least-privilege grants for the existing student security/profile commands.
-- Previous migrations added these commands/columns but omitted their runtime UPDATE grants.
BEGIN;
GRANT UPDATE(password_hash,login_id,email_verified_at,updated_at) ON auth_accounts TO online_school_runtime;
GRANT UPDATE(must_change_password,updated_at) ON student_accounts TO online_school_runtime;
GRANT UPDATE(display_name,avatar_file_id,updated_at) ON students TO online_school_runtime;
COMMIT;
