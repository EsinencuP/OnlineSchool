-- Cross-table rules require triggers; a PostgreSQL CHECK cannot read another table.
BEGIN;

ALTER TABLE student_subject_enrollments ADD CONSTRAINT ck_enrollment_period CHECK (valid_to IS NULL OR valid_to > valid_from);
ALTER TABLE teaching_assignments ADD CONSTRAINT ck_teaching_period CHECK (valid_to IS NULL OR valid_to > valid_from);
ALTER TABLE teacher_availabilities ADD CONSTRAINT ck_availability_period CHECK (ends_at > starts_at);
ALTER TABLE recurring_slots ADD CONSTRAINT ck_slot_period CHECK ((active_until IS NULL OR active_until > active_from) AND duration_min > 0);
ALTER TABLE lesson_occurrences
  ADD CONSTRAINT ck_lesson_status CHECK (status IN ('SCHEDULED','STAR_PENDING','CONDUCTED','CANCELLED','DISPUTED')),
  ADD CONSTRAINT ck_lesson_time CHECK (scheduled_end_at > scheduled_at AND version > 0),
  ADD CONSTRAINT ck_lesson_start_snapshot CHECK (num_nonnulls(actual_start_at,actual_teacher_at_start_id,rate_at_start_snapshot,points_at_start_snapshot,rate_basis_at_start,rate_currency_at_start) IN (0,6)),
  ADD CONSTRAINT ck_lesson_start_rate CHECK (actual_start_at IS NULL OR (rate_at_start_snapshot>=0 AND points_at_start_snapshot BETWEEN 0 AND 10 AND rate_currency_at_start ~ '^[A-Z]{3}$'
    AND (rate_basis_at_start<>'ORDINARY_POINTS' OR (rate_currency_at_start='MDL' AND rate_at_start_snapshot=CASE WHEN points_at_start_snapshot<5 THEN 200 WHEN points_at_start_snapshot<10 THEN 220 ELSE 250 END))));
ALTER TABLE lesson_actual_outcomes
  ADD CONSTRAINT ck_outcome_duration CHECK (duration_min > 0 AND confirmed_at >= actual_started_at),
  ADD CONSTRAINT ck_outcome_points CHECK (points_snapshot BETWEEN 0 AND 10 AND rate_snapshot >= 0),
  ADD CONSTRAINT ck_outcome_ordinary_rate CHECK (rate_basis <> 'ORDINARY_POINTS' OR
    (currency = 'MDL' AND rate_snapshot = CASE WHEN points_snapshot < 5 THEN 200 WHEN points_snapshot < 10 THEN 220 ELSE 250 END));
ALTER TABLE sale_conditions
  ADD CONSTRAINT ck_sale_amounts CHECK (lesson_count > 0 AND list_price >= 0 AND discount_amount >= 0 AND price > 0 AND lesson_unit_price > 0 AND list_price - discount_amount = price),
  ADD CONSTRAINT ck_sale_period CHECK (valid_to IS NULL OR valid_to > valid_from);
ALTER TABLE subscriptions
  ADD CONSTRAINT ck_subscription_amounts CHECK (lesson_count > 0 AND full_price > 0 AND initial_discount_amount >= 0 AND original_paid_unit_price > 0),
  ADD CONSTRAINT ck_subscription_period CHECK (valid_to IS NULL OR valid_to > valid_from),
  ADD CONSTRAINT ck_subscription_freeze CHECK (num_nonnulls(frozen_from, frozen_until) = 0 OR (frozen_from IS NOT NULL AND frozen_until > frozen_from));
ALTER TABLE payment_receipts
  ADD CONSTRAINT ck_payment_amount CHECK (amount > 0),
  ADD CONSTRAINT ck_payment_confirmation CHECK (num_nonnulls(confirmed_by_director_id, confirmed_by_director_at, confirmation_operation_id) IN (0,3)),
  ADD CONSTRAINT ck_payment_provider CHECK (num_nonnulls(provider, external_reference) IN (0,2));
ALTER TABLE payment_distributions
  ADD CONSTRAINT ck_distribution_amount CHECK (amount > 0),
  ADD CONSTRAINT ck_distribution_approval CHECK (num_nonnulls(approved_by_director_id, approved_at, approval_operation_id) IN (0,3));
ALTER TABLE temporary_access_permissions
  ADD CONSTRAINT ck_permission_limits CHECK (valid_to > valid_from AND max_lessons > 0 AND approved_at <= valid_from AND length(trim(reason)) > 0);
ALTER TABLE entitlement_grants ADD CONSTRAINT ck_grant_quantity CHECK (quantity > 0);
ALTER TABLE entitlement_consumptions
  ADD CONSTRAINT ck_consumption_quantity CHECK (quantity > 0 AND length(trim(reason)) > 0),
  ADD CONSTRAINT ck_consumption_cancel CHECK (num_nonnulls(cancelled_at, cancellation_adjustment_id) IN (0,2));
ALTER TABLE entitlement_adjustments ADD CONSTRAINT ck_adjustment_basis CHECK (
  length(trim(reason)) > 0 AND ((kind = 'GRANT_DELTA' AND delta_quantity <> 0)
   OR (kind = 'CONSUMPTION_CANCELLATION' AND delta_quantity = 0 AND original_consumption_id IS NOT NULL)));
