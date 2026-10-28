import { Prisma } from '@online-school/db';
import type { SubscriptionPage, SubscriptionSelection } from './subscription.dto.js';

export function subscriptionFacts(
  studentId: string,
  query: SubscriptionSelection,
  now: Date,
): Prisma.Sql {
  const filter = query.subscriptionId
    ? Prisma.sql`AND s.id=${query.subscriptionId}::uuid`
    : Prisma.empty;
  return Prisma.sql`WITH RECURSIVE selected AS (
    SELECT s.*,sc.code AS plan_name FROM subscriptions s JOIN student_subject_enrollments e ON e.id=s.enrollment_id
    JOIN sale_conditions sc ON sc.id=s.sale_condition_id WHERE e.student_id=${studentId}::uuid ${filter}
    ORDER BY (s.valid_from<=${now} AND (s.valid_to IS NULL OR s.valid_to>${now})) DESC,s.valid_from DESC,s.id LIMIT 1
  ), ledger_sources AS (
    SELECT d.id AS document_id,d.id AS root_id,d.payment_id,d.distribution_id,d.consumption_id
    FROM ledger_documents d WHERE d.correction_of_document_id IS NULL AND (
      d.payment_id IN(SELECT p.payment_id FROM payment_distributions p JOIN selected s ON s.id=p.subscription_id)
      OR d.distribution_id IN(SELECT p.id FROM payment_distributions p JOIN selected s ON s.id=p.subscription_id)
      OR d.consumption_id IN(SELECT c.id FROM entitlement_consumptions c JOIN selected s ON s.id=c.subscription_id))
    UNION ALL SELECT d.id,p.root_id,p.payment_id,p.distribution_id,p.consumption_id
      FROM ledger_documents d JOIN ledger_sources p ON p.document_id=d.correction_of_document_id
  ), published AS (
    SELECT src.*,le.id AS entry_id,le.published_at,le.reverses_entry_id,le.entitlement_balance_before,le.entitlement_balance_after
    FROM ledger_sources src JOIN ledger_entries le ON le.document_id=src.document_id WHERE le.published_at<=${now}
  ), current_posted AS (
    SELECT p.* FROM published p WHERE p.reverses_entry_id IS NULL AND NOT EXISTS(
      SELECT 1 FROM ledger_entries rev WHERE rev.reverses_entry_id=p.entry_id AND rev.published_at<=${now})
  ), allocations AS (
    SELECT d.id,d.payment_id,d.amount,d.currency,d.approved_at,r.confirmed_by_director_at AS confirmed_at
    FROM payment_distributions d JOIN selected s ON s.id=d.subscription_id JOIN payment_receipts r ON r.id=d.payment_id
    WHERE d.approved_by_director_id IS NOT NULL AND d.approved_at<=${now}
      AND r.confirmed_by_director_id IS NOT NULL AND r.confirmed_by_director_at<=${now}
      AND EXISTS(SELECT 1 FROM current_posted p WHERE p.payment_id=r.id)
      AND EXISTS(SELECT 1 FROM current_posted p WHERE p.distribution_id=d.id)
  ), grants AS (
    SELECT g.* FROM entitlement_grants g JOIN selected s ON s.id=g.subscription_id
    JOIN payment_distributions d ON d.id=g.payment_distribution_id AND d.subscription_id=s.id
    JOIN payment_receipts r ON r.id=d.payment_id
    WHERE g.granted_at<=${now} AND g.basis='CONFIRMED_PAYMENT' AND d.approved_at<=g.granted_at AND r.confirmed_by_director_at<=g.granted_at
      AND (SELECT coalesce(sum(p.amount),0) FROM payment_distributions p JOIN payment_receipts receipt ON receipt.id=p.payment_id
        WHERE p.subscription_id=s.id AND p.approved_at<=g.granted_at AND receipt.confirmed_by_director_at<=g.granted_at)>=s.full_price
  ), charges AS (
    SELECT c.*,posted.entry_id,posted.entitlement_balance_before,posted.entitlement_balance_after
    FROM entitlement_consumptions c JOIN grants g ON g.id=c.grant_id AND g.subscription_id=c.subscription_id
    JOIN selected s ON s.id=c.subscription_id JOIN lesson_occurrences l ON l.id=c.lesson_occurrence_id AND l.enrollment_id=s.enrollment_id
    JOIN LATERAL(SELECT p.* FROM published p WHERE p.consumption_id=c.id AND p.reverses_entry_id IS NULL
      ORDER BY p.published_at,p.entry_id LIMIT 1) posted ON true
    WHERE c.consumed_at<=${now} AND ((c.basis='CONFIRMED_LESSON' AND l.scheduled_at<=${now}
      AND EXISTS(SELECT 1 FROM lesson_actual_outcomes o WHERE o.lesson_occurrence_id=l.id AND o.confirmed_at<=c.consumed_at))
      OR (c.basis='APPROVED_CANCELLATION' AND l.status='CANCELLED'))
  ), changes AS (
    SELECT a.id,a.effective_at,CASE WHEN a.kind='CONSUMPTION_CANCELLATION' THEN c.quantity ELSE a.delta_quantity END AS delta,
      a.kind,c.lesson_occurrence_id FROM entitlement_adjustments a JOIN grants g ON g.id=a.grant_id
    LEFT JOIN charges c ON c.id=a.original_consumption_id AND c.grant_id=a.grant_id
    WHERE a.effective_at<=${now} AND ((a.kind='GRANT_DELTA' AND a.delta_quantity<>0) OR
      (a.kind='CONSUMPTION_CANCELLATION' AND c.cancelled_at<=${now} AND c.cancellation_adjustment_id=a.id
        AND EXISTS(SELECT 1 FROM published reversal WHERE reversal.reverses_entry_id=c.entry_id)))
  ), freeze_sources AS (
    SELECT h.frozen_from,least(h.frozen_until,h.replaced_at) AS frozen_until,h.replaced_at AS observed_at,0 AS priority
      FROM subscription_freeze_history h JOIN selected s ON s.id=h.subscription_id WHERE h.replaced_at<=${now}
    UNION ALL SELECT s.frozen_from,s.frozen_until,${now}::timestamptz,1 FROM selected s WHERE s.frozen_from IS NOT NULL
  ), freezes AS (
    SELECT DISTINCT ON(frozen_from) frozen_from,frozen_until FROM freeze_sources
    ORDER BY frozen_from,observed_at DESC,priority DESC
  ), events AS (
    SELECT g.id AS id,g.granted_at AS at,'CREDIT'::text AS type,g.quantity::numeric AS delta,NULL::numeric AS stored_before,NULL::numeric AS stored_after,
      'Начисление оплаченных занятий'::text AS description,NULL::uuid AS lesson_id,0 AS priority FROM grants g
    UNION ALL SELECT c.entry_id,c.consumed_at,'DEDUCTION',-c.quantity,c.entitlement_balance_before,c.entitlement_balance_after,'Списание занятия',c.lesson_occurrence_id,1 FROM charges c
    UNION ALL SELECT a.id,a.effective_at,CASE WHEN a.delta>0 THEN 'CREDIT' ELSE 'DEDUCTION' END,a.delta,NULL,NULL,
      CASE WHEN a.kind='CONSUMPTION_CANCELLATION' THEN 'Отмена списания занятия' ELSE 'Корректировка остатка занятий' END,a.lesson_occurrence_id,2 FROM changes a
    UNION ALL SELECT md5(s.id::text||':freeze:'||extract(epoch FROM f.frozen_from)::text)::uuid,f.frozen_from,'FREEZE',0,NULL,NULL,'Заморозка абонемента',NULL,3
      FROM freezes f CROSS JOIN selected s WHERE f.frozen_from<=${now} AND f.frozen_until>f.frozen_from
    UNION ALL SELECT md5(s.id::text||':unfreeze:'||extract(epoch FROM f.frozen_from)::text)::uuid,f.frozen_until,'UNFREEZE',0,NULL,NULL,'Разморозка абонемента',NULL,4
      FROM freezes f CROSS JOIN selected s WHERE f.frozen_until<=${now} AND f.frozen_until>f.frozen_from
  ), balances AS (
    SELECT e.*,sum(delta) OVER(ORDER BY at,priority,id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS after
    FROM events e
  )`;
}
function forbidden(query: SubscriptionSelection): Prisma.Sql {
  return query.subscriptionId ? Prisma.sql`NOT EXISTS(SELECT 1 FROM selected)` : Prisma.sql`false`;
}
export function subscriptionDetailsSql(
  studentId: string,
  query: SubscriptionSelection,
  now: Date,
): Prisma.Sql {
  return Prisma.sql`${subscriptionFacts(studentId, query, now)}
    SELECT ${forbidden(query)} AS forbidden,(SELECT jsonb_build_object('subscriptionId',s.id,'planName',s.plan_name,
      'lessonsTotal',s.lesson_count,'lessonsRemaining',(SELECT coalesce(sum(delta),0)::int FROM events),
      'validFrom',s.valid_from,'validUntil',s.valid_to,'isFrozen',coalesce(s.frozen_from<=${now} AND s.frozen_until>${now},false),
      'frozenFrom',s.frozen_from,'frozenUntil',s.frozen_until,'status',CASE WHEN s.valid_to<=${now} THEN 'EXPIRED'
        WHEN s.frozen_from<=${now} AND s.frozen_until>${now} THEN 'FROZEN' ELSE 'ACTIVE' END) FROM selected s WHERE s.valid_from<=${now}) AS data`;
}
export function subscriptionPaymentsSql(
  studentId: string,
  query: SubscriptionPage,
  now: Date,
): Prisma.Sql {
  return Prisma.sql`${subscriptionFacts(studentId, query, now)}, rows AS (
    SELECT a.payment_id AS "paymentId",a.confirmed_at AS "confirmedAt",a.amount::text AS amount,a.currency,
      'Подтверждённая оплата: '||s.plan_name AS description,
      (SELECT sum(g.quantity)::int FROM grants g WHERE g.payment_distribution_id=a.id) AS "lessonsAdded"
    FROM allocations a CROSS JOIN selected s
  ), page AS(SELECT * FROM rows ORDER BY "confirmedAt" DESC,"paymentId" DESC LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize})
    SELECT ${forbidden(query)} AS forbidden,jsonb_build_object('items',coalesce((SELECT jsonb_agg(to_jsonb(page) ORDER BY "confirmedAt" DESC,"paymentId" DESC) FROM page),'[]'::jsonb),'total',(SELECT count(*)::int FROM rows)) AS data`;
}
export function subscriptionLedgerSql(
  studentId: string,
  query: SubscriptionPage,
  now: Date,
): Prisma.Sql {
  return Prisma.sql`${subscriptionFacts(studentId, query, now)}, page AS(
    SELECT id AS "entryId",at AS "entryDate",type,coalesce(stored_before,after-delta)::text AS "balanceBefore",
      coalesce(stored_after,after)::text AS "balanceAfter",description,lesson_id AS "lessonId",priority
    FROM balances ORDER BY at DESC,priority DESC,id DESC LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize})
    SELECT ${forbidden(query)} AS forbidden,jsonb_build_object('items',coalesce((SELECT jsonb_agg(to_jsonb(page)-'priority' ORDER BY "entryDate" DESC,priority DESC,"entryId" DESC) FROM page),'[]'::jsonb),'total',(SELECT count(*)::int FROM balances)) AS data`;
}
