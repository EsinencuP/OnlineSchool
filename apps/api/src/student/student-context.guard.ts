import { Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { AuditService } from '../core/audit/audit.service.js';
import { domainError, fail, unwrap } from '../core/errors/domain-error.js';
import { MeService } from './me/me.service.js';
import { isStudentRequest } from './student-context.interface.js';
import type { StudentRequest } from './student-context.interface.js';
@Injectable()
export class StudentContextGuard implements CanActivate {
  private readonly pending = new WeakMap<
    StudentRequest,
    { userId: string; promise: Promise<boolean> }
  >();
  constructor(
    private readonly me: MeService,
    private readonly audit: AuditService,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<StudentRequest>();
    if (!isStudentRequest(req)) return true;
    if (!req.account) return fail(domainError('UNAUTHENTICATED', 401));
    if (req.account.kind !== 'STUDENT' || !req.account.roles.includes('STUDENT')) {
      unwrap(
        await this.audit.denial({
          requestId: req.requestId!,
          actor: req.account,
          action: 'student.context.denied',
          code: 'FORBIDDEN',
        }),
      );
      return fail(domainError('FORBIDDEN', 403));
    }
    if (
      req.studentCtx?.userId === req.account.accountId &&
      req.studentMe?.userId === req.account.accountId
    )
      return true;
    let pending = this.pending.get(req);
    if (!pending || pending.userId !== req.account.accountId) {
      delete req.studentCtx;
      delete req.studentMe;
      pending = { userId: req.account.accountId, promise: this.load(req, req.account.accountId) };
      this.pending.set(req, pending);
    }
    return pending.promise;
  }
  private async load(req: StudentRequest, userId: string): Promise<boolean> {
    const result = await this.me.load(userId);
    if (req.account?.accountId !== userId) return fail(domainError('UNAUTHENTICATED', 401));
    if (!result.ok) {
      unwrap(
        await this.audit.denial({
          requestId: req.requestId!,
          actor: req.account!,
          action: 'student.context.denied',
          code: result.error.code,
        }),
      );
      return fail(result.error);
    }
    req.studentCtx = result.value.context;
    req.studentMe = result.value.me;
    return true;
  }
}
