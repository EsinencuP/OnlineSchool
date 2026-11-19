import { createHash } from 'node:crypto';
import { Prisma } from '@online-school/db';
import { subscriptionFacts } from '../../../student/subscription/subscription.sql.js';
import { Decimal } from '../finance-common.js';

type QuoteFacts = {
  currency: string;
  unitPrice: string;
  fullPrice: string;
  lessonCount: number;
  allocations: { id: string; paymentId: string; amount: string; currency: string }[];
  advances: { currency: string; amount: string }[];
  grants: { id: string; remaining: number }[];
  charges: { lessonId: string; consumptionId: string; quantity: number; category: string }[];
  holds: { id: string; reason: string }[];
};

export function refundQuoteSql(studentId: string, subscriptionId: string, now: Date) {
  return Prisma.sql`${subscriptionFacts(studentId, { subscriptionId }, now, { financialOnly: true })},
    refund_sources AS (
      SELECT d.id FROM ledger_documents d JOIN refund_records r ON r.id=coalesce(d.refund_approval_id,d.refund_id)
        JOIN selected_periods s ON s.id=r.subscription_id
      UNION ALL SELECT d.id FROM ledger_documents d JOIN refund_sources r ON d.correction_of_document_id=r.id
    ), movements AS (
      SELECT l.currency,SUM(CASE WHEN l.direction='CREDIT' THEN l.amount ELSE -l.amount END)::text AS amount
      FROM ledger_lines l JOIN ledger_entries le ON le.id=l.entry_id
      WHERE l.account_type='CUSTOMER_ADVANCE' AND le.published_at<=${now} AND le.effective_at<=${now}
        AND (le.document_id IN(SELECT document_id FROM ledger_sources WHERE consumption_id IS NOT NULL
          OR distribution_id IN(SELECT id FROM allocations)) OR le.document_id IN(SELECT id FROM refund_sources))
      GROUP BY l.currency
    ), grant_balances AS (
      SELECT g.id,g.granted_at,GREATEST(0,LEAST(g.quantity,
        g.quantity + coalesce((SELECT sum(a.delta_quantity) FROM entitlement_adjustments a WHERE a.grant_id=g.id),0)
          - coalesce((SELECT sum(c.quantity) FROM entitlement_consumptions c WHERE c.grant_id=g.id AND c.cancelled_at IS NULL),0)))::int AS remaining
      FROM grants g JOIN allocations a ON a.id=g.payment_distribution_id
    ), holds AS (
      SELECT l.id,CASE l.status WHEN 'DISPUTED' THEN 'DISPUTED_LESSON'
        WHEN 'SCHEDULED' THEN 'SCHEDULED_LESSON' ELSE 'UNRECONCILED_LESSON' END AS reason
      FROM lesson_occurrences l JOIN selected_periods s ON l.enrollment_id=s.enrollment_id
      WHERE l.kind='REGULAR' AND (
        (l.scheduled_at>=s.valid_from AND (s.valid_to IS NULL OR l.scheduled_at<s.valid_to))
        OR (l.original_scheduled_at>=s.valid_from AND (s.valid_to IS NULL OR l.original_scheduled_at<s.valid_to)))
      AND (l.status IN ('SCHEDULED','STAR_PENDING','DISPUTED') OR (l.status='CONDUCTED'
        AND NOT EXISTS(SELECT 1 FROM charges c WHERE c.lesson_occurrence_id=l.id AND c.cancelled_at IS NULL
          AND EXISTS(SELECT 1 FROM current_posted p WHERE p.consumption_id=c.id))
        AND NOT EXISTS(SELECT 1 FROM entitlement_consumptions c
          JOIN ledger_documents d ON d.consumption_id=c.id JOIN ledger_entries le ON le.document_id=d.id
          WHERE c.subscription_id<>s.id AND c.lesson_occurrence_id=l.id AND c.cancelled_at IS NULL
            AND le.published_at<=${now} AND NOT EXISTS(SELECT 1 FROM ledger_entries rev
              WHERE rev.reverses_entry_id=le.id AND rev.published_at<=${now}))))
      UNION ALL
      SELECT t.id,'OPEN_ATTENDANCE_DISPUTE' FROM crm_tasks t
      JOIN entitlement_consumptions c ON c.id=t.original_consumption_id
      JOIN selected_periods s ON s.id=c.subscription_id
      WHERE t.type='ATTENDANCE_DISPUTE' AND t.status IN ('OPEN','IN_PROGRESS')
      UNION ALL
      SELECT s.id,'ACTIVE_FREEZE' FROM selected_periods s WHERE s.frozen_from<=${now} AND s.frozen_until>${now}
      UNION ALL
      SELECT f.id,'ACTIVE_FREEZE' FROM subscription_freezes f JOIN manager_subscription_periods p
        ON p.manager_subscription_id=f.subscription_id JOIN selected_periods s ON s.id=p.financial_subscription_id
      WHERE f.starts_at<=${now} AND least(f.ends_at,f.actual_ends_at)>${now}
      UNION ALL
      SELECT r.id,'LEGACY_REFUND_REVIEW' FROM refund_records r JOIN selected_periods s ON s.id=r.subscription_id
      WHERE r.request_id IS NULL
    )
    SELECT jsonb_build_object('currency',s.currency,'unitPrice',s.original_paid_unit_price::text,
      'fullPrice',s.full_price::text,'lessonCount',s.lesson_count,
      'allocations',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'paymentId',payment_id,'amount',amount::text,
        'currency',currency) ORDER BY id) FROM allocations),'[]'::jsonb),
      'advances',coalesce((SELECT jsonb_agg(to_jsonb(m) ORDER BY currency) FROM movements m),'[]'::jsonb),
      'grants',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'remaining',remaining)
        ORDER BY granted_at,id) FROM grant_balances),'[]'::jsonb),
      'charges',coalesce((SELECT jsonb_agg(jsonb_build_object('lessonId',c.lesson_occurrence_id,'consumptionId',c.id,
        'quantity',c.quantity,'category',CASE c.basis WHEN 'CONFIRMED_LESSON' THEN 'CONDUCTED'
        ELSE 'APPROVED_CANCELLATION' END) ORDER BY c.consumed_at,c.id)
        FROM charges c WHERE c.cancelled_at IS NULL AND EXISTS(SELECT 1 FROM current_posted p
          WHERE p.consumption_id=c.id)),'[]'::jsonb),
      'holds',coalesce((SELECT jsonb_agg(to_jsonb(h) ORDER BY reason,id) FROM holds h),'[]'::jsonb)) AS facts
    FROM selected_periods s`;
}

