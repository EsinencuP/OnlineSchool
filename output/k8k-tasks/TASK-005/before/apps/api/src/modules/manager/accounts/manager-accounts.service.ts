import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { NotificationOutboxPublisher } from '../../notifications/notification-outbox.publisher.js';
import { unwrap } from '../../../core/errors/domain-error.js';
import { ok, err } from '@online-school/shared';
import type { Result } from '@online-school/shared';
import type { DomainError } from '../../../core/errors/domain-error.js';
import { databaseError } from '../../../core/errors/database-error.js';
import { AuditService } from '../../../core/audit/audit.service.js';
import type { CriticalContext } from '../../../core/http.js';
import { IdentityService } from '../../identity/identity.service.js';
import type { IssuedStudentIdentity } from '../../identity/student-account-provisioning.js';
import type { ManagerContext } from '../context/manager-context.js';
import type {
  CreateStudentAccountDto,
  StudentAccountIssuedDto,
} from '../dto/student-account.dto.js';

@Injectable()
export class ManagerAccountsService {
  constructor(
    private readonly identity: IdentityService,
    private readonly audit: AuditService,
  ) {}
  private async record(
    ctx: ManagerContext,
    studentId: string,
    key: string,
    command: CriticalContext,
    issued: IssuedStudentIdentity,
    create: boolean,
  ): Promise<Result<StudentAccountIssuedDto, DomainError>> {
    try {
      const auditId = randomUUID(),
        action = create ? 'STUDENT_ACCOUNT_CREATED' : 'STUDENT_PASSWORD_RESET';
      const issuedAt = new Date(
        new Date(issued.temporaryPasswordExpiresAt).getTime() - 72 * 3600000,
      );
      await this.audit.record(
        {
          id: auditId,
          actor_kind: 'ACCOUNT',
          actor_id: ctx.accountId,
          action,
          resource_type: 'Student',
          resource_id: studentId,
          request_id: ctx.requestId,
          result: 'SUCCESS',
          source_operation_id: key,
          event_key: `manager:${action}:${key}:${studentId}`,
          recorded_at: issuedAt,
          metadata: { studentId, accountId: issued.accountId, loginEmail: '[redacted]' },
        },
        command.tx,
      );
      if (create)
        await command.tx.outboxEvent.create({
          data: {
            topic: 'manager.student.account-created.v1',
            aggregate_type: 'Student',
            aggregate_id: studentId,
            audit_event_id: auditId,
            source_operation_id: key,
            event_key: `manager:account-notice:${key}:${studentId}`,
            payload: {
              schemaVersion: 1,
              studentId,
              accountId: issued.accountId,
              loginEmail: issued.loginEmail,
              instruction: 'CHANGE_TEMPORARY_PASSWORD',
            },
            created_at: issuedAt,
          },
        });
      if (create)
        unwrap(
          await new NotificationOutboxPublisher().enqueue(command.tx, {
            studentId,
            templateCode: 'ACCOUNT_CREATED',
            variables: { accountId: issued.accountId, loginEmail: issued.loginEmail },
            dedupeKey: `account-created:${issued.accountId}`,
            operationId: key,
            actorId: ctx.accountId,
            requestId: ctx.requestId,
          }),
        );
      return ok({ ...issued, passwordAlreadyIssued: false });
    } catch (error: unknown) {
      return err(databaseError(error));
    }
  }
  async createAccount(
    ctx: ManagerContext,
    studentId: string,
    dto: CreateStudentAccountDto,
    key: string,
    command: CriticalContext,
  ): Promise<Result<StudentAccountIssuedDto, DomainError>> {
    const result = await this.identity.createStudentAccount(command.tx, {
      studentId,
      loginEmail: dto.loginEmail,
      actorAccountId: ctx.accountId,
      actorStaffId: ctx.managerId,
    });
    return result.ok ? this.record(ctx, studentId, key, command, result.value, true) : result;
  }
  async resetPassword(
    ctx: ManagerContext,
    studentId: string,
    key: string,
    command: CriticalContext,
  ): Promise<Result<StudentAccountIssuedDto, DomainError>> {
    const result = await this.identity.resetStudentPassword(command.tx, {
      studentId,
      actorAccountId: ctx.accountId,
      actorStaffId: ctx.managerId,
    });
    return result.ok ? this.record(ctx, studentId, key, command, result.value, false) : result;
  }
}
