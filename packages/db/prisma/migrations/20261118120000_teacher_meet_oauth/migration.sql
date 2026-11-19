BEGIN;

CREATE TABLE teacher_meet_oauth_challenges (
  teacher_id uuid PRIMARY KEY REFERENCES teacher_accounts(id) ON DELETE CASCADE ON UPDATE RESTRICT,
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE ON UPDATE RESTRICT,
  state_hash char(64) NOT NULL,
  verifier_ciphertext text NOT NULL,
  grant_generation integer NOT NULL,
  expires_at timestamptz(3) NOT NULL,
  claimed_at timestamptz(3),
  CONSTRAINT ck_teacher_meet_oauth_challenge CHECK (
    state_hash ~ '^[a-f0-9]{64}$'
    AND verifier_ciphertext ~ '^v1\.[A-Za-z0-9_-]{1,40}\.[A-Za-z0-9_-]{39,512}$'
    AND grant_generation>=0
    AND (claimed_at IS NULL OR claimed_at<expires_at)
  )
);
CREATE UNIQUE INDEX teacher_meet_oauth_challenges_state_hash_key ON teacher_meet_oauth_challenges(state_hash);
CREATE INDEX teacher_meet_oauth_challenges_session_id_idx ON teacher_meet_oauth_challenges(session_id);

CREATE TABLE teacher_meet_oauth_grants (
  teacher_id uuid PRIMARY KEY REFERENCES teacher_accounts(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  google_subject text NOT NULL,
  generation integer NOT NULL,
  refresh_ciphertext text,
  authorized_at timestamptz(3) NOT NULL,
  disconnected_at timestamptz(3),
  provider_revoked_at timestamptz(3),
  revocation_claim_id uuid,
  revocation_claimed_at timestamptz(3),
  CONSTRAINT ck_teacher_meet_oauth_grant CHECK (
    generation>0 AND google_subject ~ '^[A-Za-z0-9_-]{1,255}$'
    AND (refresh_ciphertext IS NULL OR refresh_ciphertext ~ '^v1\.[A-Za-z0-9_-]{1,40}\.[A-Za-z0-9_-]{39,14000}$')
    AND (disconnected_at IS NULL OR disconnected_at>=authorized_at)
    AND num_nonnulls(revocation_claim_id,revocation_claimed_at) IN (0,2)
    AND (revocation_claim_id IS NULL OR
      (disconnected_at IS NOT NULL AND provider_revoked_at IS NULL AND revocation_claimed_at>=disconnected_at))
    AND ((provider_revoked_at IS NULL AND refresh_ciphertext IS NOT NULL)
      OR (disconnected_at IS NOT NULL AND provider_revoked_at IS NOT NULL
        AND provider_revoked_at>=disconnected_at AND refresh_ciphertext IS NULL))
  )
);
CREATE UNIQUE INDEX uq_teacher_meet_oauth_active_subject ON teacher_meet_oauth_grants(google_subject)
  WHERE refresh_ciphertext IS NOT NULL;

REVOKE ALL ON teacher_meet_oauth_challenges,teacher_meet_oauth_grants FROM PUBLIC;
GRANT SELECT,INSERT,UPDATE,DELETE ON teacher_meet_oauth_challenges TO online_school_runtime;
GRANT SELECT,INSERT,UPDATE ON teacher_meet_oauth_grants TO online_school_runtime;

CREATE FUNCTION disconnect_meet_on_teacher_deactivation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM teacher_meet_oauth_challenges WHERE teacher_id=NEW.id;
  UPDATE teacher_meet_oauth_grants
    SET disconnected_at=greatest(NEW.deactivated_at,authorized_at)
    WHERE teacher_id=NEW.id AND disconnected_at IS NULL;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_disconnect_meet_on_teacher_deactivation
  AFTER UPDATE OF deactivated_at ON teacher_accounts
  FOR EACH ROW WHEN (OLD.deactivated_at IS NULL AND NEW.deactivated_at IS NOT NULL)
  EXECUTE FUNCTION disconnect_meet_on_teacher_deactivation();

COMMIT;
