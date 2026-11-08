import { Prisma } from '@online-school/db';
import { subscriptionFacts } from '../../student/subscription/subscription.sql.js';

export type StudentActivationEvidence = {
  subscription_id: string;
  payment_id: string;
  distribution_id: string;
  admission_id: string | null;
  director_id: string;
  basis: 'FULL_PAYMENT' | 'LIMITED_DIRECTOR_ADMISSION';
};
// Read-only payment gate. Full cumulative payment and each limited admission remain separate.
export function studentActivationSql(studentId: string, now: Date): Prisma.Sql {
  return Prisma.sql`SELECT candidate.id AS subscription_id,facts.payment_id,facts.distribution_id,
    CASE WHEN facts.paid>=candidate.full_price THEN NULL ELSE admission.id END AS admission_id,
    CASE WHEN facts.paid>=candidate.full_price THEN 'FULL_PAYMENT' ELSE 'LIMITED_DIRECTOR_ADMISSION' END AS basis,
    CASE WHEN facts.paid>=candidate.full_price THEN receipt.confirmed_by_director_id ELSE admission.approved_by_director_id END AS director_id
    FROM subscriptions candidate JOIN student_subject_enrollments enrollment ON enrollment.id=candidate.enrollment_id
    CROSS JOIN LATERAL (${subscriptionFacts(studentId, {}, now, { subscriptionIdExpression: Prisma.sql`candidate.id`, financialOnly: true })}
      SELECT sum(a.amount) AS paid,(array_agg(a.payment_id ORDER BY greatest(a.approved_at,a.confirmed_at),a.id))[1] AS payment_id,
        (array_agg(a.id ORDER BY greatest(a.approved_at,a.confirmed_at),a.id))[1] AS distribution_id,
        max(greatest(a.approved_at,a.confirmed_at)) AS latest_payment_at FROM allocations a WHERE a.currency=candidate.currency) facts
    JOIN payment_receipts receipt ON receipt.id=facts.payment_id
    LEFT JOIN LATERAL (SELECT p.id,p.approved_by_director_id FROM temporary_access_permissions p WHERE p.subscription_id=candidate.id
      AND p.approved_at>=facts.latest_payment_at AND p.approved_at<=${now} AND p.valid_from<=${now} AND p.valid_to>${now}
      AND (p.revoked_at IS NULL OR p.revoked_at>${now})
      AND (SELECT count(*) FROM lesson_actual_outcomes o WHERE o.temporary_access_permission_id=p.id AND o.confirmed_at<=${now})<p.max_lessons
      ORDER BY p.approved_at DESC,p.id LIMIT 1) admission ON true
    WHERE enrollment.student_id=${studentId}::uuid
      AND facts.paid>0 AND (facts.paid>=candidate.full_price OR admission.id IS NOT NULL)
    ORDER BY (facts.paid>=candidate.full_price) DESC,candidate.valid_from DESC,candidate.id LIMIT 1`;
}
