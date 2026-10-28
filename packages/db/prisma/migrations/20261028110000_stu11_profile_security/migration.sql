BEGIN;
ALTER TABLE students ADD COLUMN display_name text,ADD COLUMN avatar_file_id uuid,
  ADD CONSTRAINT students_avatar_file_id_fkey FOREIGN KEY(avatar_file_id) REFERENCES s3_objects(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT ck_stu11_display_name CHECK(display_name IS NULL OR (length(btrim(display_name)) BETWEEN 1 AND 100 AND display_name !~ '[[:cntrl:]]'));
ALTER TABLE staff_accounts ADD COLUMN student_whatsapp_url text,ADD COLUMN student_telegram_url text,
  ADD CONSTRAINT ck_stu11_whatsapp CHECK(student_whatsapp_url IS NULL OR student_whatsapp_url~'^https://wa\.me/[1-9][0-9]{6,14}/?$'),
  ADD CONSTRAINT ck_stu11_telegram CHECK(student_telegram_url IS NULL OR student_telegram_url~'^https://t\.me/[a-zA-Z0-9_]{5,32}/?$');
ALTER TABLE sessions ADD COLUMN user_agent text,ADD COLUMN ip_address inet,
  ADD CONSTRAINT ck_stu11_session_agent CHECK(user_agent IS NULL OR (length(user_agent)<=512 AND user_agent !~ '[[:cntrl:]]'));
ALTER TABLE auth_accounts ADD COLUMN email_verified_at timestamptz(3);
CREATE TABLE student_email_changes (
  id uuid PRIMARY KEY,account_id uuid NOT NULL,student_id uuid NOT NULL,new_email text NOT NULL,otp_hash char(64) NOT NULL,
  issued_at timestamptz(3) NOT NULL,expires_at timestamptz(3) NOT NULL,attempts integer NOT NULL DEFAULT 0,
  sent_at timestamptz(3),used_at timestamptz(3),revoked_at timestamptz(3),
  CONSTRAINT student_email_changes_account_id_fkey FOREIGN KEY(account_id) REFERENCES auth_accounts(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT student_email_changes_student_id_fkey FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT ck_stu11_email_change CHECK(otp_hash~'^[a-f0-9]{64}$' AND expires_at=issued_at+interval '10 minutes' AND attempts BETWEEN 0 AND 5
    AND new_email=lower(btrim(new_email)) AND length(new_email)<=254 AND new_email~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    AND (sent_at IS NULL OR sent_at>=issued_at) AND (revoked_at IS NULL OR revoked_at>=issued_at)
    AND (used_at IS NULL OR (used_at>=issued_at AND used_at<expires_at AND attempts<5 AND revoked_at IS NULL)))
);
CREATE UNIQUE INDEX uq_stu11_pending_email ON student_email_changes(account_id) WHERE used_at IS NULL AND revoked_at IS NULL;
CREATE INDEX student_email_changes_account_id_issued_at_idx ON student_email_changes(account_id,issued_at);

CREATE FUNCTION stu11_guard_avatar() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.avatar_file_id IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Avatar can be selected only after pupil activation'; END IF;
    RETURN NEW;
  END IF;
  IF NEW.avatar_file_id IS DISTINCT FROM OLD.avatar_file_id AND NEW.avatar_file_id IS NOT NULL THEN
    PERFORM 1 FROM public.s3_objects f JOIN public.student_accounts a ON a.account_id=f.uploaded_by
      WHERE f.id=NEW.avatar_file_id AND a.student_id=NEW.id AND a.deactivated_at IS NULL
      AND f.status='VERIFIED' AND f.verified_at<=clock_timestamp() AND f.size BETWEEN 1 AND 2097152
      AND f.content_type IN('image/jpeg','image/png','image/webp') FOR SHARE OF f;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Avatar must be a verified owned raster image'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_stu11_avatar BEFORE INSERT OR UPDATE OF avatar_file_id ON students FOR EACH ROW EXECUTE FUNCTION stu11_guard_avatar();

CREATE FUNCTION stu11_guard_email_change() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.issued_at>clock_timestamp() OR NEW.attempts<>0 OR num_nonnulls(NEW.sent_at,NEW.used_at,NEW.revoked_at)<>0 OR NOT EXISTS(
      SELECT 1 FROM public.student_accounts a JOIN public.auth_accounts u ON u.id=a.account_id
      WHERE a.student_id=NEW.student_id AND a.account_id=NEW.account_id AND a.deactivated_at IS NULL AND a.activated_at<=NEW.issued_at
        AND NOT a.must_change_password AND u.kind='STUDENT' AND u.disabled_at IS NULL AND u.login_id<>NEW.new_email
    ) THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Email challenge needs its current verified student context'; END IF;
  ELSIF (NEW.id,NEW.account_id,NEW.student_id,NEW.new_email,NEW.otp_hash,NEW.issued_at,NEW.expires_at) IS DISTINCT FROM
    (OLD.id,OLD.account_id,OLD.student_id,OLD.new_email,OLD.otp_hash,OLD.issued_at,OLD.expires_at)
    OR NEW.attempts NOT IN(OLD.attempts,OLD.attempts+1)
    OR (OLD.used_at IS NOT NULL AND NEW IS DISTINCT FROM OLD) OR (OLD.revoked_at IS NOT NULL AND NEW IS DISTINCT FROM OLD)
    OR (OLD.sent_at IS NOT NULL AND NEW.sent_at IS DISTINCT FROM OLD.sent_at)
    OR NEW.used_at>clock_timestamp() OR NEW.revoked_at>clock_timestamp() OR NEW.sent_at>clock_timestamp() THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Email challenge identity, first delivery and terminal state are immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_stu11_email_change BEFORE INSERT OR UPDATE ON student_email_changes FOR EACH ROW EXECUTE FUNCTION stu11_guard_email_change();
CREATE TRIGGER trg_stu11_email_change_no_delete BEFORE DELETE ON student_email_changes FOR EACH ROW EXECUTE FUNCTION t03_immutable_record();

CREATE FUNCTION stu11_guard_login_email() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF NEW.kind='STUDENT' AND (NEW.login_id,NEW.email_verified_at) IS DISTINCT FROM (OLD.login_id,OLD.email_verified_at) AND NOT EXISTS(
    SELECT 1 FROM public.student_email_changes c WHERE c.account_id=NEW.id AND c.new_email=NEW.login_id
      AND c.used_at=NEW.email_verified_at AND c.used_at<=clock_timestamp() AND c.used_at<c.expires_at AND c.revoked_at IS NULL
  ) THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Student login email requires consumed verification in the same transaction'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_stu11_login_email BEFORE UPDATE OF login_id,email_verified_at ON auth_accounts FOR EACH ROW EXECUTE FUNCTION stu11_guard_login_email();

CREATE FUNCTION stu11_email_commit_state() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF NEW.used_at IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.auth_accounts a
    WHERE a.id=NEW.account_id AND a.login_id=NEW.new_email AND a.email_verified_at=NEW.used_at) THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Consumed email challenge and verified login must commit together';
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER trg_stu11_email_commit AFTER UPDATE ON student_email_changes DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION stu11_email_commit_state();

CREATE FUNCTION stu11_credentials_revoke_email() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF NEW.kind='STUDENT' AND (NEW.password_hash IS DISTINCT FROM OLD.password_hash OR NEW.disabled_at IS NOT NULL) THEN
    UPDATE public.student_email_changes SET revoked_at=date_trunc('milliseconds',clock_timestamp())
      WHERE account_id=NEW.id AND used_at IS NULL AND revoked_at IS NULL;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_stu11_credentials_email AFTER UPDATE OF password_hash,disabled_at ON auth_accounts FOR EACH ROW EXECUTE FUNCTION stu11_credentials_revoke_email();

CREATE FUNCTION stu11_session_metadata() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF (NEW.user_agent,NEW.ip_address) IS DISTINCT FROM (OLD.user_agent,OLD.ip_address) THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Session observed device metadata is immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_stu11_session_metadata BEFORE UPDATE OF user_agent,ip_address ON sessions FOR EACH ROW EXECUTE FUNCTION stu11_session_metadata();
GRANT SELECT,INSERT,UPDATE ON student_email_changes TO online_school_runtime;
REVOKE DELETE,TRUNCATE ON student_email_changes FROM online_school_runtime;
COMMIT;
