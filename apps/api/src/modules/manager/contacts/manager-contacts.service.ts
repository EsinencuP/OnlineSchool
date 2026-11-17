import { Injectable } from '@nestjs/common';
import type { Prisma } from '@online-school/db';
import { err, ok } from '@online-school/shared';
import type { Result } from '@online-school/shared';
import { databaseError } from '../../../core/errors/database-error.js';
import { domainError } from '../../../core/errors/domain-error.js';
import type { DomainError } from '../../../core/errors/domain-error.js';
import type { CriticalContext } from '../../../core/http.js';
import { UUID } from '../../../core/http.js';
import { TransactionService } from '../../../core/transaction/transaction.service.js';
import { at } from '../../finance/finance-common.js';
import type { ManagerContext } from '../context/manager-context.js';
import { ManagerScopeService } from '../scope/manager-scope.service.js';
import { OPEN_TASK_STATUSES, taskPortfolioWhere } from '../tasks/task-read.spec.js';
import type {
  ContactChannelName,
  ContactDto,
  ContactPageDto,
  ContactResultName,
  ListContactsQueryDto,
  PendingContactsDto,
  RecordContactDto,
} from './manager-contacts.dto.js';

const PENDING_LIMIT = 50;
/** Tasks that oblige a manager to reach someone. */
const CONTACT_TASK_TYPES = [
  'LEAD_FOLLOWUP',
  'TRIAL_FOLLOW_UP',
  'FOLLOW_UP',
  'PAYMENT_FOLLOW_UP',
  'SUBSCRIPTION_EXPIRING',
  'ATTENDANCE_DISPUTE',
  'RESCHEDULE_REQUEST',
] as const;
const FUTURE_TOLERANCE_MS = 60_000;

type Subject = { kind: 'LEAD' | 'STUDENT' | 'TEACHER'; id: string };
type Row = Prisma.ContactLogGetPayload<{
  include: { manager: { select: { full_name: true } }; correction: { select: { id: true } } };
}>;
const include = {
  manager: { select: { full_name: true } },
  correction: { select: { id: true } },
} as const;

const subjectOf = (row: {
  lead_id: string | null;
  student_id: string | null;
  teacher_id: string | null;
}): Subject => {
  if (row.lead_id) return { kind: 'LEAD', id: row.lead_id };
  if (row.student_id) return { kind: 'STUDENT', id: row.student_id };
  return { kind: 'TEACHER', id: row.teacher_id! };
};
const view = (r: Row): ContactDto => {
  const subject = subjectOf(r);
  return {
    contactId: r.id,
    subjectKind: subject.kind,
    subjectId: subject.id,
    representativeId: r.representative_id,
    taskId: r.task_id,
    correctsId: r.corrects_id,
    supersededById: r.correction?.id ?? null,
    channel: r.channel as ContactChannelName,
    result: r.result as ContactResultName,
    summary: r.outcome,
    nextAction: r.next_action,
    occurredAt: r.occurred_at.toISOString(),
    recordedAt: r.created_at.toISOString(),
    managerId: r.manager_id,
    managerName: r.manager.full_name,
  };
};
const encode = (r: { occurred_at: Date; id: string }) =>
  Buffer.from(JSON.stringify([r.occurred_at.toISOString(), r.id])).toString('base64url');
function decode(cursor: string): { at: Date; id: string } | null {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (
      Array.isArray(parsed) &&
      typeof parsed[0] === 'string' &&
      typeof parsed[1] === 'string' &&
      UUID.test(parsed[1]) &&
      Number.isFinite(Date.parse(parsed[0]))
    )
      return { at: new Date(parsed[0]), id: parsed[1] };
  } catch {
    /* invalid */
  }
  return null;
}

/** DEV-10/B + 8.2/B: manual, append-only record of what the manager did to reach people. */
@Injectable()
export class ManagerContactsService {
  constructor(
    private readonly transactions: TransactionService,
    private readonly scope: ManagerScopeService,
  ) {}

  private explicitSubject(ids: {
    leadId?: string | undefined;
    studentId?: string | undefined;
    teacherId?: string | undefined;
  }): Subject | null {
    const found: Subject[] = [
      ...(ids.leadId ? [{ kind: 'LEAD' as const, id: ids.leadId }] : []),
      ...(ids.studentId ? [{ kind: 'STUDENT' as const, id: ids.studentId }] : []),
      ...(ids.teacherId ? [{ kind: 'TEACHER' as const, id: ids.teacherId }] : []),
    ];
    return found.length === 1 ? found[0]! : null;
  }

