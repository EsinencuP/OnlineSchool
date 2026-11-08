import { Prisma } from '@online-school/db';
import { issuedHomeworkSql } from '../homework/homework.service.js';
import { visibleMaterialSubjectsSql } from '../materials/materials.service.js';
import type { IStudentContext } from '../student-context.interface.js';
import { confirmedSubscriptionGrantsSql } from '../subscription/subscription.sql.js';

export function studentSubjectsSql(student: IStudentContext): Prisma.Sql {
  const now = Prisma.sql`(SELECT as_of FROM snapshot)`;
  return Prisma.sql`/* student-subjects */ WITH snapshot AS (
    SELECT statement_timestamp() AS as_of
  ), profile AS (
    SELECT sa.student_id,sa.must_change_password FROM student_accounts sa
    JOIN auth_accounts account ON account.id=sa.account_id AND account.kind='STUDENT'
    JOIN students st ON st.id=sa.student_id
    WHERE sa.account_id=${student.userId}::uuid AND sa.student_id=${student.studentProfileId}::uuid
      AND sa.activated_at<=${now} AND sa.deactivated_at IS NULL AND account.disabled_at IS NULL AND st.archived_at IS NULL
  ), enrollments AS (
    SELECT e.*,s.name AS subject_name FROM student_subject_enrollments e
    JOIN profile own ON own.student_id=e.student_id AND NOT own.must_change_password
    JOIN subjects s ON s.id=e.subject_id AND s.archived_at IS NULL
    WHERE e.valid_from<=${now}
  ), selected_periods AS (
    SELECT s.*,root.id AS manager_id,coalesce(root.ends_at,s.valid_to) AS display_end,
      coalesce(s.valid_to>${now},true) AS period_current,
      coalesce(s.frozen_from<=${now} AND s.frozen_until>${now},false) AS is_frozen,
      t03_paid_at(s.id,${now})>=s.full_price AS fully_paid
    FROM subscriptions s JOIN enrollments e ON e.id=s.enrollment_id
    JOIN sale_conditions sc ON sc.id=s.sale_condition_id
    LEFT JOIN manager_subscription_periods link ON link.financial_subscription_id=s.id
    LEFT JOIN manager_subscriptions root ON root.id=link.manager_subscription_id AND root.enrollment_id=e.id
    WHERE s.valid_from<=${now}
  ), grants AS (
    ${confirmedSubscriptionGrantsSql(now)}
  ), adjustments AS (
    SELECT a.grant_id,sum(a.delta_quantity) AS delta FROM entitlement_adjustments a
    JOIN grants g ON g.id=a.grant_id WHERE a.effective_at<=${now} GROUP BY a.grant_id
  ), consumptions AS (
    SELECT c.grant_id,sum(c.quantity) AS used FROM entitlement_consumptions c
    JOIN grants g ON g.id=c.grant_id AND g.subscription_id=c.subscription_id
    JOIN selected_periods s ON s.id=g.subscription_id
    JOIN lesson_occurrences l ON l.id=c.lesson_occurrence_id AND l.enrollment_id=s.enrollment_id
    WHERE c.consumed_at<=${now} AND (c.cancelled_at IS NULL OR c.cancelled_at>${now})
    GROUP BY c.grant_id
  ), paid_balances AS (
    SELECT g.subscription_id,sum(g.quantity+coalesce(a.delta,0)-coalesce(c.used,0))::int AS remaining
    FROM grants g LEFT JOIN adjustments a ON a.grant_id=g.id LEFT JOIN consumptions c ON c.grant_id=g.id
    GROUP BY g.subscription_id
  ), payment_epochs AS (
    SELECT d.subscription_id,max(greatest(d.approved_at,r.confirmed_by_director_at)) AS latest
    FROM selected_periods s JOIN payment_distributions d ON d.subscription_id=s.id
    JOIN payment_receipts r ON r.id=d.payment_id
    WHERE d.approved_at<=${now} AND r.confirmed_by_director_at<=${now}
    GROUP BY d.subscription_id
  ), permissions AS (
    SELECT p.* FROM temporary_access_permissions p
    JOIN selected_periods s ON s.id=p.subscription_id AND s.period_current AND NOT s.fully_paid
    LEFT JOIN payment_epochs epoch ON epoch.subscription_id=s.id
    WHERE p.approved_at<=${now} AND (epoch.latest IS NULL OR p.approved_at>=epoch.latest)
      AND p.valid_from<=${now} AND p.valid_to>${now} AND (p.revoked_at IS NULL OR p.revoked_at>${now})
  ), permission_use AS (
    SELECT o.temporary_access_permission_id,count(*)::int AS used FROM lesson_actual_outcomes o
    JOIN permissions p ON p.id=o.temporary_access_permission_id
    WHERE o.confirmed_at<=${now} GROUP BY o.temporary_access_permission_id
  ), admissions AS (
    SELECT DISTINCT ON (p.subscription_id) p.subscription_id,p.valid_to,p.max_lessons,
      p.max_lessons-coalesce(u.used,0) AS remaining
    FROM permissions p LEFT JOIN permission_use u ON u.temporary_access_permission_id=p.id
    WHERE coalesce(u.used,0)<p.max_lessons ORDER BY p.subscription_id,p.valid_to,p.id
  ), homework AS (
    SELECT DISTINCT e.subject_id FROM enrollments e JOIN homework_deliveries d ON d.enrollment_id=e.id
    JOIN homework_assignments a ON a.id=d.assignment_id AND a.subject_id=e.subject_id
    JOIN teacher_accounts teacher ON teacher.id=d.issued_by WHERE ${issuedHomeworkSql(now)}
  ), materials AS (
    ${visibleMaterialSubjectsSql(student, now)}
  ), lessons AS (
    SELECT DISTINCT e.subject_id FROM enrollments e JOIN lesson_occurrences l ON l.enrollment_id=e.id
    JOIN teaching_assignments a ON a.id=l.teaching_assignment_id
    JOIN teacher_accounts teacher ON teacher.id=l.scheduled_teacher_id
  ), facts AS (
    SELECT e.subject_id AS "subjectId",e.subject_name AS "subjectName",e.id AS "enrollmentId",
      CASE WHEN e.valid_to<=${now} THEN 'ENDED' ELSE e.status::text END AS "enrollmentStatus",
      e.valid_from AS "enrollmentFrom",s.valid_from AS "periodFrom",s.id AS "subscriptionId",
      s.manager_id AS "managerSubscriptionId",s.display_end AS "validUntil",s.frozen_until AS "frozenUntil",
      s.period_current AS "periodCurrent",s.is_frozen AS frozen,s.fully_paid AS "fullyPaid",b.remaining AS "grantBalance",
      h.subject_id IS NOT NULL AS homework,m.subject_id IS NOT NULL AS materials,l.subject_id IS NOT NULL AS lessons,
      CASE WHEN p.subscription_id IS NOT NULL THEN jsonb_build_object('maxLessons',p.max_lessons,
        'lessonsRemaining',p.remaining,'validUntil',p.valid_to) END AS admission
    FROM enrollments e LEFT JOIN selected_periods s ON s.enrollment_id=e.id
    LEFT JOIN paid_balances b ON b.subscription_id=s.id LEFT JOIN admissions p ON p.subscription_id=s.id
    LEFT JOIN homework h ON h.subject_id=e.subject_id LEFT JOIN materials m ON m.subject_id=e.subject_id
    LEFT JOIN lessons l ON l.subject_id=e.subject_id
  ) SELECT ${now} AS "generatedAt",(SELECT must_change_password FROM profile) AS "mustChangePassword",
    coalesce((SELECT jsonb_agg(to_jsonb(facts)-'enrollmentFrom'-'periodFrom'
      ORDER BY "subjectId","enrollmentFrom" DESC,"enrollmentId","periodFrom" DESC,"subscriptionId") FROM facts),'[]'::jsonb) AS rows`;
}