export function quoteRefund(facts: QuoteFacts) {
  const unit = new Decimal(facts.unitPrice);
  const allocated = facts.allocations.reduce((sum, row) => sum.add(row.amount), new Decimal(0));
  const advance = new Decimal(
    facts.advances.find((row) => row.currency === facts.currency)?.amount ?? 0,
  );
  const remaining = facts.grants.reduce((sum, grant) => sum + grant.remaining, 0);
  const holds = [...facts.holds];
  if (
    !unit.gt(0) ||
    !unit.mul(facts.lessonCount).eq(facts.fullPrice) ||
    [...facts.allocations, ...facts.advances].some((row) => row.currency !== facts.currency)
  )
    holds.push({ id: '', reason: 'PAYMENT_BASIS_REVIEW' });

  const quantity = holds.length
    ? 0
    : Decimal.max(
        0,
        Decimal.min(remaining, allocated.div(unit).floor(), advance.div(unit).floor()),
      ).toNumber();
  const snapshot = {
    ...facts,
    holds,
    allocated: allocated.toFixed(4),
    advance: advance.toFixed(4),
    eligibleQuantity: quantity,
    maximumAmount: unit.mul(quantity).toFixed(4),
  };
  const revision = createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
  return { ...snapshot, revision };
}

export async function readRefundQuote(
  tx: Prisma.TransactionClient,
  studentId: string,
  subscriptionId: string,
  now: Date,
) {
  const [row] = await tx.$queryRaw<{ facts: QuoteFacts }[]>(
    refundQuoteSql(studentId, subscriptionId, now),
  );
  return row ? quoteRefund(row.facts) : null;
}
