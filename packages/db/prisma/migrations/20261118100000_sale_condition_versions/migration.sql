BEGIN;

ALTER TABLE sale_conditions
  ADD COLUMN published_by_id uuid REFERENCES staff_accounts(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD COLUMN publication_basis text,
  ADD COLUMN retired_by_id uuid REFERENCES staff_accounts(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD COLUMN retirement_basis text,
  ADD CONSTRAINT ck_sale_publication_basis CHECK (
    num_nonnulls(published_by_id,publication_basis) IN (0,2)
    AND (publication_basis IS NULL OR length(trim(publication_basis)) BETWEEN 5 AND 500)
  ),
  ADD CONSTRAINT ck_sale_retirement_basis CHECK (
    num_nonnulls(retired_by_id,retirement_basis) IN (0,2)
    AND (retirement_basis IS NULL OR (valid_to IS NOT NULL AND length(trim(retirement_basis)) BETWEEN 5 AND 500))
  );

CREATE FUNCTION guard_sale_condition_version() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE stored_version int;
BEGIN
  IF TG_OP='DELETE' THEN
    IF OLD.published_by_id IS NOT NULL OR current_user='online_school_runtime' THEN
      RAISE EXCEPTION 'Published sale version cannot be deleted' USING ERRCODE='23514';
    END IF;
    RETURN OLD;
  END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.published_by_id IS NULL THEN
      IF current_user='online_school_runtime' THEN
        RAISE EXCEPTION 'Director sale publication required' USING ERRCODE='23514';
      END IF;
      RETURN NEW;
    END IF;
    PERFORM t03_assert_director(NEW.published_by_id,NEW.valid_from);
    PERFORM pg_advisory_xact_lock(hashtextextended('sale-condition:' || NEW.code,0));
    SELECT coalesce(max(version),0) INTO stored_version FROM sale_conditions WHERE code=NEW.code;
    IF NEW.version<>stored_version+1 OR NEW.valid_to IS NOT NULL OR NEW.retired_by_id IS NOT NULL
      OR NEW.duration_days IS NULL OR NEW.currency<>'MDL' OR NEW.lesson_unit_price*NEW.lesson_count<>NEW.price
      OR EXISTS (SELECT 1 FROM sale_conditions WHERE code=NEW.code AND (valid_to IS NULL OR valid_to>NEW.valid_from)) THEN
      RAISE EXCEPTION 'Sale requires exact unit allocation and a new non-overlapping version' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.published_by_id IS NOT NULL OR NEW.published_by_id IS NOT NULL OR current_user='online_school_runtime' THEN
    IF (to_jsonb(NEW) - ARRAY['valid_to','updated_at','retired_by_id','retirement_basis'])
      IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['valid_to','updated_at','retired_by_id','retirement_basis'])
      OR OLD.retired_by_id IS NOT NULL OR NEW.retired_by_id IS NULL
      OR NEW.valid_to IS NULL OR NEW.valid_to<=OLD.valid_from
      OR (OLD.valid_to IS NOT NULL AND NEW.valid_to>=OLD.valid_to) THEN
      RAISE EXCEPTION 'Sale version can only be retired with a director decision' USING ERRCODE='23514';
    END IF;
    PERFORM t03_assert_director(NEW.retired_by_id,NEW.valid_to);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_sale_condition_version BEFORE INSERT OR UPDATE OR DELETE ON sale_conditions
  FOR EACH ROW EXECUTE FUNCTION guard_sale_condition_version();

GRANT INSERT ON sale_conditions TO online_school_runtime;
GRANT UPDATE (valid_to, updated_at, retired_by_id, retirement_basis) ON sale_conditions TO online_school_runtime;

COMMIT;
