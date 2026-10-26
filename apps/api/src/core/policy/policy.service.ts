import { Injectable, Module } from '@nestjs/common';
import type { Prisma, RoleCode } from '@online-school/db';
import { err, ok } from '@online-school/shared';
import type { Result } from '@online-school/shared';
import type { AccountContext } from '../http.js';
import { UUID } from '../http.js';
import { DatabaseService } from '../database/database.module.js';
import { domainError } from '../errors/domain-error.js';
import type { DomainError } from '../errors/domain-error.js';

// Explicit command permissions. Tech operations confer no financial or scheduling authority.
const permissions: Record<RoleCode, readonly string[]> = {
  DIRECTOR: [
    'schedule:manage',
    'payment:register',
    'payment:distribute',
    'payment:confirm',
    'distribution:approve',
    'subscription:create',
    'entitlement:grant',
    'entitlement:consume',
    'entitlement:adjust',
    'temporary-access:grant',
    'ledger:publish',
    'ledger:adjust',
    'period:read',
    'period:close',
    'payroll:accrue',
    'payroll:payout',
    'payroll:read',
    'student:read',
    'student:create',
    'household:manage',
  ],
  MANAGER: [
    'schedule:manage',
    'payment:register',
    'payment:distribute',
    'subscription:create',
    'entitlement:grant',
    'entitlement:consume',
    'period:read',
    'payroll:accrue',
    'payroll:payout',
    'student:read',
    'student:create',
    'household:manage',
  ],
  TEACHER: ['student:read', 'payroll:read', 'schedule:teacher'],
  STUDENT: ['student:read'],
  TECH_OPERATOR: [],
};
@Injectable()
export class PolicyService {
  constructor(private readonly db: DatabaseService) {}
  hasPermission(actor: AccountContext, permission: string): boolean {
    return actor.roles.some((role) => permissions[role].includes(permission));
  }
  async canAccessStudent(
    actor: AccountContext,
    studentId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Result<void, DomainError>> {
    if (!UUID.test(studentId) || (!actor.mfaCompleted && actor.kind !== 'STUDENT'))
      return err(domainError('FORBIDDEN', 403));
    const client = tx ?? this.db.client;
    const now = (await client.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`)[0]!.now;
    const student = await client.student.findUnique({
      where: { id: studentId },
      select: { id: true },
    });
    if (!student) return err(domainError('FORBIDDEN', 403));
    if (actor.roles.includes('DIRECTOR')) return ok(undefined);
    if (actor.roles.includes('MANAGER')) {
      const staff = await client.staffAccount.findFirst({
        where: { account_id: actor.accountId, deactivated_at: null },
        select: { id: true },
      });
      if (
        staff &&
        (await client.assignedManager.findFirst({
          where: {
            manager_id: staff.id,
            student_id: studentId,
            assigned_at: { lte: now },
            OR: [{ ended_at: null }, { ended_at: { gt: now } }],
          },
        }))
      )
        return ok(undefined);
    }
    if (actor.roles.includes('TEACHER')) {
      const teacher = await client.teacherAccount.findFirst({
        where: { account_id: actor.accountId, deactivated_at: null },
        select: { id: true },
      });
      if (
        teacher &&
        (await client.teachingAssignment.findFirst({
          where: {
            teacher_id: teacher.id,
            valid_from: { lte: now },
            OR: [{ valid_to: null }, { valid_to: { gt: now } }],
            enrollment_ref: {
              student_id: studentId,
              status: 'ACTIVE',
              valid_from: { lte: now },
              OR: [{ valid_to: null }, { valid_to: { gt: now } }],
            },
          },
        }))
      )
        return ok(undefined);
    }
    if (
      actor.roles.includes('STUDENT') &&
      (await client.studentAccount.findFirst({
        where: { account_id: actor.accountId, student_id: studentId, deactivated_at: null },
      }))
    )
      return ok(undefined);
    return err(domainError('FORBIDDEN', 403));
  }
}
@Module({ providers: [PolicyService], exports: [PolicyService] })
export class PolicyModule {}
