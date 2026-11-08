import { Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { ok } from '@online-school/shared';
import { DatabaseService } from '../../core/database/database.module.js';
import { AuditService } from '../../core/audit/audit.service.js';
import { domainError, fail, unwrap } from '../../core/errors/domain-error.js';
import { uuid } from '../../modules/identity/input.js';
import type { StudentRequest } from '../student-context.interface.js';
import { StudentHomeworkService } from './homework.service.js';

@Injectable()
export class StudentHomeworkScopeGuard implements CanActivate {
  constructor(
    private readonly database: DatabaseService,
    private readonly homework: StudentHomeworkService,
    private readonly audit: AuditService,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<StudentRequest>(),
      student = req.studentCtx;
    if (!student || !req.account) return fail(domainError('UNAUTHENTICATED', 401));
    const id = uuid(req.params.hwId);
    if (!(await this.homework.owns(this.database.client, student.studentProfileId, id))) {
      unwrap(
        await this.audit.denial({
          requestId: req.requestId!,
          actor: req.account,
          action: 'student.homework.denied',
          code: 'HOMEWORK_FORBIDDEN',
        }),
      );
      return fail(domainError('HOMEWORK_FORBIDDEN', 403));
    }
    req.resourceAuthorizer = async (tx, actor) => {
      const result = await this.homework.authorize(
        tx,
        actor.accountId,
        student.studentProfileId,
        id,
      );
      req.studentCtx = result.value;
      return ok(undefined);
    };
    if (req.originalUrl.split('?')[0]?.replace(/\/+$/, '').endsWith('/upload-url')) {
      // Runs even on cached command replay; only the file ID is persisted by idempotency.
      req.afterCriticalCommit = (body) => this.homework.uploadUrl(req.studentCtx!, id, body);
    }
    return true;
  }
}
