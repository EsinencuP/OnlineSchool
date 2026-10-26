-- Incremental TASK-05 migration. The applied TASK-04 init remains byte-for-byte unchanged.
BEGIN;

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Actual schema names: scheduled_teacher_id / scheduled_at / scheduled_end_at.
-- Adjacent lessons are allowed; every non-cancelled status reserves its interval.
ALTER TABLE lesson_occurrences
  ADD CONSTRAINT no_overlapping_confirmed_lessons
  EXCLUDE USING gist (
    scheduled_teacher_id WITH =,
    tstzrange(scheduled_at, scheduled_end_at, '[)') WITH &&
  ) WHERE (status <> 'CANCELLED');

CREATE UNIQUE INDEX uq_payment_distribution_unique
  ON payment_distributions(payment_id, subscription_id);

-- Check only at publication, so a draft can be assembled line by line.
-- A single net across currencies would incorrectly permit cross-currency offsets.
CREATE FUNCTION check_ledger_balance() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.published_at IS NULL THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM ledger_lines WHERE entry_id=NEW.id)
     OR EXISTS (
       SELECT 1 FROM ledger_lines WHERE entry_id=NEW.id GROUP BY currency
       HAVING sum(CASE WHEN direction='DEBIT' THEN amount ELSE -amount END)<>0
         OR count(*)<2
     ) THEN
    RAISE EXCEPTION 'Ledger entry must balance in every currency'
      USING ERRCODE='23514',CONSTRAINT='ck_ledger_currency_balance';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_t05_publication_balance
  BEFORE UPDATE OF published_at ON ledger_entries FOR EACH ROW
  WHEN (OLD.published_at IS NULL AND NEW.published_at IS NOT NULL)
  EXECUTE FUNCTION check_ledger_balance();

-- Keep the stronger existing t03_guard_ledger_entry / t03_guard_ledger_line triggers
-- and draft-only runtime RLS. A DO INSTEAD NOTHING rule would mask rejected writes.
COMMENT ON FUNCTION t03_require_open_period(timestamptz,uuid) IS
  'Locks the matching period and rejects closed/missing periods. Denied audit is written by the application after its main transaction.';

COMMIT;