ALTER TABLE financial_periods
  ADD CONSTRAINT ck_financial_period_range CHECK (ends_at > starts_at),
  ADD CONSTRAINT ck_financial_period_close CHECK (num_nonnulls(closed_at, closed_by_id, closure_operation_id) IN (0,3)),
  ADD CONSTRAINT ex_financial_period_overlap EXCLUDE USING gist (tstzrange(starts_at, ends_at, '[)') WITH &&);
ALTER TABLE refund_records
  ADD CONSTRAINT ck_refund_amounts CHECK (calculated_amount >= 0 AND original_paid_unit_price > 0 AND paid_unused_quantity >= 0 AND (approved_amount IS NULL OR approved_amount >= 0)),
  ADD CONSTRAINT ck_refund_approval CHECK (num_nonnulls(approved_amount, approved_by_director_id, approved_by_director_at, approval_operation_id) IN (0,4)),
  ADD CONSTRAINT ck_refund_execution CHECK (num_nonnulls(executed_amount, executed_at, execution_reference) = 0 OR
    (num_nonnulls(executed_amount, executed_at, execution_reference) = 3 AND approved_by_director_at IS NOT NULL AND executed_at >= approved_by_director_at AND executed_amount > 0 AND executed_amount <= approved_amount));
ALTER TABLE teacher_accruals
  ADD CONSTRAINT ck_accrual_amounts CHECK (amount >= 0 AND rate_snapshot >= 0 AND points_snapshot BETWEEN 0 AND 10 AND length(trim(basis)) > 0);
ALTER TABLE payroll_obligations ADD CONSTRAINT ck_obligation_amount CHECK (amount >= 0);
ALTER TABLE payout_attempts ADD CONSTRAINT ck_attempt_amount CHECK (amount > 0);
ALTER TABLE confirmed_payouts ADD CONSTRAINT ck_payout_amount CHECK (amount > 0);
ALTER TABLE ledger_documents ADD CONSTRAINT ck_ledger_document_source CHECK (
  num_nonnulls(payment_id, refund_id, accrual_id, payout_id, correction_of_document_id) = 1 AND length(trim(basis)) > 0);
ALTER TABLE ledger_entries ADD CONSTRAINT ck_ledger_publication CHECK (
  num_nonnulls(published_at, published_by_id, publication_operation_id, balanced_at, balance_snapshot) = 0 OR
  (num_nonnulls(published_at, published_by_id, publication_operation_id, balanced_at, balance_snapshot) = 5 AND balanced_at <= published_at));
ALTER TABLE ledger_lines ADD CONSTRAINT ck_ledger_line_amount CHECK (amount > 0 AND position > 0);

-- Every monetary currency is explicit. No floating point columns are introduced.
DO $$ DECLARE table_name text; BEGIN
  FOREACH table_name IN ARRAY ARRAY['lesson_actual_outcomes','sale_conditions','subscriptions','payment_receipts',
    'payment_distributions','refund_records','teacher_accruals','payroll_obligations','payout_attempts',
    'confirmed_payouts','ledger_entries','ledger_lines'] LOOP
    EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I CHECK (currency ~ ''^[A-Z]{3}$'')', table_name, 'ck_' || table_name || '_currency');
  END LOOP;
END $$;

CREATE FUNCTION t03_assert_director(staff_id uuid, at_time timestamptz) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM staff_accounts s JOIN auth_accounts a ON a.id=s.account_id
    JOIN role_assignments ra ON ra.account_id=a.id JOIN roles r ON r.id=ra.role_id
    WHERE s.id=staff_id AND r.code='DIRECTOR' AND ra.valid_from<=at_time AND (ra.valid_to IS NULL OR ra.valid_to>at_time)
    AND (s.deactivated_at IS NULL OR s.deactivated_at>at_time) AND (a.disabled_at IS NULL OR a.disabled_at>at_time)) THEN
    RAISE EXCEPTION 'Director decision required' USING ERRCODE='23514', CONSTRAINT='ck_finance_director';
  END IF;
END $$;

CREATE FUNCTION t03_paid_at(sub_id uuid, at_time timestamptz) RETURNS numeric LANGUAGE sql STABLE AS $$
  SELECT coalesce(sum(d.amount),0) FROM payment_distributions d JOIN payment_receipts p ON p.id=d.payment_id
  WHERE d.subscription_id=sub_id AND d.approved_at<=at_time AND p.confirmed_by_director_at<=at_time
$$;

