BEGIN;

CREATE TABLE lesson_outcome_dispute_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL UNIQUE,
  report_id uuid NOT NULL UNIQUE,
  outcome_id uuid UNIQUE,
  origin_period_id uuid,
  director_id uuid NOT NULL,
  result text NOT NULL,
  evidence_reference text NOT NULL,
  reason text NOT NULL,
  reconstructed_snapshot boolean NOT NULL,
  decided_at timestamptz(3) NOT NULL,
  source_operation_id uuid NOT NULL UNIQUE,
  CONSTRAINT fk_lod_lesson FOREIGN KEY (lesson_id) REFERENCES lesson_occurrences(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_lod_report FOREIGN KEY (report_id) REFERENCES lesson_outcome_reports(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_lod_outcome FOREIGN KEY (outcome_id) REFERENCES lesson_actual_outcomes(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_lod_period FOREIGN KEY (origin_period_id) REFERENCES financial_periods(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_lod_director FOREIGN KEY (director_id) REFERENCES staff_accounts(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT ck_lod_result CHECK (
    (result='CONDUCTED' AND outcome_id IS NOT NULL) OR
    (result='NOT_CONDUCTED' AND outcome_id IS NULL AND NOT reconstructed_snapshot)
  ),
  CONSTRAINT ck_lod_evidence CHECK (
    length(trim(evidence_reference)) BETWEEN 1 AND 200 AND length(trim(reason)) BETWEEN 5 AND 500
  )
);

CREATE FUNCTION lod_validate_decision() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,public AS $$
DECLARE lesson lesson_occurrences; period_id uuid;
BEGIN
  PERFORM t03_assert_director(NEW.director_id,NEW.decided_at);
  SELECT * INTO lesson FROM lesson_occurrences WHERE id=NEW.lesson_id FOR UPDATE;
  IF lesson.kind <> 'REGULAR' OR lesson.status <> 'DISPUTED'
    OR lesson.confirmed_report_id IS DISTINCT FROM NEW.report_id OR NOT EXISTS (
      SELECT 1 FROM lesson_outcome_reports r
      WHERE r.id=NEW.report_id AND r.lesson_occurrence_id=lesson.id AND r.result='DISPUTED'
    )
  THEN RAISE EXCEPTION 'Current disputed lesson report required' USING ERRCODE='23514'; END IF;
  SELECT id INTO period_id FROM financial_periods
    WHERE starts_at<=lesson.scheduled_at AND ends_at>lesson.scheduled_at;
  IF NEW.origin_period_id IS DISTINCT FROM period_id
  THEN RAISE EXCEPTION 'Dispute period must match the original lesson' USING ERRCODE='23514'; END IF;
  IF NEW.result='CONDUCTED' AND NEW.reconstructed_snapshot IS DISTINCT FROM
    COALESCE(lesson.rate_context_snapshot->>'source'='DIRECTOR_VERIFIED_RETROSPECTIVE',false)
  THEN RAISE EXCEPTION 'Decision must retain start snapshot provenance' USING ERRCODE='23514'; END IF;
  IF NEW.outcome_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM lesson_actual_outcomes o
    WHERE o.id=NEW.outcome_id AND o.lesson_occurrence_id=lesson.id AND o.report_id IS NULL
      AND o.confirmed_by_id=NEW.director_id AND o.confirmed_at=NEW.decided_at
      AND o.source_operation_id=NEW.source_operation_id
  )
  THEN RAISE EXCEPTION 'Outcome must have the same decision evidence' USING ERRCODE='23514'; END IF;
  IF NEW.result='NOT_CONDUCTED' AND EXISTS (
    SELECT 1 FROM lesson_actual_outcomes WHERE lesson_occurrence_id=lesson.id
  )
  THEN RAISE EXCEPTION 'Existing conducted outcome cannot be contradicted' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_lod_validate BEFORE INSERT ON lesson_outcome_dispute_decisions
  FOR EACH ROW EXECUTE FUNCTION lod_validate_decision();
CREATE TRIGGER trg_lod_immutable BEFORE UPDATE OR DELETE ON lesson_outcome_dispute_decisions
  FOR EACH ROW EXECUTE FUNCTION t03_immutable_record();

CREATE FUNCTION lod_validate_status() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM lesson_outcome_dispute_decisions d WHERE d.lesson_id=OLD.id
      AND ((NEW.status='CONDUCTED' AND d.result='CONDUCTED')
        OR (NEW.status='CANCELLED' AND d.result='NOT_CONDUCTED'))
  ) THEN RAISE EXCEPTION 'Disputed lesson requires a director decision' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_lod_validate_status BEFORE UPDATE OF status ON lesson_occurrences
  FOR EACH ROW WHEN (OLD.status='DISPUTED' AND NEW.status IS DISTINCT FROM OLD.status)
  EXECUTE FUNCTION lod_validate_status();

CREATE FUNCTION lod_require_decision_effect() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM lesson_occurrences l WHERE l.id=NEW.lesson_id
      AND ((l.status='CONDUCTED' AND NEW.result='CONDUCTED')
        OR (l.status='CANCELLED' AND NEW.result='NOT_CONDUCTED'))
  ) THEN RAISE EXCEPTION 'Decision and lesson status must commit together' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER trg_lod_effect AFTER INSERT ON lesson_outcome_dispute_decisions
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION lod_require_decision_effect();

CREATE FUNCTION lod_require_accrual_decision() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM lesson_outcome_dispute_decisions WHERE outcome_id=NEW.lesson_actual_outcome_id)
    AND (NEW.exception_authorized_by_id IS NULL OR NEW.exception_authorized_by_id<>NEW.authorized_by_id)
  THEN RAISE EXCEPTION 'Disputed outcome requires separate director accrual' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_lod_accrual BEFORE INSERT ON teacher_accruals
  FOR EACH ROW EXECUTE FUNCTION lod_require_accrual_decision();

GRANT SELECT, INSERT ON lesson_outcome_dispute_decisions TO online_school_runtime;
COMMIT;
