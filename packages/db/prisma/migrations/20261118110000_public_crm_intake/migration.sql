BEGIN;

ALTER TABLE leads
  ADD COLUMN public_submission_id uuid,
  ADD COLUMN public_submission_hash char(64),
  ADD COLUMN public_privacy_notice text,
  ADD COLUMN public_duplicate_suspected boolean NOT NULL DEFAULT false,
  ADD CONSTRAINT ck_lead_public_submission CHECK (
    num_nonnulls(public_submission_id,public_submission_hash,public_privacy_notice) IN (0,3)
    AND (public_submission_hash IS NULL OR public_submission_hash ~ '^[a-f0-9]{64}$')
    AND (public_privacy_notice IS NULL OR public_privacy_notice ~ '^[a-zA-Z0-9._-]{1,60}$')
    AND (public_submission_id IS NOT NULL OR NOT public_duplicate_suspected)
  );
CREATE UNIQUE INDEX leads_public_submission_id_key ON leads(public_submission_id);

CREATE FUNCTION guard_public_lead_submission() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(OLD.public_submission_id,OLD.public_submission_hash,OLD.public_privacy_notice,OLD.public_duplicate_suspected)
    IS DISTINCT FROM ROW(NEW.public_submission_id,NEW.public_submission_hash,NEW.public_privacy_notice,NEW.public_duplicate_suspected) THEN
    RAISE EXCEPTION 'Original public intake metadata is immutable' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_public_lead_submission BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION guard_public_lead_submission();

COMMIT;
