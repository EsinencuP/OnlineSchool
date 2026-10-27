import { Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { ok } from '@online-school/shared';
import { DatabaseService } from '../../core/database/database.module.js';
import { AuditService } from '../../core/audit/audit.service.js';
import { domainError, fail, unwrap } from '../../core/errors/domain-error.js';
import { uuid } from '../../modules/identity/input.js';
import type { StudentRequest } from '../student-context.interface.js';
import { StudentLessonsService } from './lessons.service.js';

@Injectable()
export class StudentLessonScopeGuard implements CanActivate {
  constructor(
    private readonly database: DatabaseService,
    private readonly lessons: StudentLessonsService,
    private readonly audit: AuditService,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<StudentRequest>(),
      student = req.studentCtx;
    if (!student || !req.account) return fail(domainError('UNAUTHENTICATED', 401));
    const id = uuid(req.params.lessonId);
    if (!(await this.lessons.owns(this.database.client, student.studentProfileId, id))) {
      unwrap(
        await this.audit.denial({
          requestId: req.requestId!,
          actor: req.account,
          action: req.originalUrl.split('?')[0]?.endsWith('/dispute')
            ? 'student.lesson.dispute.denied'
            : 'student.lesson.reschedule.denied',
          code: 'LESSON_FORBIDDEN',
        }),
      );
      return fail(domainError('LESSON_FORBIDDEN', 403));
    }
    // CriticalCommand rechecks this inside its SERIALIZABLE transaction, including on cached replay.
    req.resourceAuthorizer = async (tx, actor) => {
      const result = await this.lessons.authorize(tx, actor, student.studentProfileId, id);
      if (!result.ok) return result;
      req.studentCtx = result.value;
      return ok(undefined);
    };
    return true;
  }
}
