BEGIN;

CREATE TABLE financial_period_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL,
  lesson_id uuid NOT NULL,
  task_id uuid,
  report_id uuid,
  source_entry_id uuid,
  manager_id uuid,
  source_version integer NOT NULL,
  status_at_close text NOT NULL,
  registered_at timestamptz(3) NOT NULL,
  CONSTRAINT fk_period_dispute_period FOREIGN KEY (period_id) REFERENCES financial_periods(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_period_dispute_lesson FOREIGN KEY (lesson_id) REFERENCES lesson_occurrences(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_period_dispute_task FOREIGN KEY (task_id) REFERENCES crm_tasks(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_period_dispute_report FOREIGN KEY (report_id) REFERENCES lesson_outcome_reports(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_period_dispute_entry FOREIGN KEY (source_entry_id) REFERENCES ledger_entries(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_period_dispute_manager FOREIGN KEY (manager_id) REFERENCES staff_accounts(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT uq_period_dispute_task UNIQUE (period_id, task_id),
  CONSTRAINT uq_period_dispute_report UNIQUE (period_id, report_id),
  CONSTRAINT ck_period_dispute_source CHECK (
    source_version > 0 AND num_nonnulls(task_id, report_id) = 1 AND
    ((task_id IS NOT NULL AND source_entry_id IS NOT NULL AND status_at_close IN ('OPEN', 'IN_PROGRESS'))
      OR (report_id IS NOT NULL AND source_entry_id IS NULL AND status_at_close = 'DISPUTED'))
  )
);

CREATE FUNCTION ops02_period_dispute_source() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM financial_periods p JOIN lesson_occurrences l ON l.id=NEW.lesson_id
    WHERE p.id=NEW.period_id AND p.closed_at IS NULL
      AND l.scheduled_at>=p.starts_at AND l.scheduled_at<p.ends_at
  ) THEN
    RAISE EXCEPTION 'Dispute must belong to the closing lesson period' USING ERRCODE='23514';
  END IF;
  IF NEW.report_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM lesson_occurrences l JOIN lesson_outcome_reports r ON r.id=l.confirmed_report_id
      WHERE l.id=NEW.lesson_id AND l.status='DISPUTED' AND r.id=NEW.report_id
        AND r.lesson_occurrence_id=l.id AND r.result='DISPUTED' AND r.version=NEW.source_version
    ) THEN
      RAISE EXCEPTION 'Disputed lesson report changed' USING ERRCODE='23514';
    END IF;
  ELSIF NOT EXISTS (
    SELECT 1 FROM crm_tasks t
    JOIN entitlement_consumptions c ON c.id=t.original_consumption_id AND c.lesson_occurrence_id=t.lesson_id
    JOIN ledger_documents d ON d.consumption_id=c.id
    JOIN ledger_entries e ON e.document_id=d.id
    WHERE t.id=NEW.task_id AND t.lesson_id=NEW.lesson_id AND t.type='ATTENDANCE_DISPUTE'
      AND t.version=NEW.source_version AND t.status::text=NEW.status_at_close
      AND t.assigned_manager_id IS NOT DISTINCT FROM NEW.manager_id
      AND e.id=NEW.source_entry_id AND e.published_at<=NEW.registered_at
      AND c.cancelled_at IS NULL AND e.reverses_entry_id IS NULL
      AND NOT EXISTS (SELECT 1 FROM ledger_entries rev WHERE rev.reverses_entry_id=e.id AND rev.published_at IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'Disputed charge source changed' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_period_dispute_source BEFORE INSERT ON financial_period_disputes
  FOR EACH ROW EXECUTE FUNCTION ops02_period_dispute_source();

CREATE FUNCTION ops02_period_dispute_closure() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM financial_periods WHERE id=NEW.period_id AND closed_at=NEW.registered_at
  ) THEN
    RAISE EXCEPTION 'The dispute register must commit with period closure' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER trg_period_dispute_closed AFTER INSERT ON financial_period_disputes
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ops02_period_dispute_closure();
CREATE TRIGGER trg_period_dispute_immutable BEFORE UPDATE OR DELETE ON financial_period_disputes
  FOR EACH ROW EXECUTE FUNCTION t03_immutable_record();

GRANT SELECT,INSERT ON financial_period_disputes TO online_school_runtime;
COMMIT;
