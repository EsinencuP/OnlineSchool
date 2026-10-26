-- SQL-only invariants are part of the reviewed migration history.
-- Prisma partialIndexes represents the partial UNIQUE indexes in the first migration.
BEGIN;

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "household_memberships"
  ADD CONSTRAINT "ck_membership_one_person"
    CHECK (num_nonnulls(student_id, representative_id) = 1),
  ADD CONSTRAINT "ck_membership_period"
    CHECK (valid_to IS NULL OR valid_to > valid_from),
  ADD CONSTRAINT "ck_membership_status_period"
    CHECK ((status = 'ACTIVE' AND valid_to IS NULL)
       OR (status = 'ENDED' AND valid_to IS NOT NULL)
       OR status = 'CANCELLED'),
  ADD CONSTRAINT "ex_student_household_period"
    EXCLUDE USING gist (
      student_id WITH =,
      tstzrange(valid_from, valid_to, '[)') WITH &&
    ) WHERE (student_id IS NOT NULL AND status IN ('ACTIVE', 'ENDED'));

ALTER TABLE "student_representative_links"
  ADD CONSTRAINT "ck_relation_period"
    CHECK (valid_to IS NULL OR valid_to > valid_from),
  ADD CONSTRAINT "ck_relation_verification"
    CHECK (verification_status <> 'VERIFIED'
      OR (verified_at IS NOT NULL AND verified_by_staff_id IS NOT NULL)),
  ADD CONSTRAINT "ck_relation_basis" CHECK (length(trim(basis)) > 0);

ALTER TABLE "relationship_verifications"
  ADD CONSTRAINT "ck_verification_result" CHECK (result <> 'PENDING'),
  ADD CONSTRAINT "ck_verification_basis" CHECK (length(trim(basis)) > 0);

ALTER TABLE "auth_accounts"
  ADD CONSTRAINT "ck_account_login" CHECK (length(trim(login_id)) > 0);

ALTER TABLE "student_accounts"
  ADD CONSTRAINT "ck_student_account_kind" CHECK (account_kind = 'STUDENT'),
  ADD CONSTRAINT "ck_student_account_period"
    CHECK (deactivated_at IS NULL OR deactivated_at >= activated_at),
  -- CON-02/B: every incomplete payment needs its own limited director decision.
  -- Finance FK and actual paid-total verification are deferred to TASK-03/05.
  ADD CONSTRAINT "ck_student_activation_admission"
    CHECK ((activation_basis = 'FULL_PAYMENT' AND activation_director_admission_id IS NULL)
       OR (activation_basis = 'LIMITED_DIRECTOR_ADMISSION' AND activation_director_admission_id IS NOT NULL));

ALTER TABLE "staff_accounts"
  ADD CONSTRAINT "ck_staff_account_kind" CHECK (account_kind = 'STAFF');

ALTER TABLE "teacher_accounts"
  ADD CONSTRAINT "ck_teacher_account_kind" CHECK (account_kind = 'TEACHER');

ALTER TABLE "role_assignments"
  ADD CONSTRAINT "ck_role_assignment_period"
    CHECK (valid_to IS NULL OR valid_to > valid_from),
  ADD CONSTRAINT "ex_account_role_period"
    EXCLUDE USING gist (
      account_id WITH =,
      role_id WITH =,
      tstzrange(valid_from, valid_to, '[)') WITH &&
    );

-- Prevent a student/teacher principal from being assigned a staff role by mistake.
-- This is structural integrity, not a substitute for the future grant/revoke ACL.
CREATE FUNCTION check_role_account_kind() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  principal_kind "AccountKind";
  assigned_role "RoleCode";
BEGIN
  SELECT kind INTO principal_kind FROM auth_accounts WHERE id = NEW.account_id;
  SELECT code INTO assigned_role FROM roles WHERE id = NEW.role_id;
  IF (principal_kind = 'STUDENT' AND assigned_role <> 'STUDENT')
     OR (principal_kind = 'TEACHER' AND assigned_role <> 'TEACHER')
     OR (principal_kind = 'STAFF' AND assigned_role NOT IN ('DIRECTOR', 'MANAGER', 'TECH_OPERATOR')) THEN
    RAISE EXCEPTION 'Role is incompatible with account kind'
      USING ERRCODE = '23514', CONSTRAINT = 'ck_role_account_kind';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_role_account_kind
  BEFORE INSERT OR UPDATE ON role_assignments
  FOR EACH ROW EXECUTE FUNCTION check_role_account_kind();

-- A role code is a stable identity. Renaming would change every historical grant.
CREATE FUNCTION protect_role_code() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.code IS DISTINCT FROM OLD.code THEN
    RAISE EXCEPTION 'Role code is immutable'
      USING ERRCODE = '23514', CONSTRAINT = 'ck_role_code_immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_role_code_immutable
  BEFORE UPDATE OF code ON roles
  FOR EACH ROW EXECUTE FUNCTION protect_role_code();

