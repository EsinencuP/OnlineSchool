import { Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { err, ok } from '@online-school/shared';
import type { CriticalContext, HttpRequest } from '../../core/http.js';
import { AppException, domainError, fail, unwrap } from '../../core/errors/domain-error.js';
import { DatabaseService } from '../../core/database/database.module.js';
import { AuditService } from '../../core/audit/audit.service.js';
import { uuid } from '../identity/input.js';
import { ScheduleAccess } from './schedule-access.service.js';

@Injectable()
export class ScheduleScopeGuard implements CanActivate {
  constructor(
    private readonly access: ScheduleAccess,
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
  ) {}
  async check(name: string, ctx: CriticalContext, req: HttpRequest) {
    const i = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
    if (name === 'subject') return this.access.staff(ctx);
    if (name === 'enrollment') return this.access.student(ctx, uuid(i.studentId));
    if (name === 'assign') return this.access.enrollment(ctx, uuid(i.enrollmentId));
    if (['one', 'createSlot', 'revoke'].includes(name)) {
      const a = await ctx.tx.teachingAssignment.findUnique({
        where: { id: uuid(name === 'revoke' ? req.params.id : i.teachingAssignmentId) },
      });
      if (!a) return fail(domainError('NOT_FOUND', 404));
      return this.access.enrollment(ctx, a.enrollment_id);
    }
    if (['generate', 'patchSlot'].includes(name)) {
      const slot = await ctx.tx.recurringSlot.findUnique({ where: { id: uuid(req.params.id) } });
      if (!slot) return fail(domainError('NOT_FOUND', 404));
      return this.access.enrollment(ctx, slot.enrollment_id);
    }
    if (['reschedule', 'cancel', 'confirm', 'start', 'report'].includes(name))
      return this.access.lesson(ctx, uuid(req.params.id), ['start', 'report'].includes(name));
    if (name === 'availability') {
      const teacher = await this.access.teacher(ctx);
      if (i.availabilityId !== undefined) {
        const a = await ctx.tx.teacherAvailability.findUnique({
          where: { id: uuid(i.availabilityId) },
        });
        if (!a || a.teacher_id !== teacher) return fail(domainError('FORBIDDEN', 403));
      }
      return;
    }
    if (name === 'request') {
      const teacher = await this.access.teacher(ctx);
      if (i.lessonId !== undefined) return this.access.lesson(ctx, uuid(i.lessonId), true);
      const slot = await ctx.tx.recurringSlot.findUnique({
        where: { id: uuid(i.slotId) },
        include: { teaching_assignment_ref: true },
      });
      if (!slot || slot.teaching_assignment_ref.teacher_id !== teacher)
        return fail(domainError('FORBIDDEN', 403));
      return;
    }
    return fail(domainError('FORBIDDEN', 403));
  }
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<HttpRequest>(),
      name = context.getHandler().name;
    if (!req.account) return fail(domainError('UNAUTHENTICATED', 401));
    req.resourceAuthorizer = async (tx, actor) => {
      try {
        await this.check(
          name,
          {
            tx,
            actor,
            operationId: req.idempotencyKey ?? req.requestId!,
            requestId: req.requestId!,
          },
          req,
        );
        return ok(undefined);
      } catch (error: unknown) {
        if (error instanceof AppException) return err(error.domain);
        return Promise.reject(error);
      }
    };
    const result = await this.db.client.$transaction((tx) =>
      req.resourceAuthorizer!(tx, req.account!),
    );
    if (result.ok) return true;
    unwrap(
      await this.audit.denial({
        requestId: req.requestId!,
        actor: req.account,
        action: 'schedule.access.denied',
        code: result.error.code,
      }),
    );
    return fail(result.error);
  }
}
