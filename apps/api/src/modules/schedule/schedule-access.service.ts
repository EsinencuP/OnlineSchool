import { Injectable } from '@nestjs/common';
import type { CriticalContext } from '../../core/http.js';
import { domainError, fail, unwrap } from '../../core/errors/domain-error.js';
import { PolicyService } from '../../core/policy/policy.service.js';
import { uuid } from '../identity/input.js';

@Injectable()
export class ScheduleAccess {
  constructor(private readonly policy: PolicyService) {}
  async staff(ctx: CriticalContext) {
    if (
      !ctx.actor.mfaCompleted ||
      !ctx.actor.roles.some((r) => ['DIRECTOR', 'MANAGER'].includes(r))
    )
      return fail(domainError('FORBIDDEN', 403));
    const row = await ctx.tx.staffAccount.findFirst({
      where: { account_id: ctx.actor.accountId, deactivated_at: null },
    });
    return row?.id ?? fail(domainError('FORBIDDEN', 403));
  }
  async student(ctx: CriticalContext, id: string) {
    await this.staff(ctx);
    unwrap(await this.policy.canAccessStudent(ctx.actor, uuid(id), ctx.tx));
  }
  async enrollment(ctx: CriticalContext, id: string) {
    const en = await ctx.tx.studentSubjectEnrollment.findUnique({ where: { id: uuid(id) } });
    if (!en) return fail(domainError('NOT_FOUND', 404));
    await this.student(ctx, en.student_id);
    return en;
  }
  async teacher(ctx: CriticalContext) {
    if (!ctx.actor.mfaCompleted || !ctx.actor.roles.includes('TEACHER'))
      return fail(domainError('FORBIDDEN', 403));
    const t = await ctx.tx.teacherAccount.findFirst({
      where: { account_id: ctx.actor.accountId, deactivated_at: null },
    });
    return t?.id ?? fail(domainError('FORBIDDEN', 403));
  }
  async lesson(ctx: CriticalContext, id: string, own = false) {
    const lesson = await ctx.tx.lessonOccurrence.findUnique({ where: { id: uuid(id) } });
    if (!lesson) return fail(domainError('NOT_FOUND', 404));
    if (own) {
      if (lesson.scheduled_teacher_id !== (await this.teacher(ctx)))
        return fail(domainError('FORBIDDEN', 403));
    } else await this.enrollment(ctx, lesson.enrollment_id);
    return lesson;
  }
}
