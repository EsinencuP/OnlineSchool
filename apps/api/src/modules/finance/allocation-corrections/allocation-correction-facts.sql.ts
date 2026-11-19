import { Prisma } from '@online-school/db';

export function allocationCorrectionFactsSql(
  distributionId: string,
  targetId: string | null,
  now: Date,
) {
  return Prisma.sql`WITH RECURSIVE source AS (
    SELECT d.id,d.payment_id,d.subscription_id,d.amount,d.currency,d.approved_at,p.amount AS receipt_amount,
      l.id AS entry_id,l.financial_period_id AS period_id,fp.closed_at,
      EXISTS (SELECT 1 FROM ledger_entries rev WHERE rev.reverses_entry_id=l.id AND rev.published_at<=${now}) AS source_reversed
    FROM payment_distributions d JOIN payment_receipts p ON p.id=d.payment_id
    JOIN ledger_documents doc ON doc.distribution_id=d.id
    JOIN ledger_entries l ON l.document_id=doc.id
    JOIN financial_periods fp ON fp.id=l.financial_period_id
    WHERE d.id=${distributionId}::uuid AND d.approved_at<=${now} AND p.confirmed_by_director_at<=${now}
      AND l.published_at<=${now} AND l.effective_at<=${now} AND l.reverses_entry_id IS NULL
      AND EXISTS (SELECT 1 FROM ledger_documents rc JOIN ledger_entries re ON re.document_id=rc.id
        WHERE rc.payment_id=p.id AND re.published_at<=${now} AND re.effective_at<=${now}
          AND NOT EXISTS (SELECT 1 FROM ledger_entries undo WHERE undo.reverses_entry_id=re.id AND undo.published_at<=${now}))
  ), receipt_documents AS (
    SELECT doc.id FROM ledger_documents doc,source src WHERE doc.payment_id=src.payment_id
      OR doc.distribution_id IN (SELECT d.id FROM payment_distributions d WHERE d.payment_id=src.payment_id)
    UNION ALL SELECT doc.id FROM ledger_documents doc JOIN receipt_documents root ON root.id=doc.correction_of_document_id
  ), source_documents AS (
    SELECT doc.id FROM ledger_documents doc,source src WHERE
      doc.distribution_id IN (SELECT d.id FROM payment_distributions d WHERE d.subscription_id=src.subscription_id)
      OR doc.consumption_id IN (SELECT c.id FROM entitlement_consumptions c WHERE c.subscription_id=src.subscription_id)
      OR coalesce(doc.refund_approval_id,doc.refund_id) IN (SELECT r.id FROM refund_records r WHERE r.subscription_id=src.subscription_id)
    UNION ALL SELECT doc.id FROM ledger_documents doc JOIN source_documents root ON root.id=doc.correction_of_document_id
  )
  SELECT source.*,
    (SELECT coalesce(sum(CASE WHEN line.direction='CREDIT' THEN line.amount ELSE -line.amount END),0)
      FROM receipt_documents doc JOIN ledger_entries e ON e.document_id=doc.id
      JOIN ledger_lines line ON line.entry_id=e.id WHERE e.published_at<=${now} AND e.effective_at<=${now}
        AND line.currency=source.currency AND line.account_type='UNALLOCATED_FUNDS') AS receipt_unallocated,
    (SELECT coalesce(sum(CASE WHEN line.direction='CREDIT' THEN line.amount ELSE -line.amount END),0)
      FROM source_documents doc JOIN ledger_entries e ON e.document_id=doc.id
      JOIN ledger_lines line ON line.entry_id=e.id WHERE e.published_at<=${now} AND e.effective_at<=${now}
        AND line.currency=source.currency AND line.account_type='CUSTOMER_ADVANCE') AS source_advance_balance,
    (SELECT s.full_price-t03_paid_at(s.id,${now}) FROM subscriptions s WHERE s.id=${targetId}::uuid) AS target_available,
    (SELECT coalesce(sum(g.quantity),0)::int FROM entitlement_grants g
      WHERE g.subscription_id=source.subscription_id AND g.granted_at<=${now}) AS granted_lessons,
    (SELECT coalesce(sum(c.quantity),0)::int FROM entitlement_consumptions c
      WHERE c.subscription_id=source.subscription_id AND c.consumed_at<=${now}) AS used_lessons,
    (SELECT count(*)::int FROM lesson_occurrences l JOIN subscriptions sub ON sub.enrollment_id=l.enrollment_id
      WHERE sub.id=source.subscription_id AND l.actual_start_at>=greatest(sub.valid_from,source.approved_at)
        AND (sub.valid_to IS NULL OR l.actual_start_at<sub.valid_to) AND l.actual_start_at<=${now}) AS started_lessons,
    EXISTS (SELECT 1 FROM refund_records r WHERE r.subscription_id=source.subscription_id) AS refund_history,
    EXISTS (SELECT 1 FROM financial_periods fp WHERE fp.starts_at<=${now} AND fp.ends_at>${now} AND fp.closed_at IS NULL) AS open_current_period
  FROM source`;
}