  /** Same 404 for a missing and a foreign subject: the journal never reveals who is not yours. */
  private async access(
    ctx: ManagerContext,
    subject: Subject,
    tx: Prisma.TransactionClient,
  ): Promise<Result<void, DomainError>> {
    if (subject.kind === 'LEAD') return this.scope.assertLeadInPortfolio(ctx, subject.id, tx);
    if (subject.kind === 'STUDENT') return this.scope.assertStudentInPortfolio(ctx, subject.id, tx);
    const now = new Date();
    const teaches = UUID.test(subject.id)
      ? await tx.teachingAssignment.findFirst({
          where: {
            teacher_id: subject.id,
            valid_from: { lte: now },
            OR: [{ valid_to: null }, { valid_to: { gt: now } }],
            enrollment_ref: { student_ref: this.scope.portfolioWhere(ctx, now) },
          },
          select: { id: true },
        })
      : null;
    return teaches ? ok(undefined) : err(domainError('CONTACT_SUBJECT_NOT_FOUND', 404));
  }

  private notFound = <T>(result: Result<T, DomainError>): Result<T, DomainError> =>
    !result.ok && result.error.status === 404
      ? err(domainError('CONTACT_SUBJECT_NOT_FOUND', 404))
      : result;

  async record(
    ctx: ManagerContext,
    input: RecordContactDto,
    c: CriticalContext,
  ): Promise<Result<ContactDto, DomainError>> {
    const current = await this.scope.resolveContext({ ...c.actor, requestId: c.requestId }, c.tx);
    if (!current.ok) return current;
    if (current.value.managerId !== ctx.managerId) return err(domainError('FORBIDDEN_ROLE', 403));
    try {
      const tx = c.tx;
      const now = await at(tx);
      const given = this.explicitSubject(input);
      let subject: Subject;
      if (input.correctsId) {
        const original = await tx.contactLog.findUnique({
          where: { id: input.correctsId },
          include: { correction: { select: { id: true } } },
        });
        const origin = original ? subjectOf(original) : null;
        if (!original || !origin) return err(domainError('CONTACT_NOT_FOUND', 404));
        const allowed = this.notFound(await this.access(ctx, origin, tx));
        if (!allowed.ok) return err(domainError('CONTACT_NOT_FOUND', 404));
        if (original.correction) return err(domainError('CONTACT_ALREADY_CORRECTED', 409));
        if (given && (given.kind !== origin.kind || given.id !== origin.id))
          return err(domainError('CONTACT_SUBJECT_MISMATCH', 422));
        if (!given && (input.leadId || input.studentId || input.teacherId))
          return err(domainError('INVALID_INPUT', 422));
        subject = origin;
      } else {
        if (!given) return err(domainError('CONTACT_SUBJECT_REQUIRED', 422));
        const allowed = this.notFound(await this.access(ctx, given, tx));
        if (!allowed.ok) return allowed;
        subject = given;
      }
      if (input.representativeId) {
        if (subject.kind !== 'STUDENT') return err(domainError('INVALID_INPUT', 422));
        const link = await tx.studentRepresentativeLink.findFirst({
          where: {
            student_id: subject.id,
            representative_id: input.representativeId,
            valid_from: { lte: now },
            OR: [{ valid_to: null }, { valid_to: { gt: now } }],
          },
          select: { id: true },
        });
        if (!link) return err(domainError('REPRESENTATIVE_NOT_FOUND', 404));
      }
      if (input.taskId) {
        const task = await tx.crmTask.findFirst({
          where: {
            AND: [
              { id: input.taskId },
              taskPortfolioWhere(
                this.scope.portfolioWhere(ctx, now),
                this.scope.leadWhere(ctx, now),
                ctx.managerId,
              ),
            ],
          },
          select: { id: true },
        });
        if (!task) return err(domainError('TASK_NOT_FOUND', 404));
      }
      const occurredAt = input.occurredAt ? new Date(input.occurredAt) : now;
      if (!Number.isFinite(+occurredAt) || +occurredAt > +now + FUTURE_TOLERANCE_MS)
        return err(domainError('CONTACT_IN_FUTURE', 422));
      const row = await tx.contactLog.create({
        data: {
          manager_id: ctx.managerId,
          lead_id: subject.kind === 'LEAD' ? subject.id : null,
          student_id: subject.kind === 'STUDENT' ? subject.id : null,
          teacher_id: subject.kind === 'TEACHER' ? subject.id : null,
          representative_id: input.representativeId ?? null,
          task_id: input.taskId ?? null,
          corrects_id: input.correctsId ?? null,
          channel: input.channel,
          result: input.result,
          outcome: input.summary.trim(),
          next_action: input.nextAction?.trim() ?? null,
          occurred_at: occurredAt,
          created_at: now,
        },
        include,
      });
      return ok(view(row));
    } catch (error: unknown) {
      return err(databaseError(error));
    }
  }

