import { Injectable } from '@nestjs/common';
import { err, ok } from '@online-school/shared';
import type { Result } from '@online-school/shared';
import { DatabaseService } from '../../core/database/database.module.js';
import { domainError } from '../../core/errors/domain-error.js';
import type { DomainError } from '../../core/errors/domain-error.js';
import { StudentErrors } from '../student-context.interface.js';
import type { IStudentContext, StudentRequest } from '../student-context.interface.js';
import type { StudentMeResponseDto } from './me.dto.js';

export type LoadedStudent = { context: IStudentContext; me: StudentMeResponseDto };
@Injectable()
export class MeService {
  constructor(private readonly database: DatabaseService) {}
  async load(userId: string): Promise<Result<LoadedStudent, DomainError>> {
    try {
      const profile = await this.database.client.studentAccount.findFirst({
        where: {
          account_id: userId,
          deactivated_at: null,
          activated_at: { lte: new Date() },
          student: { archived_at: null },
          account: { kind: 'STUDENT', disabled_at: null },
        },
        select: {
          id: true,
          student_id: true,
          must_change_password: true,
          created_at: true,
          student: { select: { full_name: true } },
          account: { select: { login_id: true } },
        },
      });
      if (!profile) return err(domainError(StudentErrors.PROFILE_NOT_FOUND, 403));
      const [access] = await this.database.client.$queryRaw<
        { subject_ids: string[]; has_active_access: boolean }[]
      >`
        WITH time AS (SELECT statement_timestamp() AS now), enrollments AS (
          SELECT e.* FROM student_subject_enrollments e,time t
          WHERE e.student_id=${profile.student_id}::uuid AND e.valid_from<=t.now
            AND (e.valid_to IS NULL OR e.valid_to>t.now) AND e.status IN ('ACTIVE','PAUSED')
        )
        SELECT ARRAY(SELECT DISTINCT subject_id::text FROM enrollments ORDER BY subject_id::text) AS subject_ids,
          EXISTS(SELECT 1 FROM enrollments e JOIN subscriptions s ON s.enrollment_id=e.id CROSS JOIN time t
            WHERE s.valid_from<=t.now AND (s.valid_to IS NULL OR s.valid_to>t.now)
              AND (e.status='ACTIVE' OR (s.frozen_from<=t.now AND s.frozen_until>t.now))
              AND (
                (t03_paid_at(s.id,t.now)>=s.full_price AND EXISTS(
                  SELECT 1 FROM entitlement_grants g WHERE g.subscription_id=s.id AND g.granted_at<=t.now
                  AND g.quantity+coalesce((SELECT sum(a.delta_quantity) FROM entitlement_adjustments a WHERE a.grant_id=g.id AND a.effective_at<=t.now),0)
                    -coalesce((SELECT sum(c.quantity) FROM entitlement_consumptions c WHERE c.grant_id=g.id AND c.consumed_at<=t.now AND (c.cancelled_at IS NULL OR c.cancelled_at>t.now)),0)>0
                )) OR (t03_paid_at(s.id,t.now)<s.full_price AND EXISTS(
                  SELECT 1 FROM temporary_access_permissions p WHERE p.subscription_id=s.id
                    AND p.approved_at<=t.now AND p.valid_from<=t.now AND p.valid_to>t.now
                    AND (p.revoked_at IS NULL OR p.revoked_at>t.now)
                    AND (SELECT count(*) FROM lesson_actual_outcomes o WHERE o.temporary_access_permission_id=p.id AND o.confirmed_at<=t.now)<p.max_lessons
                ))
              )
          ) AS has_active_access`;
      if (!access) return err(domainError('STUDENT_CONTEXT_UNAVAILABLE', 503));
      const context: IStudentContext = {
        userId,
        studentProfileId: profile.student_id,
        hasActiveAccess: access.has_active_access,
        mustChangePassword: profile.must_change_password,
        subjectIds: access.subject_ids,
      };
      return ok({
        context,
        me: {
          id: profile.student_id,
          userId,
          displayName: profile.student.full_name,
          email: profile.account.login_id,
          avatarUrl: null,
          hasActiveAccess: context.hasActiveAccess,
          mustChangePassword: context.mustChangePassword,
          createdAt: profile.created_at.toISOString(),
        },
      });
    } catch {
      return err(domainError('STUDENT_CONTEXT_UNAVAILABLE', 503));
    }
  }
  get(context: IStudentContext, req: StudentRequest): Result<StudentMeResponseDto, DomainError> {
    if (
      !req.studentMe ||
      req.studentMe.userId !== context.userId ||
      req.studentMe.id !== context.studentProfileId
    )
      return err(domainError(StudentErrors.PROFILE_NOT_FOUND, 403));
    return ok(req.studentMe);
  }
}
