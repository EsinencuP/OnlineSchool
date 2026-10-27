import { Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { domainError, fail, unwrap } from '../core/errors/domain-error.js';
import { AuditService } from '../core/audit/audit.service.js';
import { isStudentRequest, StudentErrors } from './student-context.interface.js';
import type { StudentRequest } from './student-context.interface.js';
@Injectable()
export class ActiveSubscriptionGuard implements CanActivate {
  constructor(private readonly audit: AuditService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<StudentRequest>();
    if (!isStudentRequest(req)) return true;
    const path = (req.originalUrl.split('?')[0] ?? '').toLowerCase().replace(/\/+$/, '');
    if (
      path === '/api/v1/student/me' ||
      /^\/api\/v1\/student\/(profile|security)(?:\/|$)/.test(path)
    )
      return true;
    const student = req.studentCtx;
    if (!student) return fail(domainError(StudentErrors.PROFILE_NOT_FOUND, 403));
    // STU-07: expired/no-access students must still read their plan and confirmed history.
    // Password, session and role checks remain mandatory; this is no mutation exemption.
    const subscriptionRead =
      req.method === 'GET' &&
      /^\/api\/v1\/student\/subscription(?:\/(payments|ledger))?$/.test(path);
    const code = student.mustChangePassword
      ? StudentErrors.MUST_CHANGE_PASSWORD
      : !student.hasActiveAccess && !subscriptionRead
        ? StudentErrors.ACCESS_SUSPENDED
        : undefined;
    if (!code) return true;
    const error = domainError(code, code === StudentErrors.ACCESS_SUSPENDED ? 402 : 403);
    if (code === StudentErrors.ACCESS_SUSPENDED)
      error.details = {
        managerContacts: {
          whatsapp: process.env.STUDENT_MANAGER_WHATSAPP ?? '',
          telegram: process.env.STUDENT_MANAGER_TELEGRAM ?? '',
        },
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