  list(ctx: ManagerContext, q: ListContactsQueryDto): Promise<Result<ContactPageDto, DomainError>> {
    return this.transactions.runReadOnly(async (tx) => {
      const subject = this.explicitSubject(q);
      if (!subject) return err(domainError('CONTACT_SUBJECT_REQUIRED', 422));
      const allowed = this.notFound(await this.access(ctx, subject, tx));
      if (!allowed.ok) return allowed;
      const limit = q.limit ?? 20;
      const cursor = q.cursor ? decode(q.cursor) : null;
      if (q.cursor && !cursor) return err(domainError('INVALID_CURSOR', 422));
      const column = { LEAD: 'lead_id', STUDENT: 'student_id', TEACHER: 'teacher_id' }[
        subject.kind
      ];
      // The journal belongs to the subject, not to one manager: a new manager inherits the history.
      const rows = await tx.contactLog.findMany({
        where: {
          [column]: subject.id,
          ...(cursor
            ? {
                OR: [
                  { occurred_at: { lt: cursor.at } },
                  { occurred_at: cursor.at, id: { lt: cursor.id } },
                ],
              }
            : {}),
        },
        orderBy: [{ occurred_at: 'desc' }, { id: 'desc' }],
        take: limit + 1,
        include,
      });
      const page = rows.slice(0, limit);
      const last = page[page.length - 1];
      return ok({
        items: page.map(view),
        nextCursor: rows.length > limit && last ? encode(last) : null,
      });
    });
  }

  /** MGR-04: open tasks that oblige a contact, with the freshest recorded result. */
  pending(ctx: ManagerContext): Promise<Result<PendingContactsDto, DomainError>> {
    return this.transactions.runReadOnly(async (tx) => {
      const now = new Date();
      const tasks = await tx.crmTask.findMany({
        where: {
          AND: [
            taskPortfolioWhere(
              this.scope.portfolioWhere(ctx, now),
              this.scope.leadWhere(ctx, now),
              ctx.managerId,
            ),
            { status: { in: [...OPEN_TASK_STATUSES] }, type: { in: [...CONTACT_TASK_TYPES] } },
          ],
        },
        orderBy: [{ due_at: 'asc' }, { id: 'asc' }],
        take: PENDING_LIMIT,
        select: {
          id: true,
          type: true,
          title: true,
          due_at: true,
          student: { select: { id: true, full_name: true } },
          lead: { select: { id: true, full_name: true } },
        },
      });
      const studentIds = tasks.flatMap((t) => (t.student ? [t.student.id] : []));
      const leadIds = tasks.flatMap((t) => (t.lead ? [t.lead.id] : []));
      const latest =
        studentIds.length + leadIds.length
          ? await tx.contactLog.findMany({
              where: {
                correction: null,
                OR: [{ student_id: { in: studentIds } }, { lead_id: { in: leadIds } }],
              },
              orderBy: [{ occurred_at: 'desc' }, { id: 'desc' }],
              select: {
                student_id: true,
                lead_id: true,
                occurred_at: true,
                channel: true,
                result: true,
              },
            })
          : [];
      return ok({
        items: tasks.flatMap((t) => {
          const person = t.lead ?? t.student;
          if (!person) return [];
          const last = latest.find((l) =>
            t.lead ? l.lead_id === person.id : l.student_id === person.id,
          );
          return [
            {
              taskId: t.id,
              taskType: t.type,
              title: t.title,
              dueAt: t.due_at.toISOString(),
              overdue: t.due_at < now,
              subjectKind: t.lead ? ('LEAD' as const) : ('STUDENT' as const),
              subjectId: person.id,
              subjectName: person.full_name,
              lastContact: last
                ? {
                    occurredAt: last.occurred_at.toISOString(),
                    channel: last.channel as ContactChannelName,
                    result: last.result as ContactResultName,
                  }
                : null,
            },
          ];
        }),
      });
    });
  }
}