-- Locking an existing nonoverlapping period serializes consumption/publication with closure.
CREATE FUNCTION t03_require_open_period(at_time timestamptz, expected_id uuid DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE period financial_periods;
BEGIN
  SELECT * INTO period FROM financial_periods WHERE starts_at<=at_time AND ends_at>at_time FOR UPDATE;
  IF period.id IS NULL OR period.closed_at IS NOT NULL OR (expected_id IS NOT NULL AND period.id<>expected_id) THEN
    RAISE EXCEPTION 'An open matching financial period is required' USING ERRCODE='23514', CONSTRAINT='ck_open_financial_period';
  END IF;
  RETURN period.id;
END $$;

CREATE FUNCTION t03_immutable_record() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Historical record is immutable; create a linked correction' USING ERRCODE='23514', CONSTRAINT='ck_financial_history_immutable';
END $$;

CREATE FUNCTION t03_guard_payment() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='UPDATE' AND OLD.confirmed_by_director_at IS NOT NULL THEN
    RAISE EXCEPTION 'Confirmed payment is immutable' USING ERRCODE='23514', CONSTRAINT='ck_confirmed_payment_immutable';
  END IF;
  IF NEW.confirmed_by_director_at IS NOT NULL THEN
    PERFORM t03_assert_director(NEW.confirmed_by_director_id,NEW.confirmed_by_director_at);
    IF NEW.confirmed_by_director_at<NEW.registered_at THEN RAISE EXCEPTION 'Invalid confirmation time' USING ERRCODE='23514'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_t03_payment BEFORE INSERT OR UPDATE ON payment_receipts FOR EACH ROW EXECUTE FUNCTION t03_guard_payment();

CREATE FUNCTION t03_guard_distribution() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE receipt payment_receipts; sub subscriptions; allocated numeric;
BEGIN
  IF TG_OP='UPDATE' AND OLD.approved_at IS NOT NULL THEN RAISE EXCEPTION 'Approved distribution is immutable' USING ERRCODE='23514'; END IF;
  SELECT * INTO receipt FROM payment_receipts WHERE id=NEW.payment_id FOR UPDATE;
  SELECT * INTO sub FROM subscriptions WHERE id=NEW.subscription_id FOR UPDATE;
  IF receipt.currency<>NEW.currency OR sub.currency<>NEW.currency THEN RAISE EXCEPTION 'Currency mismatch' USING ERRCODE='23514', CONSTRAINT='ck_distribution_currency'; END IF;
  IF NEW.approved_at IS NOT NULL THEN
    PERFORM t03_assert_director(NEW.approved_by_director_id,NEW.approved_at);
    IF receipt.confirmed_by_director_at IS NULL OR receipt.confirmed_by_director_at>NEW.approved_at THEN
      RAISE EXCEPTION 'Unconfirmed payment cannot be allocated' USING ERRCODE='23514', CONSTRAINT='ck_distribution_confirmed_payment';
    END IF;
    SELECT coalesce(sum(amount),0) INTO allocated FROM payment_distributions WHERE payment_id=NEW.payment_id AND approved_at IS NOT NULL AND id<>NEW.id;
    IF allocated+NEW.amount>receipt.amount THEN RAISE EXCEPTION 'Payment over-allocation' USING ERRCODE='23514', CONSTRAINT='ck_distribution_total'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_t03_distribution BEFORE INSERT OR UPDATE ON payment_distributions FOR EACH ROW EXECUTE FUNCTION t03_guard_distribution();

CREATE FUNCTION t03_guard_subscription_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(NEW)-'valid_to'-'frozen_from'-'frozen_until'-'updated_at') IS DISTINCT FROM
     (to_jsonb(OLD)-'valid_to'-'frozen_from'-'frozen_until'-'updated_at') THEN
    RAISE EXCEPTION 'Initial sale snapshot is immutable' USING ERRCODE='23514', CONSTRAINT='ck_subscription_snapshot';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_t03_subscription_snapshot BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION t03_guard_subscription_snapshot();

CREATE FUNCTION t03_guard_permission() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE sub subscriptions;
BEGIN
  IF TG_OP='UPDATE' THEN
    IF (to_jsonb(NEW)-'revoked_at'-'updated_at') IS DISTINCT FROM (to_jsonb(OLD)-'revoked_at'-'updated_at') OR OLD.revoked_at IS NOT NULL THEN
      RAISE EXCEPTION 'Director admission cannot be extended or rewritten' USING ERRCODE='23514', CONSTRAINT='ck_permission_immutable_limits';
    END IF;
  ELSE
    SELECT * INTO sub FROM subscriptions WHERE id=NEW.subscription_id FOR UPDATE;
    PERFORM t03_assert_director(NEW.approved_by_director_id,NEW.approved_at);
    IF t03_paid_at(sub.id,NEW.approved_at)>=sub.full_price THEN RAISE EXCEPTION 'Fully paid subscription uses normal access' USING ERRCODE='23514'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_t03_permission BEFORE INSERT OR UPDATE ON temporary_access_permissions FOR EACH ROW EXECUTE FUNCTION t03_guard_permission();

