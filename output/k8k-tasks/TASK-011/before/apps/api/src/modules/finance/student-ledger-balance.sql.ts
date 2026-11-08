import { Prisma } from '@online-school/db';

// Only subscription attribution establishes the student's monetary subledger. A receipt's
// student_id is a CRM contact, never ownership of the family's UNALLOCATED_FUNDS.
// Published reversals cancel originals; replacements inherit root subscription attribution.
export function studentLedgerBalanceSql(studentId: Prisma.Sql, now: Date): Prisma.Sql {
  return Prisma.sql`WITH RECURSIVE owned_subscriptions AS (
    SELECT s.id FROM subscriptions s JOIN student_subject_enrollments e ON e.id=s.enrollment_id WHERE e.student_id=${studentId}
  ), owned_distributions AS (SELECT d.id FROM payment_distributions d
    WHERE d.approved_at<=${now} AND EXISTS(SELECT 1 FROM payment_receipts p WHERE p.id=d.payment_id AND p.confirmed_by_director_at<=${now})
      AND EXISTS(SELECT 1 FROM ledger_documents pd JOIN ledger_entries pe ON pe.document_id=pd.id
        WHERE pd.payment_id=d.payment_id AND pe.published_at<=${now} AND pe.effective_at<=${now})
      AND d.subscription_id IN(SELECT id FROM owned_subscriptions)),
  sources AS (
    SELECT d.id,d.distribution_id,d.consumption_id,d.refund_id FROM ledger_documents d
    WHERE d.correction_of_document_id IS NULL AND (d.distribution_id IN(SELECT id FROM owned_distributions)
      OR d.consumption_id IN(SELECT c.id FROM entitlement_consumptions c WHERE c.subscription_id IN(SELECT id FROM owned_subscriptions))
      OR d.refund_id IN(SELECT r.id FROM refund_records r WHERE r.subscription_id IN(SELECT id FROM owned_subscriptions)))
    UNION ALL SELECT d.id,p.distribution_id,p.consumption_id,p.refund_id
      FROM ledger_documents d JOIN sources p ON d.correction_of_document_id=p.id
  ), movements AS (
    SELECT l.currency,l.amount,l.direction FROM sources s JOIN ledger_entries e ON e.document_id=s.id
    JOIN ledger_lines l ON l.entry_id=e.id WHERE e.published_at<=${now} AND e.effective_at<=${now}
      AND l.account_type='CUSTOMER_ADVANCE'
  ), totals AS (SELECT currency,sum(CASE WHEN direction='CREDIT' THEN amount ELSE -amount END)::text AS amount
    FROM movements GROUP BY currency)
  SELECT coalesce(jsonb_agg(jsonb_build_object('currency',currency,'amount',amount) ORDER BY currency),'[]'::jsonb) AS balances FROM totals`;
}
