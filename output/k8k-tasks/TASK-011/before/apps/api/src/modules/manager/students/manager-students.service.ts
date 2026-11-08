import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Prisma } from '@online-school/db';
import { err, ok } from '@online-school/shared';
import type { Result } from '@online-school/shared';
import type { CriticalContext } from '../../../core/http.js';
import { domainError } from '../../../core/errors/domain-error.js';
import type { DomainError } from '../../../core/errors/domain-error.js';
import { TransactionService } from '../../../core/transaction/transaction.service.js';
import { AuditService } from '../../../core/audit/audit.service.js';
import type { ManagerContext } from '../context/manager-context.js';
import type {
  CreateStudentDto,
  ListStudentsQueryDto,
  StudentCardDto,
  StudentListPageDto,
  UpdateStudentContactsDto,
} from '../dto/student-crm.dto.js';
import { ManagerScopeService } from '../scope/manager-scope.service.js';
import { ManagerStudentsRead, projectListItem } from './students.read.js';
import { readCursor, writeCursor } from './student-cursor.js';

@Injectable()
export class ManagerStudentsService {
  constructor(
    private readonly scope: ManagerScopeService,
    private readonly read: ManagerStudentsRead,
    private readonly transactions: TransactionService,
    private readonly audit: AuditService,
  ) {}

  async list(
    ctx: ManagerContext,
    q: ListStudentsQueryDto,
  ): Promise<Result<StudentListPageDto, DomainError>> {
    const cursor = readCursor(ctx, q);
    if (!cursor.ok) return cursor;
    const rows = await this.read.list(ctx, q, cursor.value);
    if (!rows.ok) return rows;
    const page = rows.value[0];
    if (!page) return err(domainError('DATABASE_ERROR', 503));
    if (!page.cursor_valid) return err(domainError('INVALID_CURSOR', 422));
    try {
      const items = page.items.slice(0, q.limit).map(projectListItem);
      if (page.items.length <= q.limit) return ok({ items, nextCursor: null });
      const next = writeCursor(ctx, q, items[items.length - 1]!.studentId, cursor.value.now);
      return next.ok ? ok({ items, nextCursor: next.value }) : next;
    } catch {
      return err(domainError('DATABASE_ERROR', 503));
    }
  }

  private async record(
    ctx: ManagerContext,
    tx: Prisma.TransactionClient,
    studentId: string,
    action: string,
    operationId: string,
    fields: string[] = [],
  ): Promise<Result<string, DomainError>> {
    try {
      const auditId = randomUUID();
      await this.audit.record(
        {
          id: auditId,
          actor_kind: 'ACCOUNT',
          actor_id: ctx.accountId,
          action,
          resource_type: 'Student',
          resource_id: studentId,
          result: 'SUCCESS',
          request_id: ctx.requestId,
          source_operation_id: operationId,
          event_key: `manager:${action}:${operationId}:${studentId}`,
          metadata: {
            changedFields: fields,
            maskedValues: Object.fromEntries(fields.map((field) => [field, '[redacted]'])),
          },
        },
        tx,
      );
      return ok(auditId);
    } catch {
      return err(domainError('AUDIT_UNAVAILABLE', 503));
    }
  }

  async getCard(
    ctx: ManagerContext,
    studentId: string,
  ): Promise<Result<StudentCardDto, DomainError>> {
    const operationId = randomUUID();
    return this.transactions.runResult(async (tx) => {
      const allowed = await this.scope.assertStudentInPortfolio(ctx, studentId, tx);
      if (!allowed.ok) return allowed;
      const card = await this.read.card(ctx, studentId, tx);
      if (!card.ok) return card;
      const audit = await this.record(ctx, tx, studentId, 'STUDENT_PII_VIEWED', operationId);
      return audit.ok ? card : audit;
    });
  }