CREATE FUNCTION t03_guard_activation_finance() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE sub subscriptions; enrollment student_subject_enrollments; receipt payment_receipts; permission temporary_access_permissions; paid numeric;
BEGIN
  SELECT * INTO sub FROM subscriptions WHERE id=NEW.activation_subscription_id FOR UPDATE;
  SELECT * INTO enrollment FROM student_subject_enrollments WHERE id=sub.enrollment_id;
  SELECT * INTO receipt FROM payment_receipts WHERE id=NEW.activation_payment_confirmation_id;
  IF enrollment.student_id IS DISTINCT FROM NEW.student_id OR receipt.confirmed_by_director_at IS NULL
    OR receipt.confirmed_by_director_at>NEW.activated_at OR NOT EXISTS
    (SELECT 1 FROM payment_distributions WHERE subscription_id=sub.id AND payment_id=receipt.id AND approved_at<=NEW.activated_at) THEN
    RAISE EXCEPTION 'Activation requires a confirmed allocated payment for this student' USING ERRCODE='23514', CONSTRAINT='ck_activation_payment_basis';
  END IF;
  paid:=t03_paid_at(sub.id,NEW.activated_at);
  IF NEW.activation_basis='FULL_PAYMENT' THEN
    IF paid<sub.full_price THEN RAISE EXCEPTION 'Incomplete payment needs a separate director admission' USING ERRCODE='23514', CONSTRAINT='ck_activation_full_payment'; END IF;
  ELSE
    SELECT * INTO permission FROM temporary_access_permissions WHERE id=NEW.activation_director_admission_id FOR UPDATE;
    IF paid>=sub.full_price OR permission.subscription_id IS DISTINCT FROM sub.id OR permission.approved_at>NEW.activated_at
      OR permission.valid_from>NEW.activated_at OR permission.valid_to<=NEW.activated_at
      OR (permission.revoked_at IS NOT NULL AND permission.revoked_at<=NEW.activated_at) THEN
      RAISE EXCEPTION 'Invalid or expired limited director admission' USING ERRCODE='23514', CONSTRAINT='ck_activation_limited_admission';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_t03_activation_finance BEFORE INSERT OR UPDATE OF student_id,activation_subscription_id,activation_payment_confirmation_id,activation_director_admission_id,activation_basis,activated_at
  ON student_accounts FOR EACH ROW EXECUTE FUNCTION t03_guard_activation_finance();

CREATE FUNCTION t03_guard_schedule() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE assignment teaching_assignments; slot recurring_slots;
BEGIN
  IF TG_TABLE_NAME='recurring_slots' THEN
    SELECT * INTO assignment FROM teaching_assignments WHERE id=NEW.teaching_assignment_id;
    IF assignment.enrollment_id IS DISTINCT FROM NEW.enrollment_id THEN RAISE EXCEPTION 'Slot assignment mismatch' USING ERRCODE='23514'; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name=NEW.timezone) THEN RAISE EXCEPTION 'Unknown timezone' USING ERRCODE='23514'; END IF;
  ELSE
    IF TG_OP='UPDATE' AND OLD.actual_start_at IS NOT NULL AND
      (ROW(NEW.actual_start_at,NEW.actual_teacher_at_start_id,NEW.rate_at_start_snapshot,NEW.points_at_start_snapshot,NEW.rate_basis_at_start,NEW.rate_currency_at_start)
       IS DISTINCT FROM ROW(OLD.actual_start_at,OLD.actual_teacher_at_start_id,OLD.rate_at_start_snapshot,OLD.points_at_start_snapshot,OLD.rate_basis_at_start,OLD.rate_currency_at_start)) THEN
      RAISE EXCEPTION 'Actual-start rate snapshot is immutable' USING ERRCODE='23514', CONSTRAINT='ck_lesson_start_immutable';
    END IF;
    SELECT * INTO assignment FROM teaching_assignments WHERE id=NEW.teaching_assignment_id;
    IF assignment.enrollment_id IS DISTINCT FROM NEW.enrollment_id OR assignment.teacher_id IS DISTINCT FROM NEW.scheduled_teacher_id THEN
      RAISE EXCEPTION 'Lesson assignment mismatch' USING ERRCODE='23514', CONSTRAINT='ck_lesson_assignment';
    END IF;
    IF NEW.recurring_slot_id IS NOT NULL THEN
      SELECT * INTO slot FROM recurring_slots WHERE id=NEW.recurring_slot_id;
      IF slot.enrollment_id IS DISTINCT FROM NEW.enrollment_id THEN RAISE EXCEPTION 'Lesson slot mismatch' USING ERRCODE='23514'; END IF;
    END IF;
    IF TG_OP='UPDATE' AND (NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at) AND EXISTS
      (SELECT 1 FROM entitlement_consumptions WHERE lesson_occurrence_id=OLD.id) THEN
      PERFORM t03_require_open_period(OLD.scheduled_at);
      PERFORM t03_require_open_period(NEW.scheduled_at);
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_t03_slot BEFORE INSERT OR UPDATE ON recurring_slots FOR EACH ROW EXECUTE FUNCTION t03_guard_schedule();
CREATE TRIGGER trg_t03_lesson BEFORE INSERT OR UPDATE ON lesson_occurrences FOR EACH ROW EXECUTE FUNCTION t03_guard_schedule();

