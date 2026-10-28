import { Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { domainError, fail, unwrap } from '../core/errors/domain-error.js';
import { AuditService } from '../core/audit/audit.service.js';
import { isStudentRequest, StudentErrors } from './student-context.interface.js';
import type { StudentRequest } from './student-context.interface.js';
import { studentBootstrapRoute } from './access-policy.js';
@Injectable()
export class ActiveSubscriptionGuard implements CanActivate {
  constructor(private readonly audit: AuditService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<StudentRequest>();
    if (!isStudentRequest(req)) return true;
    if (studentBootstrapRoute(req)) return true;
    const student = req.studentCtx;
    if (!student) return fail(domainError(StudentErrors.PROFILE_NOT_FOUND, 403));
    const code = student.mustChangePassword
      ? StudentErrors.MUST_CHANGE_PASSWORD
      : !student.hasActiveAccess
        ? StudentErrors.ACCESS_SUSPENDED
        : undefined;
    if (!code) return true;
    const error = domainError(code, code === StudentErrors.ACCESS_SUSPENDED ? 402 : 403);
    if (code === StudentErrors.ACCESS_SUSPENDED)
      error.details = {
        managerContacts: student.managerContacts ?? { whatsapp: '', telegram: '' },
      };
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