  private async guardian(
    tx: Prisma.TransactionClient,
    studentId: string,
    name: string | null | undefined,
  ): Promise<Result<void, DomainError>> {
    if (name === undefined) return ok(undefined);
    try {
      const now = new Date();
      // Replace only the local, unverified contact link. Never edit a shared representative.
      await tx.studentRepresentativeLink.updateMany({
        where: {
          student_id: studentId,
          basis: 'CRM_CONTACT_ONLY',
          verification_status: 'PENDING',
          valid_to: null,
        },
        data: { valid_to: now },
      });
      if (name) {
        const contact = await tx.representative.create({ data: { full_name: name } });
        await tx.studentRepresentativeLink.create({
          data: {
            student_id: studentId,
            representative_id: contact.id,
            role: 'AUTHORIZED_CONTACT',
            basis: 'CRM_CONTACT_ONLY',
            verification_status: 'PENDING',
            valid_from: now,
          },
        });
      }
      return ok(undefined);
    } catch {
      return err(domainError('DATABASE_ERROR', 503));
    }
  }

  async create(
    ctx: ManagerContext,
    dto: CreateStudentDto,
    idempotencyKey: string,
    command: CriticalContext,
  ): Promise<Result<StudentCardDto, DomainError>> {
    const active = await this.scope.resolveContext(
      { ...command.actor, requestId: ctx.requestId },
      command.tx,
    );
    if (!active.ok) return active;
    if (active.value.managerId !== ctx.managerId) return err(domainError('FORBIDDEN_ROLE', 403));
    try {
      const student = await command.tx.student.create({
        data: {
          full_name: dto.fullName,
          phone: dto.phone ?? null,
          email: dto.email ?? null,
          manager_note: dto.managerNote ?? null,
        },
      });
      await command.tx.assignedManager.create({
        data: { student_id: student.id, manager_id: ctx.managerId },
      });
      const guardian = await this.guardian(command.tx, student.id, dto.guardianName);
      if (!guardian.ok) return guardian;
      const audit = await this.record(
        ctx,
        command.tx,
        student.id,
        'STUDENT_CREATED',
        idempotencyKey,
        Object.keys(dto).filter((key) => dto[key as keyof CreateStudentDto] !== undefined),
      );
      if (!audit.ok) return audit;
      return this.read.card(ctx, student.id, command.tx);
    } catch {
      return err(domainError('DATABASE_ERROR', 503));
    }
  }

  async updateContacts(
    ctx: ManagerContext,
    studentId: string,
    dto: UpdateStudentContactsDto,
  ): Promise<Result<StudentCardDto, DomainError>> {
    const operationId = randomUUID();
    return this.transactions.runResult(async (tx) => {
      const allowed = await this.scope.assertStudentInPortfolio(ctx, studentId, tx);
      if (!allowed.ok) return allowed;
      const changed = Object.keys(dto).filter(
        (key) => key !== 'version' && dto[key as keyof UpdateStudentContactsDto] !== undefined,
      );
      try {
        const result = await tx.student.updateMany({
          where: { AND: [{ id: studentId, version: dto.version }, this.scope.portfolioWhere(ctx)] },
          data: {
            ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
            ...(dto.email !== undefined ? { email: dto.email } : {}),
            ...(dto.managerNote !== undefined ? { manager_note: dto.managerNote } : {}),
            version: { increment: 1 },
          },
        });
        if (result.count !== 1) return err(domainError('VERSION_CONFLICT', 409));
        const guardian = await this.guardian(tx, studentId, dto.guardianName);
        if (!guardian.ok) return guardian;
        const audit = await this.record(
          ctx,
          tx,
          studentId,
          'STUDENT_CONTACTS_UPDATED',
          operationId,
          changed,
        );
        if (!audit.ok) return audit;
        const eventId = randomUUID();
        await tx.outboxEvent.create({
          data: {
            id: eventId,
            topic: 'manager.student.contacts-updated.v1',
            aggregate_type: 'Student',
            aggregate_id: studentId,
            source_operation_id: operationId,
            audit_event_id: audit.value,
            event_key: `manager:contacts:${operationId}`,
            payload: { schemaVersion: 1, studentId, changedFields: changed },
          },
        });
        return this.read.card(ctx, studentId, tx);
      } catch {
        return err(domainError('DATABASE_ERROR', 503));
      }
    });
  }
}