CREATE FUNCTION protect_account_kind() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.kind IS DISTINCT FROM OLD.kind THEN
    RAISE EXCEPTION 'Account kind is immutable'
      USING ERRCODE = '23514', CONSTRAINT = 'ck_account_kind_immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_account_kind_immutable
  BEFORE UPDATE OF kind ON auth_accounts
  FOR EACH ROW EXECUTE FUNCTION protect_account_kind();

-- The finance confirmation itself must become an FK in TASK-03/05.
-- For now, at least the recorded confirming actor must be a director at activation time.
CREATE FUNCTION check_student_activation_director() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM staff_accounts staff
    JOIN auth_accounts account ON account.id = staff.account_id
    JOIN role_assignments assignment ON assignment.account_id = account.id
    JOIN roles role ON role.id = assignment.role_id
    WHERE staff.id = NEW.activation_confirmed_by_staff_id
      AND role.code = 'DIRECTOR'
      AND assignment.valid_from <= NEW.activated_at
      AND (assignment.valid_to IS NULL OR assignment.valid_to > NEW.activated_at)
      AND (staff.deactivated_at IS NULL OR staff.deactivated_at > NEW.activated_at)
      AND (account.disabled_at IS NULL OR account.disabled_at > NEW.activated_at)
  ) THEN
    RAISE EXCEPTION 'Student activation requires a director confirmation'
      USING ERRCODE = '23514', CONSTRAINT = 'ck_student_activation_director';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_student_activation_director
  BEFORE INSERT OR UPDATE OF activation_confirmed_by_staff_id, activated_at ON student_accounts
  FOR EACH ROW EXECUTE FUNCTION check_student_activation_director();

ALTER TABLE "sessions"
  ADD CONSTRAINT "ck_session_expiry" CHECK (expires_at > created_at),
  ADD CONSTRAINT "ck_session_token_hash" CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "ck_session_csrf_hash"
    CHECK (csrf_token_hash IS NULL OR csrf_token_hash ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "ck_session_revocation"
    CHECK (revoked_at IS NULL OR revoked_at >= created_at),
  ADD CONSTRAINT "ck_session_mfa_time"
    CHECK (mfa_verified_at IS NULL OR (mfa_verified_at >= created_at AND mfa_verified_at < expires_at));

ALTER TABLE "mfa_challenges"
  ADD CONSTRAINT "ck_challenge_expiry" CHECK (expires_at > created_at),
  ADD CONSTRAINT "ck_challenge_hash" CHECK (challenge_hash ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "ck_challenge_used_time"
    CHECK (used_at IS NULL OR (used_at >= created_at AND used_at < expires_at));

ALTER TABLE "webauthn_credentials"
  ADD CONSTRAINT "ck_credential_sign_count" CHECK (sign_count BETWEEN 0 AND 4294967295),
  ADD CONSTRAINT "ck_credential_id" CHECK (octet_length(credential_id) > 0),
  ADD CONSTRAINT "ck_credential_public_key" CHECK (octet_length(public_key) > 0),
  ADD CONSTRAINT "ck_credential_backup" CHECK (NOT backed_up OR backup_eligible);

ALTER TABLE "access_revocations"
  ADD CONSTRAINT "ck_revocation_reason" CHECK (length(trim(reason)) > 0),
  ADD CONSTRAINT "ck_revocation_source" CHECK (length(trim(source)) > 0);

ALTER TABLE "lead_student_links"
  ADD CONSTRAINT "ck_lead_link_period"
    CHECK (unlinked_at IS NULL OR unlinked_at >= linked_at),
  ADD CONSTRAINT "ck_lead_link_basis" CHECK (length(trim(basis)) > 0);

ALTER TABLE "assigned_managers"
  ADD CONSTRAINT "ck_manager_one_target" CHECK (num_nonnulls(lead_id, student_id) = 1),
  ADD CONSTRAINT "ck_manager_period" CHECK (ended_at IS NULL OR ended_at > assigned_at);

ALTER TABLE "contact_logs"
  ADD CONSTRAINT "ck_contact_target" CHECK (num_nonnulls(lead_id, student_id) >= 1);

ALTER TABLE "crm_tasks"
  ADD CONSTRAINT "ck_task_target" CHECK (num_nonnulls(lead_id, student_id) >= 1),
  ADD CONSTRAINT "ck_task_resolution"
    CHECK ((status = 'RESOLVED' AND resolved_at IS NOT NULL AND resolved_by_staff_id IS NOT NULL)
       OR (status <> 'RESOLVED' AND resolved_at IS NULL AND resolved_by_staff_id IS NULL));

-- Stable role dictionary only. No user, password, session or privilege grant is seeded.
INSERT INTO roles (id, code)
SELECT gen_random_uuid(), value::"RoleCode"
FROM unnest(ARRAY['DIRECTOR', 'MANAGER', 'TEACHER', 'STUDENT', 'TECH_OPERATOR']) AS value;

COMMIT;
