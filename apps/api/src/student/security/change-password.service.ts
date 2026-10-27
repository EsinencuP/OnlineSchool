import { Injectable } from '@nestjs/common';
import { err } from '@online-school/shared';
import type { Result } from '@online-school/shared';
import type { DomainError } from '../../core/errors/domain-error.js';
import { domainError, fail } from '../../core/errors/domain-error.js';
import { SessionStore } from '../../core/session/session.store.js';
import { IdentityService } from '../../modules/identity/identity.service.js';
import type { IdentityOutcome } from '../../modules/identity/identity.service.js';
import { Passwords } from '../../modules/identity/passwords.js';
import type { IStudentContext, StudentRequest } from '../student-context.interface.js';
import type { ChangeStudentPasswordDto } from './change-password.dto.js';
@Injectable()
export class ChangeStudentPasswordService {
  constructor(
    private readonly identity: IdentityService,
    private readonly passwords: Passwords,
    private readonly sessions: SessionStore,
  ) {}
  change(
    req: StudentRequest,
    student: IStudentContext,
    input: ChangeStudentPasswordDto,
  ): Promise<Result<IdentityOutcome, DomainError>> {
    if (
      !input ||
      typeof input !== 'object' ||
      Array.isArray(input) ||
      Object.keys(input).some((key) => !['currentPassword', 'newPassword'].includes(key)) ||
      typeof input.currentPassword !== 'string' ||
      input.currentPassword.length < 1 ||
      input.currentPassword.length > 256 ||
      typeof input.newPassword !== 'string' ||
      input.newPassword.length < 12 ||
      input.newPassword.length > 256
    )
      return Promise.resolve(err(domainError('INVALID_INPUT', 400)));
    return this.identity.execute(
      req,
      'student.password.change',
      async (tx) => {
        const actor = await this.identity.actor(req, tx);
        if (
          actor.kind !== 'STUDENT' ||
          !actor.roles.includes('STUDENT') ||
          actor.accountId !== student.userId
        )
          return fail(domainError('FORBIDDEN', 403));
        // Identity.account locks AuthAccount before checking the current credential and roles.
        const account = await this.identity.account(tx, actor.accountId);
        const profile = await tx.studentAccount.findFirst({
          where: {
            account_id: account.id,
            student_id: student.studentProfileId,
            deactivated_at: null,
          },
        });
        if (!profile) return fail(domainError('STUDENT_PROFILE_NOT_FOUND', 403));
        if (!(await this.passwords.verify(input.currentPassword, account.password_hash)))
          return fail(domainError('CURRENT_PASSWORD_INVALID', 400));
        if (input.currentPassword === input.newPassword)
          return fail(domainError('PASSWORD_MUST_DIFFER', 400));
        const hashed = await this.passwords.hash(input.newPassword);
        if (!hashed.ok) return fail(hashed.error);
        await tx.authAccount.update({
          where: { id: account.id },
          data: { password_hash: hashed.value },
        });
        await tx.studentAccount.update({
          where: { id: profile.id },
          data: { must_change_password: false },
        });
        await this.identity.revoke(tx, account.id, account.id, 'STUDENT_PASSWORD_CHANGED', true);
        const issued = await this.sessions.issue(tx, account.id);
        // execute() appends the mandatory audit/outbox pair in this same transaction.
        // Passwords, hashes and session/CSRF tokens never enter event payloads.
        return {
          actorId: account.id,
          resourceType: 'StudentAccount',
          resourceId: profile.id,
          issued,
          body: { mustChangePassword: false },
        };
      },
      student.userId,
    );
  }
}