CREATE FUNCTION t03_guard_outcome() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE lesson lesson_occurrences; permission temporary_access_permissions; sub subscriptions; used integer;
BEGIN
  SELECT * INTO lesson FROM lesson_occurrences WHERE id=NEW.lesson_occurrence_id FOR UPDATE;
  IF lesson.actual_start_at IS DISTINCT FROM NEW.actual_started_at OR lesson.actual_teacher_at_start_id IS DISTINCT FROM NEW.actual_teacher_id
    OR lesson.rate_at_start_snapshot IS DISTINCT FROM NEW.rate_snapshot OR lesson.points_at_start_snapshot IS DISTINCT FROM NEW.points_snapshot
    OR lesson.rate_basis_at_start IS DISTINCT FROM NEW.rate_basis OR lesson.rate_currency_at_start IS DISTINCT FROM NEW.currency THEN
    RAISE EXCEPTION 'Outcome must reuse the actual-start snapshot' USING ERRCODE='23514', CONSTRAINT='ck_outcome_start_snapshot';
  END IF;
  IF NEW.temporary_access_permission_id IS NOT NULL THEN
    SELECT * INTO permission FROM temporary_access_permissions WHERE id=NEW.temporary_access_permission_id FOR UPDATE;
    SELECT * INTO sub FROM subscriptions WHERE id=permission.subscription_id;
    SELECT count(*) INTO used FROM lesson_actual_outcomes WHERE temporary_access_permission_id=permission.id;
    IF sub.enrollment_id IS DISTINCT FROM lesson.enrollment_id OR NEW.actual_started_at<permission.valid_from OR NEW.actual_started_at>=permission.valid_to
      OR permission.approved_at>NEW.actual_started_at OR used>=permission.max_lessons
      OR (permission.revoked_at IS NOT NULL AND permission.revoked_at<=NEW.actual_started_at)
      OR t03_paid_at(sub.id,NEW.actual_started_at)>=sub.full_price THEN
      RAISE EXCEPTION 'Director admission limit or period exceeded' USING ERRCODE='23514', CONSTRAINT='ck_outcome_admission';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_t03_outcome BEFORE INSERT ON lesson_actual_outcomes FOR EACH ROW EXECUTE FUNCTION t03_guard_outcome();

CREATE FUNCTION t03_guard_grant() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE sub subscriptions; distribution payment_distributions; granted integer;
BEGIN
  SELECT * INTO sub FROM subscriptions WHERE id=NEW.subscription_id FOR UPDATE;
  SELECT * INTO distribution FROM payment_distributions WHERE id=NEW.payment_distribution_id;
  IF distribution.subscription_id IS DISTINCT FROM sub.id OR distribution.approved_at IS NULL OR distribution.approved_at>NEW.granted_at OR t03_paid_at(sub.id,NEW.granted_at)<sub.full_price THEN
    RAISE EXCEPTION 'Paid rights require full confirmed allocated payment' USING ERRCODE='23514', CONSTRAINT='ck_grant_paid_basis';
  END IF;
  SELECT coalesce(sum(quantity),0) INTO granted FROM entitlement_grants WHERE subscription_id=sub.id;
  IF granted+NEW.quantity>sub.lesson_count THEN RAISE EXCEPTION 'Duplicate/excess rights issuance' USING ERRCODE='23514', CONSTRAINT='ck_grant_total'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_t03_grant BEFORE INSERT ON entitlement_grants FOR EACH ROW EXECUTE FUNCTION t03_guard_grant();

CREATE FUNCTION t03_guard_consumption() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE grant_row entitlement_grants; sub subscriptions; lesson lesson_occurrences; adjustment entitlement_adjustments; remaining integer;
BEGIN
  SELECT * INTO grant_row FROM entitlement_grants WHERE id=NEW.grant_id FOR UPDATE;
  SELECT * INTO sub FROM subscriptions WHERE id=NEW.subscription_id;
  SELECT * INTO lesson FROM lesson_occurrences WHERE id=NEW.lesson_occurrence_id FOR UPDATE;
  PERFORM t03_require_open_period(lesson.scheduled_at);
  IF grant_row.subscription_id IS DISTINCT FROM sub.id OR lesson.enrollment_id IS DISTINCT FROM sub.enrollment_id THEN
    RAISE EXCEPTION 'Consumption student/subject mismatch' USING ERRCODE='23514', CONSTRAINT='ck_consumption_scope';
  END IF;
  IF TG_OP='UPDATE' THEN
    IF (to_jsonb(NEW)-'cancelled_at'-'cancellation_adjustment_id'-'updated_at') IS DISTINCT FROM (to_jsonb(OLD)-'cancelled_at'-'cancellation_adjustment_id'-'updated_at') OR OLD.cancelled_at IS NOT NULL THEN
      RAISE EXCEPTION 'Original consumption cannot be rewritten' USING ERRCODE='23514';
    END IF;
    SELECT * INTO adjustment FROM entitlement_adjustments WHERE id=NEW.cancellation_adjustment_id;
    IF adjustment.original_consumption_id IS DISTINCT FROM OLD.id OR adjustment.kind<>'CONSUMPTION_CANCELLATION' THEN
      RAISE EXCEPTION 'Linked cancellation adjustment required' USING ERRCODE='23514';
    END IF;
  ELSE
    IF NEW.cancelled_at IS NOT NULL THEN RAISE EXCEPTION 'New consumption cannot start cancelled' USING ERRCODE='23514'; END IF;
    IF NEW.basis='CONFIRMED_LESSON' AND NOT EXISTS
      (SELECT 1 FROM lesson_actual_outcomes WHERE lesson_occurrence_id=lesson.id AND confirmed_at<=NEW.consumed_at) THEN
      RAISE EXCEPTION 'Confirmed lesson fact required' USING ERRCODE='23514', CONSTRAINT='ck_consumption_lesson_fact';
    END IF;
    IF NEW.basis='APPROVED_CANCELLATION' AND lesson.status<>'CANCELLED' THEN RAISE EXCEPTION 'Specific cancellation basis required' USING ERRCODE='23514'; END IF;
  END IF;
  SELECT grant_row.quantity + coalesce((SELECT sum(delta_quantity) FROM entitlement_adjustments WHERE grant_id=grant_row.id),0)
    - coalesce((SELECT sum(quantity) FROM entitlement_consumptions WHERE grant_id=grant_row.id AND cancelled_at IS NULL AND id<>NEW.id),0) INTO remaining;
  IF NEW.cancelled_at IS NULL AND NEW.quantity>remaining THEN RAISE EXCEPTION 'Insufficient paid rights' USING ERRCODE='23514', CONSTRAINT='ck_entitlement_nonnegative'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_t03_consumption BEFORE INSERT OR UPDATE ON entitlement_consumptions FOR EACH ROW EXECUTE FUNCTION t03_guard_consumption();

