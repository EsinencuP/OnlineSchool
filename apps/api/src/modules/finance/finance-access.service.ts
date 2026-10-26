import { Injectable } from '@nestjs/common';
import type { CriticalContext } from '../../core/http.js';
import { domainError, fail, unwrap } from '../../core/errors/domain-error.js';
import { PolicyService } from '../../core/policy/policy.service.js';
import { uuid } from '../identity/input.js';

@Injectable()
export class FinanceAccess {
  constructor(private readonly policy: PolicyService) {}
  async staff(ctx: CriticalContext, director = false): Promise<string> {
    if (
      !ctx.actor.mfaCompleted ||
      ctx.actor.recoveryOnly ||
      !ctx.actor.roles.some((r) =>
        director ? r === 'DIRECTOR' : ['DIRECTOR', 'MANAGER'].includes(r),
      )
    )
      return fail(domainError('FORBIDDEN', 403));
    const row = await ctx.tx.staffAccount.findFirst({
      where: { account_id: ctx.actor.accountId, deactivated_at: null },
      select: { id: true },
    });
    return row?.id ?? fail(domainError('FORBIDDEN', 403));
  }
  async student(ctx: CriticalContext, id: string): Promise<void> {
    await this.staff(ctx);
    unwrap(await this.policy.canAccessStudent(ctx.actor, uuid(id), ctx.tx));
  }
  async subscription(ctx: CriticalContext, id: string) {
    const sub = await ctx.tx.subscription.findUnique({ where: { id: uuid(id) } });
    if (!sub) return fail(domainError('NOT_FOUND', 404));
    const enrollment = await ctx.tx.studentSubjectEnrollment.findUniqueOrThrow({
      where: { id: sub.enrollment_id },
    });
    await this.student(ctx, enrollment.student_id);
    return { sub, enrollment };
  }
  async payment(ctx: CriticalContext, id: string) {
    const receipt = await ctx.tx.paymentReceipt.findUnique({ where: { id: uuid(id) } });
    if (!receipt) return fail(domainError('NOT_FOUND', 404));
    await this.staff(ctx);
    if (!ctx.actor.roles.includes('DIRECTOR')) {
      if (!receipt.student_id) return fail(domainError('FORBIDDEN', 403));
      await this.student(ctx, receipt.student_id);
    }
    return receipt;
  }
}
