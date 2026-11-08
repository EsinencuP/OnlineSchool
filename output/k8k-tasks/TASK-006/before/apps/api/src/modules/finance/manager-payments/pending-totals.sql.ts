import { Prisma } from '@online-school/db';
import { receiptStatusSql } from './receipt-read.spec.js';
// The caller supplies the canonical portfolio predicate (fixed student alias st).
// No household totals or foreign-child allocation amounts leave Finance.
export function pendingReceiptTotalsSql(scope: Prisma.Sql, now: Date): Prisma.Sql {
  return Prisma.sql`WITH RECURSIVE portfolio AS (SELECT st.id FROM students st WHERE ${scope}), eligible AS (
 SELECT p.* FROM payment_receipts p JOIN portfolio contact ON contact.id=p.student_id
 WHERE p.rejected_at IS NULL AND p.created_at<=${now}
 AND NOT EXISTS(SELECT 1 FROM household_memberships own JOIN household_memberships child ON child.household_id=own.household_id
  WHERE own.student_id=p.student_id AND own.status='ACTIVE' AND own.valid_from<=${now} AND (own.valid_to IS NULL OR own.valid_to>${now})
   AND child.student_id IS NOT NULL AND child.status='ACTIVE' AND child.valid_from<=${now} AND (child.valid_to IS NULL OR child.valid_to>${now})
   AND NOT EXISTS(SELECT 1 FROM portfolio permitted WHERE permitted.id=child.student_id))
 AND NOT EXISTS(SELECT 1 FROM payment_distributions dist JOIN subscriptions sub ON sub.id=dist.subscription_id JOIN student_subject_enrollments e ON e.id=sub.enrollment_id
  WHERE dist.payment_id=p.id AND NOT EXISTS(SELECT 1 FROM portfolio permitted WHERE permitted.id=e.student_id))
 ), sources AS (
 SELECT d.id,p.id AS payment_id FROM eligible p JOIN ledger_documents d ON d.correction_of_document_id IS NULL AND (d.payment_id=p.id OR EXISTS(SELECT 1 FROM payment_distributions dist WHERE dist.id=d.distribution_id AND dist.payment_id=p.id))
 UNION ALL SELECT d.id,src.payment_id FROM ledger_documents d JOIN sources src ON src.id=d.correction_of_document_id
 ), unallocated AS (
 SELECT src.payment_id,line.currency,sum(CASE WHEN line.direction='CREDIT' THEN line.amount ELSE -line.amount END) AS amount
 FROM sources src JOIN ledger_entries le ON le.document_id=src.id JOIN ledger_lines line ON line.entry_id=le.id
 WHERE le.published_at<=${now} AND le.effective_at<=${now} AND line.account_type='UNALLOCATED_FUNDS' GROUP BY src.payment_id,line.currency
 ), facts AS (SELECT p.id,p.currency,${receiptStatusSql(now)} AS status,
 CASE WHEN ${receiptStatusSql(now)}='CONFIRMED' THEN coalesce(u.amount,0) ELSE p.amount END AS amount
 FROM eligible p LEFT JOIN unallocated u ON u.payment_id=p.id AND u.currency=p.currency
 ), pending AS(SELECT * FROM facts WHERE status<>'REJECTED' AND amount>0), totals AS(
 SELECT currency,sum(amount)::text AS amount FROM pending GROUP BY currency)
 SELECT (SELECT count(*)::int FROM pending) AS count,coalesce((SELECT jsonb_agg(jsonb_build_object('currency',currency,'amount',amount) ORDER BY currency) FROM totals),'[]'::jsonb) AS totals`;
}