CREATE FUNCTION t03_guard_adjustment() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE grant_row entitlement_grants; original entitlement_consumptions; remaining integer;
BEGIN
  SELECT * INTO grant_row FROM entitlement_grants WHERE id=NEW.grant_id FOR UPDATE;
  PERFORM t03_require_open_period(NEW.effective_at,NEW.financial_period_id);
  PERFORM t03_assert_director(NEW.author_id,NEW.effective_at);
  IF NEW.original_consumption_id IS NOT NULL THEN
    SELECT * INTO original FROM entitlement_consumptions WHERE id=NEW.original_consumption_id;
    IF original.grant_id IS DISTINCT FROM NEW.grant_id THEN RAISE EXCEPTION 'Adjustment source mismatch' USING ERRCODE='23514'; END IF;
  END IF;
  SELECT grant_row.quantity + coalesce((SELECT sum(delta_quantity) FROM entitlement_adjustments WHERE grant_id=grant_row.id),0)
    - coalesce((SELECT sum(quantity) FROM entitlement_consumptions WHERE grant_id=grant_row.id AND cancelled_at IS NULL),0) INTO remaining;
  IF remaining+NEW.delta_quantity<0 THEN RAISE EXCEPTION 'Adjustment overdraw' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_t03_adjustment BEFORE INSERT ON entitlement_adjustments FOR EACH ROW EXECUTE FUNCTION t03_guard_adjustment();

CREATE FUNCTION t03_guard_refund() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE sub subscriptions; refunded numeric;
BEGIN
  IF TG_OP='UPDATE' AND OLD.executed_at IS NOT NULL THEN RAISE EXCEPTION 'Executed refund is immutable' USING ERRCODE='23514'; END IF;
  SELECT * INTO sub FROM subscriptions WHERE id=NEW.subscription_id FOR UPDATE;
  IF NEW.currency<>sub.currency OR NEW.original_paid_unit_price<>sub.original_paid_unit_price THEN RAISE EXCEPTION 'Original paid rights price must be retained' USING ERRCODE='23514'; END IF;
  IF NEW.approved_by_director_at IS NOT NULL THEN PERFORM t03_assert_director(NEW.approved_by_director_id,NEW.approved_by_director_at); END IF;
  IF NEW.executed_at IS NOT NULL THEN
    SELECT coalesce(sum(executed_amount),0) INTO refunded FROM refund_records WHERE subscription_id=sub.id AND executed_at IS NOT NULL AND id<>NEW.id;
    IF refunded+NEW.executed_amount>t03_paid_at(sub.id,NEW.executed_at) THEN RAISE EXCEPTION 'Refund exceeds confirmed allocated money' USING ERRCODE='23514'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_t03_refund BEFORE INSERT OR UPDATE ON refund_records FOR EACH ROW EXECUTE FUNCTION t03_guard_refund();

CREATE FUNCTION t03_guard_accrual() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE outcome lesson_actual_outcomes;
BEGIN
  SELECT * INTO outcome FROM lesson_actual_outcomes WHERE id=NEW.lesson_actual_outcome_id;
  PERFORM t03_require_open_period(NEW.recognized_at,NEW.financial_period_id);
  IF outcome.actual_teacher_id IS DISTINCT FROM NEW.teacher_id OR outcome.rate_snapshot IS DISTINCT FROM NEW.rate_snapshot
    OR outcome.points_snapshot IS DISTINCT FROM NEW.points_snapshot OR outcome.rate_basis IS DISTINCT FROM NEW.rate_basis
    OR outcome.currency IS DISTINCT FROM NEW.currency OR outcome.confirmed_at>NEW.recognized_at THEN
    RAISE EXCEPTION 'Accrual must retain actual teacher and start-time rate snapshot' USING ERRCODE='23514', CONSTRAINT='ck_accrual_snapshot';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_t03_accrual BEFORE INSERT ON teacher_accruals FOR EACH ROW EXECUTE FUNCTION t03_guard_accrual();

