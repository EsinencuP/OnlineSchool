import type { Prisma } from '@online-school/db';
import { domainError, fail } from '../../../core/errors/domain-error.js';
import type { TeacherContext } from '../../teacher/context/teacher-context.js';

export function liveTeacherRole(now: Date) {
  return {
    role: { code: 'TEACHER' as const },
    valid_from: { lte: now },
    OR: [{ valid_to: null }, { valid_to: { gt: now } }],
  };
}

export async function requireVerifiedMeetTeacher(
  tx: Prisma.TransactionClient,
  ctx: TeacherContext,
  lock = false,
) {
  if (lock)
    await tx.$queryRaw`SELECT id FROM teacher_accounts WHERE id=${ctx.teacherId}::uuid FOR UPDATE`;
  const [{ now }] = await tx.$queryRaw<[{ now: Date }]>`SELECT clock_timestamp() AS now`;
  const session = await tx.session.findFirst({
    where: {
      id: ctx.sessionId,
      account_id: ctx.accountId,
      expires_at: { gt: now },
      revoked_at: null,
      recovery_only: false,
      mfa_verified_at: { not: null },
      account: { disabled_at: null, role_assignments: { some: liveTeacherRole(now) } },
    },
    select: { id: true },
  });
  const teacher = await tx.teacherAccount.findFirst({
    where: { id: ctx.teacherId, account_id: ctx.accountId, deactivated_at: null },
    select: { id: true },
  });
  if (!session || !teacher) return fail(domainError('MEET_OAUTH_FORBIDDEN', 403));
  return now;
}

export function activeMeetAssignment(
  tx: Prisma.TransactionClient,
  assignmentId: string,
  teacherId: string,
  now: Date,
): Promise<{ id: string; enrollment_ref: { student_id: string } } | null> {
  return tx.teachingAssignment.findFirst({
    where: {
      id: assignmentId,
      teacher_id: teacherId,
      valid_from: { lte: now },
      OR: [{ valid_to: null }, { valid_to: { gt: now } }],
      teacher_ref: {
        deactivated_at: null,
        account: { disabled_at: null, role_assignments: { some: liveTeacherRole(now) } },
      },
      enrollment_ref: {
        status: 'ACTIVE',
        valid_from: { lte: now },
        OR: [{ valid_to: null }, { valid_to: { gt: now } }],
        subject_ref: { archived_at: null },
      },
    },
    select: { id: true, enrollment_ref: { select: { student_id: true } } },
  });
}
