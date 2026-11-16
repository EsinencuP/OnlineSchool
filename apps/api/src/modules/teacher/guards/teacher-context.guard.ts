import { Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { AuditService } from '../../../core/audit/audit.service.js';
import { DatabaseService } from '../../../core/database/database.module.js';
import { domainError, fail, unwrap } from '../../../core/errors/domain-error.js';
import type { TeacherRequest } from '../context/teacher-context.js';

@Injectable()
export class TeacherContextGuard implements CanActivate {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<TeacherRequest>();
    delete req.teacherCtx;
    const actor = req.account;
    if (!actor) return fail(domainError('UNAUTHENTICATED', 401));
    let code: string | null = null;
    if (actor.kind !== 'TEACHER' || actor.roles.length !== 1 || actor.roles[0] !== 'TEACHER')
      code = 'FORBIDDEN_ROLE';
    const profile = code
      ? null
      : await this.db.client.teacherAccount.findFirst({
          where: { account_id: actor.accountId, account_kind: 'TEACHER' },
          select: { id: true, deactivated_at: true },
        });
    if (!code && !profile) code = 'TEACHER_PROFILE_NOT_FOUND';
    if (!code && profile!.deactivated_at) code = 'TEACHER_INACTIVE';
    if (code) {
      unwrap(
        await this.audit.denial({
          requestId: req.requestId!,
          actor,
          action: 'teacher.context.denied',
          code,
        }),
      );
      return fail(domainError(code, 403));
    }
    req.teacherCtx = Object.freeze({
      accountId: actor.accountId,
      teacherId: profile!.id,
      sessionId: actor.sessionId,
      requestId: req.requestId!,
    });
    return true;
  }
}