CREATE FUNCTION t03_guard_obligation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE accrual teacher_accruals; entry ledger_entries; document ledger_documents;
BEGIN
  IF TG_OP='UPDATE' THEN
    IF (to_jsonb(NEW)-'recognition_entry_id'-'updated_at') IS DISTINCT FROM (to_jsonb(OLD)-'recognition_entry_id'-'updated_at') THEN
      RAISE EXCEPTION 'Recognized obligation cannot be rewritten' USING ERRCODE='23514';
    END IF;
    IF OLD.recognition_entry_id IS NOT NULL AND NEW.recognition_entry_id IS DISTINCT FROM OLD.recognition_entry_id THEN
      RAISE EXCEPTION 'Recognition entry cannot be replaced' USING ERRCODE='23514';
    END IF;
  END IF;
  SELECT * INTO accrual FROM teacher_accruals WHERE id=NEW.accrual_id;
  IF NEW.amount<>accrual.amount OR NEW.currency<>accrual.currency THEN RAISE EXCEPTION 'Obligation/accrual mismatch' USING ERRCODE='23514'; END IF;
  IF NEW.recognition_entry_id IS NOT NULL THEN
    SELECT * INTO entry FROM ledger_entries WHERE id=NEW.recognition_entry_id;
    SELECT * INTO document FROM ledger_documents WHERE id=entry.document_id;
    IF document.accrual_id IS DISTINCT FROM NEW.accrual_id OR entry.published_at IS NULL THEN RAISE EXCEPTION 'Published matching accrual entry required' USING ERRCODE='23514'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_t03_obligation BEFORE INSERT OR UPDATE ON payroll_obligations FOR EACH ROW EXECUTE FUNCTION t03_guard_obligation();

CREATE FUNCTION t03_guard_payout() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE attempt payout_attempts; obligation payroll_obligations; paid numeric;
BEGIN
  SELECT * INTO attempt FROM payout_attempts WHERE id=NEW.attempt_id FOR UPDATE;
  SELECT * INTO obligation FROM payroll_obligations WHERE id=attempt.obligation_id FOR UPDATE;
  SELECT coalesce(sum(p.amount),0) INTO paid FROM confirmed_payouts p JOIN payout_attempts a ON a.id=p.attempt_id WHERE a.obligation_id=obligation.id;
  IF attempt.status<>'SUCCEEDED' OR NEW.amount>attempt.amount OR NEW.currency<>attempt.currency OR NEW.currency<>obligation.currency
    OR paid+NEW.amount>obligation.amount OR obligation.recognition_entry_id IS NULL THEN
    RAISE EXCEPTION 'Unconfirmed, excessive or unrecognized payout' USING ERRCODE='23514', CONSTRAINT='ck_confirmed_payout_basis';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_t03_payout BEFORE INSERT ON confirmed_payouts FOR EACH ROW EXECUTE FUNCTION t03_guard_payout();

CREATE FUNCTION t03_guard_period() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' OR OLD.closed_at IS NOT NULL OR NEW.starts_at<>OLD.starts_at OR NEW.ends_at<>OLD.ends_at THEN
    RAISE EXCEPTION 'Financial period boundaries and closure are immutable' USING ERRCODE='23514', CONSTRAINT='ck_closed_period_immutable';
  END IF;
  IF NEW.closed_at IS NOT NULL THEN PERFORM t03_assert_director(NEW.closed_by_id,NEW.closed_at); END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_t03_period BEFORE INSERT OR UPDATE OR DELETE ON financial_periods FOR EACH ROW EXECUTE FUNCTION t03_guard_period();

CREATE FUNCTION t03_guard_ledger_entry() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE document ledger_documents; expected_balance jsonb;
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') AND OLD.published_at IS NOT NULL THEN
    RAISE EXCEPTION 'Published ledger entry is immutable' USING ERRCODE='23514', CONSTRAINT='ck_published_ledger_immutable';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  PERFORM t03_require_open_period(NEW.effective_at,NEW.financial_period_id);
  IF NEW.published_at IS NOT NULL THEN
    IF TG_OP='INSERT' THEN RAISE EXCEPTION 'Create draft with lines before publishing' USING ERRCODE='23514'; END IF;
    IF EXISTS (SELECT 1 FROM ledger_lines WHERE entry_id=NEW.id GROUP BY currency
      HAVING sum(CASE WHEN direction='DEBIT' THEN amount ELSE -amount END)<>0 OR count(*)<2)
      OR NOT EXISTS (SELECT 1 FROM ledger_lines WHERE entry_id=NEW.id) THEN
      RAISE EXCEPTION 'Entry must balance in every currency' USING ERRCODE='23514', CONSTRAINT='ck_ledger_currency_balance';
    END IF;
    SELECT jsonb_object_agg(currency,jsonb_build_object('debit',debit::text,'credit',credit::text)) INTO expected_balance
      FROM (SELECT currency,sum(amount) FILTER (WHERE direction='DEBIT') AS debit,sum(amount) FILTER (WHERE direction='CREDIT') AS credit
        FROM ledger_lines WHERE entry_id=NEW.id GROUP BY currency) totals;
    IF NEW.balance_snapshot IS DISTINCT FROM expected_balance THEN RAISE EXCEPTION 'Stale balance snapshot' USING ERRCODE='23514', CONSTRAINT='ck_ledger_balance_snapshot'; END IF;
    SELECT * INTO document FROM ledger_documents WHERE id=NEW.document_id;
    IF (document.payment_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM payment_receipts WHERE id=document.payment_id AND confirmed_by_director_at IS NOT NULL))
      OR (document.refund_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM refund_records WHERE id=document.refund_id AND executed_at IS NOT NULL))
      OR (document.correction_of_document_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ledger_entries WHERE document_id=document.correction_of_document_id AND published_at IS NOT NULL)) THEN
      RAISE EXCEPTION 'Ledger source is not confirmed/executed' USING ERRCODE='23514', CONSTRAINT='ck_ledger_confirmed_source';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_t03_ledger_entry BEFORE INSERT OR UPDATE OR DELETE ON ledger_entries FOR EACH ROW EXECUTE FUNCTION t03_guard_ledger_entry();

