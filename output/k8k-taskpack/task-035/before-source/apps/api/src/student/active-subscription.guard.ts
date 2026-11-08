import { Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { domainError, fail, unwrap } from '../core/errors/domain-error.js';
import { AuditService } from '../core/audit/audit.service.js';
import { isStudentRequest, StudentErrors } from './student-context.interface.js';
import type { StudentRequest } from './student-context.interface.js';
import { studentBootstrapRoute } from './access-policy.js';
import { studentAccessSuspended } from './manager-contacts.js';
import { studentPasswordChangeRoute } from '../core/session/student-password-policy.js';
@Injectable()
export class ActiveSubscriptionGuard implements CanActivate {
  constructor(private readonly audit: AuditService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<StudentRequest>();
    if (!isStudentRequest(req)) return true;
    const student = req.studentCtx;
    if (!student) return fail(domainError(StudentErrors.PROFILE_NOT_FOUND, 403));
    if (student.mustChangePassword && studentPasswordChangeRoute(req)) return true;
    if (!student.mustChangePassword && studentBootstrapRoute(req)) return true;
    const code = student.mustChangePassword
      ? StudentErrors.MUST_CHANGE_PASSWORD
      : !student.hasActiveAccess
        ? StudentErrors.ACCESS_SUSPENDED
        : undefined;
    if (!code) return true;
    const error =
      code === StudentErrors.ACCESS_SUSPENDED
        ? studentAccessSuspended(student.managerContacts)
        : domainError(code, 403);
    unwrap(
      await this.audit.denial({
        requestId: req.requestId!,
        actor: req.account!,
        action: 'student.access.denied',
        code,
      }),
    );
    return fail(error);
  }
}
