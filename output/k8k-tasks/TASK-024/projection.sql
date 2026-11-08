-- Prepared query from dist, not executed against a database. Synthetic binds in query.json.
/* student-subjects */ WITH snapshot AS (
    SELECT statement_timestamp() AS as_of
  ), profile AS (
    SELECT sa.student_id,sa.must_change_password FROM student_accounts sa
    JOIN auth_accounts account ON account.id=sa.account_id AND account.kind='STUDENT'
    JOIN students st ON st.id=sa.student_id
    WHERE sa.account_id=$1::uuid AND sa.student_id=$2::uuid
      AND sa.activated_at<=(SELECT as_of FROM snapshot) AND sa.deactivated_at IS NULL AND account.disabled_at IS NULL AND st.archived_at IS NULL
  ), enrollments AS (
    SELECT e.*,s.name AS subject_name FROM student_subject_enrollments e
    JOIN profile own ON own.student_id=e.student_id AND NOT own.must_change_password
    JOIN subjects s ON s.id=e.subject_id AND s.archived_at IS NULL
    WHERE e.valid_from<=(SELECT as_of FROM snapshot)
  ), selected_periods AS (
    SELECT s.*,root.id AS manager_id,coalesce(root.ends_at,s.valid_to) AS display_end,
      coalesce(s.valid_to>(SELECT as_of FROM snapshot),true) AS period_current,
      coalesce(s.frozen_from<=(SELECT as_of FROM snapshot) AND s.frozen_until>(SELECT as_of FROM snapshot),false) AS is_frozen,
      t03_paid_at(s.id,(SELECT as_of FROM snapshot))>=s.full_price AS fully_paid
    FROM subscriptions s JOIN enrollments e ON e.id=s.enrollment_id
    JOIN sale_conditions sc ON sc.id=s.sale_condition_id
    LEFT JOIN manager_subscription_periods link ON link.financial_subscription_id=s.id
    LEFT JOIN manager_subscriptions root ON root.id=link.manager_subscription_id AND root.enrollment_id=e.id
    WHERE s.valid_from<=(SELECT as_of FROM snapshot)
  ), grants AS (
    SELECT g.* FROM entitlement_grants g JOIN selected_periods s ON s.id=g.subscription_id
    JOIN payment_distributions d ON d.id=g.payment_distribution_id AND d.subscription_id=s.id
    JOIN payment_receipts r ON r.id=d.payment_id
    WHERE g.granted_at<=(SELECT as_of FROM snapshot) AND g.basis='CONFIRMED_PAYMENT' AND d.approved_at<=g.granted_at AND r.confirmed_by_director_at<=g.granted_at
      AND (SELECT coalesce(sum(p.amount),0) FROM payment_distributions p JOIN payment_receipts receipt ON receipt.id=p.payment_id
        WHERE p.subscription_id=s.id AND p.approved_at<=g.granted_at AND receipt.confirmed_by_director_at<=g.granted_at)>=s.full_price
  ), adjustments AS (
    SELECT a.grant_id,sum(a.delta_quantity) AS delta FROM entitlement_adjustments a
    JOIN grants g ON g.id=a.grant_id WHERE a.effective_at<=(SELECT as_of FROM snapshot) GROUP BY a.grant_id
  ), consumptions AS (
    SELECT c.grant_id,sum(c.quantity) AS used FROM entitlement_consumptions c
    JOIN grants g ON g.id=c.grant_id AND g.subscription_id=c.subscription_id
    JOIN selected_periods s ON s.id=g.subscription_id
    JOIN lesson_occurrences l ON l.id=c.lesson_occurrence_id AND l.enrollment_id=s.enrollment_id
    WHERE c.consumed_at<=(SELECT as_of FROM snapshot) AND (c.cancelled_at IS NULL OR c.cancelled_at>(SELECT as_of FROM snapshot))
    GROUP BY c.grant_id
  ), paid_balances AS (
    SELECT g.subscription_id,sum(g.quantity+coalesce(a.delta,0)-coalesce(c.used,0))::int AS remaining
    FROM grants g LEFT JOIN adjustments a ON a.grant_id=g.id LEFT JOIN consumptions c ON c.grant_id=g.id
    GROUP BY g.subscription_id
  ), payment_epochs AS (
    SELECT d.subscription_id,max(greatest(d.approved_at,r.confirmed_by_director_at)) AS latest
    FROM selected_periods s JOIN payment_distributions d ON d.subscription_id=s.id
    JOIN payment_receipts r ON r.id=d.payment_id
    WHERE d.approved_at<=(SELECT as_of FROM snapshot) AND r.confirmed_by_director_at<=(SELECT as_of FROM snapshot)
    GROUP BY d.subscription_id
  ), permissions AS (
    SELECT p.* FROM temporary_access_permissions p
    JOIN selected_periods s ON s.id=p.subscription_id AND s.period_current AND NOT s.fully_paid
    LEFT JOIN payment_epochs epoch ON epoch.subscription_id=s.id
    WHERE p.approved_at<=(SELECT as_of FROM snapshot) AND (epoch.latest IS NULL OR p.approved_at>=epoch.latest)
      AND p.valid_from<=(SELECT as_of FROM snapshot) AND p.valid_to>(SELECT as_of FROM snapshot) AND (p.revoked_at IS NULL OR p.revoked_at>(SELECT as_of FROM snapshot))
  ), permission_use AS (
    SELECT o.temporary_access_permission_id,count(*)::int AS used FROM lesson_actual_outcomes o
    JOIN permissions p ON p.id=o.temporary_access_permission_id
    WHERE o.confirmed_at<=(SELECT as_of FROM snapshot) GROUP BY o.temporary_access_permission_id
  ), admissions AS (
    SELECT DISTINCT ON (p.subscription_id) p.subscription_id,p.valid_to,p.max_lessons,
      p.max_lessons-coalesce(u.used,0) AS remaining
    FROM permissions p LEFT JOIN permission_use u ON u.temporary_access_permission_id=p.id
    WHERE coalesce(u.used,0)<p.max_lessons ORDER BY p.subscription_id,p.valid_to,p.id
  ), homework AS (
    SELECT DISTINCT e.subject_id FROM enrollments e JOIN homework_deliveries d ON d.enrollment_id=e.id
    JOIN homework_assignments a ON a.id=d.assignment_id AND a.subject_id=e.subject_id
    JOIN teacher_accounts teacher ON teacher.id=d.issued_by WHERE d.issued_at<=(SELECT as_of FROM snapshot) AND a.archived_at IS NULL
        AND (d.cancelled_at IS NULL OR d.cancelled_at>(SELECT as_of FROM snapshot))
  ), materials AS (
    SELECT DISTINCT p.educational_subject_id AS subject_id
    FROM file_permissions p JOIN s3_objects o ON o.id=p.s3_object_id
    JOIN teacher_accounts t ON t.account_id=p.granted_by
    LEFT JOIN subjects s ON s.id=p.educational_subject_id WHERE p.subject_id=$3::uuid AND p.subject_type='STUDENT'
    AND p.revoked_at IS NULL AND p.granted_at<=(SELECT as_of FROM snapshot) AND (p.expires_at IS NULL OR p.expires_at>(SELECT as_of FROM snapshot))
    AND o.status='VERIFIED' AND o.uploaded_at<=(SELECT as_of FROM snapshot)
    AND EXISTS (SELECT 1 FROM student_accounts sa WHERE sa.account_id=p.subject_id AND sa.student_id=$4::uuid)
    AND (p.educational_subject_id IS NULL OR EXISTS (SELECT 1 FROM student_subject_enrollments e
      WHERE e.student_id=$5::uuid AND e.subject_id=p.educational_subject_id))
    AND (p.lesson_occurrence_id IS NULL OR EXISTS (SELECT 1 FROM lesson_occurrences l
      JOIN student_subject_enrollments e ON e.id=l.enrollment_id WHERE l.id=p.lesson_occurrence_id
        AND e.student_id=$6::uuid AND e.subject_id=p.educational_subject_id)) AND p.educational_subject_id IS NOT NULL
  ), lessons AS (
    SELECT DISTINCT e.subject_id FROM enrollments e JOIN lesson_occurrences l ON l.enrollment_id=e.id
    JOIN teaching_assignments a ON a.id=l.teaching_assignment_id
    JOIN teacher_accounts teacher ON teacher.id=l.scheduled_teacher_id
  ), facts AS (
    SELECT e.subject_id AS "subjectId",e.subject_name AS "subjectName",e.id AS "enrollmentId",
      CASE WHEN e.valid_to<=(SELECT as_of FROM snapshot) THEN 'ENDED' ELSE e.status::text END AS "enrollmentStatus",
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
  ) SELECT (SELECT as_of FROM snapshot) AS "generatedAt",(SELECT must_change_password FROM profile) AS "mustChangePassword",
    coalesce((SELECT jsonb_agg(to_jsonb(facts)-'enrollmentFrom'-'periodFrom'
      ORDER BY "subjectId","enrollmentFrom" DESC,"enrollmentId","periodFrom" DESC,"subscriptionId") FROM facts),'[]'::jsonb) AS rows;