CREATE FUNCTION t03_guard_ledger_line() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE entry ledger_entries; parent_ids uuid[];
BEGIN
  IF TG_OP='INSERT' THEN parent_ids:=ARRAY[NEW.entry_id];
  ELSIF TG_OP='DELETE' THEN parent_ids:=ARRAY[OLD.entry_id];
  ELSE parent_ids:=ARRAY[OLD.entry_id,NEW.entry_id]; END IF;
  FOR entry IN SELECT * FROM ledger_entries WHERE id=ANY(parent_ids) ORDER BY id FOR UPDATE LOOP
    IF entry.published_at IS NOT NULL THEN RAISE EXCEPTION 'Published ledger lines are immutable' USING ERRCODE='23514', CONSTRAINT='ck_published_ledger_immutable'; END IF;
    PERFORM t03_require_open_period(entry.effective_at,entry.financial_period_id);
  END LOOP;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_t03_ledger_line BEFORE INSERT OR UPDATE OR DELETE ON ledger_lines FOR EACH ROW EXECUTE FUNCTION t03_guard_ledger_line();

DO $$ DECLARE table_name text; BEGIN
  FOREACH table_name IN ARRAY ARRAY['lesson_change_events','lesson_actual_outcomes','entitlement_grants','entitlement_adjustments','teacher_accruals','confirmed_payouts','ledger_documents','sale_conditions'] LOOP
    EXECUTE format('CREATE TRIGGER trg_t03_history BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION t03_immutable_record()',table_name);
  END LOOP;
  FOREACH table_name IN ARRAY ARRAY['payment_receipts','payment_distributions','refund_records','entitlement_consumptions','payroll_obligations','payout_attempts','temporary_access_permissions'] LOOP
    EXECUTE format('CREATE TRIGGER trg_t03_no_delete BEFORE DELETE ON %I FOR EACH ROW EXECUTE FUNCTION t03_immutable_record()',table_name);
  END LOOP;
END $$;

-- No login/password or application membership is provisioned here. The deployment
-- must use a separate non-owner login with this role; never the migration owner.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='online_school_runtime') THEN
    CREATE ROLE online_school_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='online_school_runtime' AND (rolsuper OR rolbypassrls OR rolcreaterole)) THEN
    RAISE EXCEPTION 'Existing online_school_runtime role has unsafe privileges';
  END IF;
END $$;
GRANT USAGE ON SCHEMA public TO online_school_runtime;
GRANT SELECT ON ledger_entries,ledger_lines,ledger_documents,financial_periods,payment_receipts,refund_records,teacher_accruals,confirmed_payouts,staff_accounts,auth_accounts,roles,role_assignments TO online_school_runtime;
GRANT INSERT,UPDATE ON ledger_entries,ledger_lines TO online_school_runtime;
ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY ledger_entry_read ON ledger_entries FOR SELECT TO online_school_runtime USING (true);
CREATE POLICY ledger_entry_insert ON ledger_entries FOR INSERT TO online_school_runtime WITH CHECK (published_at IS NULL);
CREATE POLICY ledger_entry_draft_update ON ledger_entries FOR UPDATE TO online_school_runtime USING (published_at IS NULL) WITH CHECK (true);
CREATE POLICY ledger_line_read ON ledger_lines FOR SELECT TO online_school_runtime USING (true);
CREATE POLICY ledger_line_insert ON ledger_lines FOR INSERT TO online_school_runtime WITH CHECK (EXISTS (SELECT 1 FROM ledger_entries e WHERE e.id=entry_id AND e.published_at IS NULL));
CREATE POLICY ledger_line_draft_update ON ledger_lines FOR UPDATE TO online_school_runtime
  USING (EXISTS (SELECT 1 FROM ledger_entries e WHERE e.id=entry_id AND e.published_at IS NULL))
  WITH CHECK (EXISTS (SELECT 1 FROM ledger_entries e WHERE e.id=entry_id AND e.published_at IS NULL));

COMMIT;
