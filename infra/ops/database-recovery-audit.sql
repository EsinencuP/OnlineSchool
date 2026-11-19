WITH posted_balance AS (
  SELECT e.id AS entry_id, l.currency, count(*) AS lines,
    sum(l.amount) FILTER (WHERE l.direction='DEBIT') AS debit,
    sum(l.amount) FILTER (WHERE l.direction='CREDIT') AS credit
  FROM public.ledger_entries e JOIN public.ledger_lines l ON l.entry_id=e.id
  WHERE e.published_at IS NOT NULL GROUP BY e.id, l.currency
), posted_totals AS (
  SELECT entry_id,
    bool_and(lines>=2 AND debit IS NOT NULL AND credit IS NOT NULL AND debit=credit) AS balanced,
    jsonb_object_agg(currency, jsonb_build_object('debit', debit::text, 'credit', credit::text)) AS snapshot
  FROM posted_balance GROUP BY entry_id
), active_spend AS (
  SELECT grant_id, sum(quantity) AS used
  FROM public.entitlement_consumptions WHERE cancelled_at IS NULL GROUP BY grant_id
), corrections AS (
  SELECT grant_id, sum(delta_quantity) AS delta FROM public.entitlement_adjustments GROUP BY grant_id
), invariants AS (
  SELECT 'LEDGER_UNBALANCED' AS code, count(*) AS violations
    FROM public.ledger_entries e LEFT JOIN posted_totals t ON t.entry_id=e.id
    WHERE e.published_at IS NOT NULL AND NOT coalesce(t.balanced, false)
  UNION ALL
  SELECT 'LEDGER_BALANCE_SNAPSHOT_MISMATCH', count(*)
    FROM public.ledger_entries e LEFT JOIN posted_totals t ON t.entry_id=e.id
    WHERE e.published_at IS NOT NULL AND e.balance_snapshot IS DISTINCT FROM t.snapshot
  UNION ALL
  SELECT 'PAYMENT_OVERALLOCATED', count(*) FROM (
    SELECT p.id FROM public.payment_receipts p JOIN public.payment_distributions d ON d.payment_id=p.id
    WHERE d.approved_at IS NOT NULL GROUP BY p.id, p.amount HAVING sum(d.amount)>p.amount
  ) overallocated
  UNION ALL
  SELECT 'PAYMENT_DISTRIBUTION_SOURCE_INVALID', count(*)
    FROM public.payment_distributions d
    LEFT JOIN public.payment_receipts p ON p.id=d.payment_id
    LEFT JOIN public.subscriptions s ON s.id=d.subscription_id
    WHERE d.approved_at IS NOT NULL AND (p.confirmed_by_director_at IS NULL
      OR p.confirmed_by_director_at>d.approved_at OR p.currency IS DISTINCT FROM d.currency
      OR s.currency IS DISTINCT FROM d.currency)
  UNION ALL
  SELECT 'PAID_RIGHTS_NEGATIVE', count(*) FROM public.entitlement_grants g
    LEFT JOIN active_spend s ON s.grant_id=g.id LEFT JOIN corrections c ON c.grant_id=g.id
    WHERE g.quantity+coalesce(c.delta,0)-coalesce(s.used,0)<0
  UNION ALL
  SELECT 'MULTIPLE_ACTIVE_LESSON_CHARGES', count(*) FROM (
    SELECT lesson_occurrence_id FROM public.entitlement_consumptions WHERE cancelled_at IS NULL
      GROUP BY lesson_occurrence_id HAVING count(*)>1
  ) duplicates
  UNION ALL
  SELECT 'LESSON_REPORT_SCOPE_MISMATCH', count(*) FROM public.lesson_occurrences l
    LEFT JOIN public.lesson_outcome_reports r ON r.id=l.confirmed_report_id
    WHERE l.confirmed_report_id IS NOT NULL AND r.lesson_occurrence_id IS DISTINCT FROM l.id
  UNION ALL
  SELECT 'LESSON_OUTCOME_REPORT_SCOPE_MISMATCH', count(*) FROM public.lesson_actual_outcomes o
    LEFT JOIN public.lesson_outcome_reports r ON r.id=o.report_id
    WHERE o.report_id IS NOT NULL AND r.lesson_occurrence_id IS DISTINCT FROM o.lesson_occurrence_id
  UNION ALL
  SELECT 'OUTBOX_SOURCE_AUDIT_MISMATCH', count(*) FROM public.outbox_events o
    LEFT JOIN public.audit_events a ON a.id=o.audit_event_id
    WHERE a.result IS DISTINCT FROM 'SUCCESS' OR a.source_operation_id IS DISTINCT FROM o.source_operation_id
), datasets(name) AS (
  VALUES ('payment_receipts'), ('payment_distributions'), ('subscriptions'),
    ('entitlement_grants'), ('entitlement_consumptions'), ('entitlement_adjustments'),
    ('refund_records'), ('teacher_accruals'), ('confirmed_payouts'),
    ('ledger_documents'), ('ledger_entries'), ('ledger_lines'), ('lesson_occurrences'),
    ('lesson_actual_outcomes'), ('lesson_outcome_reports'), ('audit_events'), ('outbox_events'),
    ('job_records'), ('s3_objects'), ('file_permissions')
), records(name, id, record) AS (
  SELECT 'payment_receipts', r.id, to_jsonb(r) FROM public.payment_receipts r UNION ALL
  SELECT 'payment_distributions', r.id, to_jsonb(r) FROM public.payment_distributions r UNION ALL
  SELECT 'subscriptions', r.id, to_jsonb(r) FROM public.subscriptions r UNION ALL
  SELECT 'entitlement_grants', r.id, to_jsonb(r) FROM public.entitlement_grants r UNION ALL
  SELECT 'entitlement_consumptions', r.id, to_jsonb(r) FROM public.entitlement_consumptions r UNION ALL
  SELECT 'entitlement_adjustments', r.id, to_jsonb(r) FROM public.entitlement_adjustments r UNION ALL
  SELECT 'refund_records', r.id, to_jsonb(r) FROM public.refund_records r UNION ALL
  SELECT 'teacher_accruals', r.id, to_jsonb(r) FROM public.teacher_accruals r UNION ALL
  SELECT 'confirmed_payouts', r.id, to_jsonb(r) FROM public.confirmed_payouts r UNION ALL
  SELECT 'ledger_documents', r.id, to_jsonb(r) FROM public.ledger_documents r UNION ALL
  SELECT 'ledger_entries', r.id, to_jsonb(r) FROM public.ledger_entries r UNION ALL
  SELECT 'ledger_lines', r.id, to_jsonb(r) FROM public.ledger_lines r UNION ALL
  SELECT 'lesson_occurrences', r.id, to_jsonb(r) FROM public.lesson_occurrences r UNION ALL
  SELECT 'lesson_actual_outcomes', r.id, to_jsonb(r) FROM public.lesson_actual_outcomes r UNION ALL
  SELECT 'lesson_outcome_reports', r.id, to_jsonb(r) FROM public.lesson_outcome_reports r UNION ALL
  SELECT 'audit_events', r.id, to_jsonb(r) FROM public.audit_events r UNION ALL
  SELECT 'outbox_events', r.id, to_jsonb(r) FROM public.outbox_events r UNION ALL
  SELECT 'job_records', r.id, to_jsonb(r) FROM public.job_records r UNION ALL
  SELECT 's3_objects', r.id, to_jsonb(r) FROM public.s3_objects r UNION ALL
  SELECT 'file_permissions', r.id, to_jsonb(r) FROM public.file_permissions r
), fingerprints AS (
  SELECT d.name, count(r.id) AS rows,
    encode(sha256(convert_to(coalesce(string_agg(
      encode(sha256(convert_to(r.record::text,'UTF8')),'hex'), '' ORDER BY r.id),''),'UTF8')),'hex') AS digest
  FROM datasets d LEFT JOIN records r ON r.name=d.name GROUP BY d.name
)
SELECT
  (SELECT jsonb_object_agg(code, violations) FROM invariants) AS checks,
  (SELECT jsonb_object_agg(name, jsonb_build_object('rows', rows, 'digest', digest)) FROM fingerprints) AS datasets;
