import { Injectable, Logger } from '@nestjs/common';
import { err, ok } from '@online-school/shared';
import type { Result } from '@online-school/shared';
import { DatabaseService } from '../../core/database/database.module.js';
import { domainError, fail } from '../../core/errors/domain-error.js';
import type { DomainError } from '../../core/errors/domain-error.js';
import { serialize } from '../../modules/finance/finance-common.js';
import type { IStudentContext } from '../student-context.interface.js';
import type { DashboardResponseDto, HomeworkCountsDto, SkillProgressDto } from './dashboard.dto.js';

export const validMeetLink = (value: string | null): value is string =>
  typeof value === 'string' &&
  /^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(value);

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);
  constructor(private readonly database: DatabaseService) {}

  async revision(studentId: string): Promise<string> {
    const [row] = await this.database.client.$queryRaw<{ revision: string }[]>`
      SELECT coalesce((SELECT revision::text FROM student_dashboard_revisions WHERE student_id=${studentId}::uuid),'0') AS revision`;
    if (!row) return fail(domainError('DASHBOARD_UNAVAILABLE', 503));
    return row.revision;
  }

  async get(student: IStudentContext): Promise<Result<DashboardResponseDto, DomainError>> {
    const started = performance.now(),
      asOf = new Date();
    try {
      // Invoke all four sources before awaiting: no query depends on another block.
      const [lessons, homework, subscriptions, skills] = await Promise.all([
        this.nextLesson(student.studentProfileId, asOf),
        this.homework(student.studentProfileId, asOf),
        this.subscription(student.studentProfileId, asOf),
        this.skills(student.studentProfileId, asOf),
      ]);
      const now = new Date(),
        lesson = lessons[0],
        subscription = subscriptions[0];
      const minutesUntil = lesson ? (+lesson.scheduled_at - +now) / 60000 : Infinity;
      const canJoin =
        !!lesson &&
        student.hasActiveAccess &&
        !student.mustChangePassword &&
        minutesUntil <= 10 &&
        minutesUntil >= -60 &&
        validMeetLink(lesson.google_meet_link);
      const body: DashboardResponseDto = {
        nextLesson:
          lesson && lesson.scheduled_at > now
            ? {
                lessonId: lesson.id,
                scheduledAt: lesson.scheduled_at.toISOString(),
                durationMinutes: Math.round(
                  (+lesson.scheduled_end_at - +lesson.scheduled_at) / 60000,
                ),
                teacherName: lesson.teacher_name,
                subjectName: lesson.subject_name,
                canJoin,
                meetLink: canJoin ? lesson.google_meet_link : null,
              }
            : null,
        homework: homework[0] ?? { notSubmitted: 0, submitted: 0, needsRevision: 0, total: 0 },
        subscription: subscription
          ? {
              lessonsRemaining: subscription.remaining,
              validUntil: subscription.valid_to?.toISOString().slice(0, 10) ?? null,
              isFrozen: subscription.is_frozen,
              frozenUntil: subscription.is_frozen
                ? (subscription.frozen_until?.toISOString() ?? null)
                : null,
            }
          : null,
        skillProgress: skills[0] ?? { familiarizing: 0, practicing: 0, applying: 0, notStudied: 0 },
        generatedAt: now.toISOString(),
      };
      this.logger.log({
        event: 'student.dashboard.aggregate',
        executionTime: Math.round(performance.now() - started),
        sources: 4,
      });
      // Decimal.toJSON preserves exact decimal strings; quantities/counts remain integers.
      return ok(serialize(body) as DashboardResponseDto);
    } catch {
      return err(domainError('DASHBOARD_UNAVAILABLE', 503));
    }
  }

  async nextLesson(studentId: string, time: Date) {
    return this.database.client.$queryRaw<
      {
        id: string;
        scheduled_at: Date;
        scheduled_end_at: Date;
        teacher_name: string;
        subject_name: string;
        google_meet_link: string | null;
      }[]
    >`
      SELECT l.id,l.scheduled_at,l.scheduled_end_at,t.full_name AS teacher_name,s.name AS subject_name,
        CASE WHEN EXISTS(SELECT 1 FROM subscriptions sub WHERE sub.enrollment_id=e.id
          AND sub.valid_from<=${time} AND (sub.valid_to IS NULL OR sub.valid_to>${time})
          AND NOT coalesce(sub.frozen_from<=${time} AND sub.frozen_until>${time},false)
          AND ((t03_paid_at(sub.id,${time})>=sub.full_price AND EXISTS(SELECT 1 FROM entitlement_grants g
            WHERE g.subscription_id=sub.id AND g.granted_at<=${time}
              AND g.quantity+coalesce((SELECT sum(adj.delta_quantity) FROM entitlement_adjustments adj WHERE adj.grant_id=g.id AND adj.effective_at<=${time}),0)
                -coalesce((SELECT sum(c.quantity) FROM entitlement_consumptions c WHERE c.grant_id=g.id AND c.consumed_at<=${time}
                  AND (c.cancelled_at IS NULL OR c.cancelled_at>${time})),0)>0))
            OR (t03_paid_at(sub.id,${time})<sub.full_price AND EXISTS(SELECT 1 FROM temporary_access_permissions p
              WHERE p.subscription_id=sub.id AND p.approved_at<=${time} AND p.valid_from<=${time} AND p.valid_to>${time}
                AND (p.revoked_at IS NULL OR p.revoked_at>${time})
                AND (SELECT count(*) FROM lesson_actual_outcomes o WHERE o.temporary_access_permission_id=p.id AND o.confirmed_at<=${time})<p.max_lessons))))
          THEN a.google_meet_link ELSE NULL END AS google_meet_link
      FROM lesson_occurrences l JOIN student_subject_enrollments e ON e.id=l.enrollment_id
      JOIN subjects s ON s.id=e.subject_id JOIN teaching_assignments a ON a.id=l.teaching_assignment_id
      JOIN teacher_accounts t ON t.id=l.scheduled_teacher_id
      WHERE e.student_id=${studentId}::uuid AND l.status='SCHEDULED' AND l.scheduled_at>${time}
        AND e.status='ACTIVE' AND e.valid_from<=${time} AND (e.valid_to IS NULL OR e.valid_to>l.scheduled_at)
        AND a.enrollment_id=e.id AND a.teacher_id=t.id AND a.valid_from<=l.scheduled_at
        AND (a.valid_to IS NULL OR a.valid_to>l.scheduled_at) AND t.deactivated_at IS NULL AND s.archived_at IS NULL
      ORDER BY l.scheduled_at,l.id LIMIT 1`;
  }

  async homework(studentId: string, time: Date) {
    return this.database.client.$queryRaw<HomeworkCountsDto[]>`
      SELECT count(*) FILTER (WHERE hs.id IS NULL)::int AS "notSubmitted",
        count(*) FILTER (WHERE hs.id IS NOT NULL AND (r.result IS NULL OR r.result='ACCEPTED'))::int AS submitted,
        count(*) FILTER (WHERE r.result='NEEDS_REVISION')::int AS "needsRevision",count(*)::int AS total
      FROM homework_deliveries d JOIN student_subject_enrollments e ON e.id=d.enrollment_id
      JOIN homework_assignments a ON a.id=d.assignment_id
      LEFT JOIN LATERAL (SELECT h.id FROM homework_submissions h WHERE h.delivery_id=d.id AND h.student_id=e.student_id
        AND h.submitted_at<=${time} ORDER BY h.version DESC,h.id LIMIT 1) hs ON true
      LEFT JOIN LATERAL (SELECT sr.result FROM submission_reviews sr WHERE sr.submission_id=hs.id
        AND sr.reviewed_at<=${time} ORDER BY sr.version DESC,sr.id LIMIT 1) r ON true
      WHERE e.student_id=${studentId}::uuid AND d.issued_at<=${time} AND (d.cancelled_at IS NULL OR d.cancelled_at>${time})
        AND a.archived_at IS NULL`;
  }

  async subscription(studentId: string, time: Date) {
    return this.database.client.$queryRaw<
      {
        remaining: number;
        valid_to: Date | null;
        is_frozen: boolean;
        frozen_until: Date | null;
      }[]
    >`
      SELECT CASE WHEN t03_paid_at(s.id,${time})>=s.full_price THEN b.remaining ELSE p.remaining END::int AS remaining,
        s.valid_to,coalesce(s.frozen_from<=${time} AND s.frozen_until>${time},false) AS is_frozen,s.frozen_until
      FROM subscriptions s JOIN student_subject_enrollments e ON e.id=s.enrollment_id
      CROSS JOIN LATERAL (SELECT coalesce(sum(g.quantity
        +coalesce((SELECT sum(a.delta_quantity) FROM entitlement_adjustments a WHERE a.grant_id=g.id AND a.effective_at<=${time}),0)
        -coalesce((SELECT sum(c.quantity) FROM entitlement_consumptions c WHERE c.grant_id=g.id AND c.consumed_at<=${time}
          AND (c.cancelled_at IS NULL OR c.cancelled_at>${time})),0)),0)::int AS remaining
        FROM entitlement_grants g WHERE g.subscription_id=s.id AND g.granted_at<=${time}) b
      LEFT JOIN LATERAL (SELECT (ta.max_lessons-(SELECT count(*) FROM lesson_actual_outcomes o
        WHERE o.temporary_access_permission_id=ta.id AND o.confirmed_at<=${time}))::int AS remaining
        FROM temporary_access_permissions ta WHERE ta.subscription_id=s.id AND ta.approved_at<=${time}
          AND ta.valid_from<=${time} AND ta.valid_to>${time} AND (ta.revoked_at IS NULL OR ta.revoked_at>${time})
          AND (SELECT count(*) FROM lesson_actual_outcomes o WHERE o.temporary_access_permission_id=ta.id AND o.confirmed_at<=${time})<ta.max_lessons
        ORDER BY ta.valid_to,ta.id LIMIT 1) p ON true
      WHERE e.student_id=${studentId}::uuid AND e.status IN ('ACTIVE','PAUSED') AND e.valid_from<=${time}
        AND (e.valid_to IS NULL OR e.valid_to>${time}) AND s.valid_from<=${time} AND (s.valid_to IS NULL OR s.valid_to>${time})
        AND (e.status='ACTIVE' OR (s.frozen_from<=${time} AND s.frozen_until>${time}))
        AND ((t03_paid_at(s.id,${time})>=s.full_price AND b.remaining>0) OR (t03_paid_at(s.id,${time})<s.full_price AND p.remaining>0))
      ORDER BY s.valid_to ASC NULLS LAST,s.valid_from,s.id LIMIT 1`;
  }

  async skills(studentId: string, time: Date) {
    return this.database.client.$queryRaw<SkillProgressDto[]>`
      SELECT count(*) FILTER (WHERE a.level='INTRODUCING')::int AS familiarizing,
        count(*) FILTER (WHERE a.level='PRACTICING')::int AS practicing,
        count(*) FILTER (WHERE a.level='APPLYING')::int AS applying,
        count(*) FILTER (WHERE a.level IS NULL OR a.level::text='NOT_STUDIED')::int AS "notStudied"
      FROM skill_entries sk JOIN subjects s ON s.id=sk.subject_id
      LEFT JOIN LATERAL (SELECT sa.level FROM skill_assessments sa JOIN student_subject_enrollments e ON e.id=sa.enrollment_id
        WHERE sa.skill_id=sk.id AND e.student_id=${studentId}::uuid AND e.subject_id=sk.subject_id AND sa.assessed_at<=${time}
          AND (sa.lesson_ref IS NULL OR EXISTS(SELECT 1 FROM lesson_actual_outcomes o WHERE o.lesson_occurrence_id=sa.lesson_ref AND o.confirmed_at<=${time}))
        ORDER BY sa.assessed_at DESC,sa.version DESC,sa.id LIMIT 1) a ON true
      WHERE sk.archived_at IS NULL AND s.archived_at IS NULL AND (sk.student_id IS NULL OR sk.student_id=${studentId}::uuid) AND EXISTS(SELECT 1 FROM student_subject_enrollments e
        WHERE e.student_id=${studentId}::uuid AND e.subject_id=sk.subject_id AND e.status IN ('ACTIVE','PAUSED')
          AND e.valid_from<=${time} AND (e.valid_to IS NULL OR e.valid_to>${time}))`;
  }
}
