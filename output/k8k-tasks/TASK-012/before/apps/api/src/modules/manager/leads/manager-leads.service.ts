import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@online-school/db';
import { err, ok } from '@online-school/shared';
import type { Result } from '@online-school/shared';
import { AppException, domainError, unwrap } from '../../../core/errors/domain-error.js';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateLeadDto as IntakeDto } from '../dto/manager-lead.dto.js';
import type { DomainError } from '../../../core/errors/domain-error.js';
import { databaseError } from '../../../core/errors/database-error.js';
import type { CriticalContext } from '../../../core/http.js';
import { TransactionService } from '../../../core/transaction/transaction.service.js';
import { ManagerScopeService } from '../scope/manager-scope.service.js';
import type { ManagerContext } from '../context/manager-context.js';
import { ManagerStudentsService } from '../students/manager-students.service.js';
import { ManagerScheduleService } from '../schedule/manager-schedule.service.js';
import { NotificationOutboxPublisher } from '../../notifications/notification-outbox.publisher.js';
import { at } from '../../finance/finance-common.js';
import { effectiveMeetLink } from '../../schedule/meet-link.js';
import {
  leadConfig,
  leadTransition,
  LEAD_SOURCES,
  maskPhone,
  normalizePhone,
  publicStage,
  STAGE_STORAGE,
} from './policy.js';
import { recordLead, stageEvent, leadTask, closeLeadTasks } from './events.js';
import type { LeadActor } from './events.js';
import type {
  CreateLeadDto,
  UpdateLeadDto,
  ListLeadsQueryDto,
  LeadDto,
  LeadListItemDto,
  LeadPageDto,
  LeadSummaryDto,
  ScheduleTrialDto,
  TransitionLeadDto,
  LoseLeadDto,
} from '../dto/manager-lead.dto.js';
import { readLeadCursor, writeLeadCursor } from './lead-cursor.js';
import {
  lockLead,
  lockLeadCreation,
  duplicateLeadContact,
  readLeadSummary,
} from '../../crm/lead-data.js';
const include = {
  subject: true,
  student_links: { where: { unlinked_at: null }, orderBy: { linked_at: 'asc' as const } },
  tasks: {
    where: {
      type: { in: ['LEAD_FOLLOWUP', 'ASSIGN_TEACHER'] as ('LEAD_FOLLOWUP' | 'ASSIGN_TEACHER')[] },
      status: { in: ['OPEN', 'IN_PROGRESS'] as ('OPEN' | 'IN_PROGRESS')[] },
    },
    orderBy: [{ due_at: 'asc' as const }, { id: 'asc' as const }],
  },
  trial_lesson: {
    include: {
      scheduled_teacher_ref: { select: { full_name: true } },
      teaching_assignment_ref: { select: { google_meet_link: true } },
      outcome_reports: { orderBy: { version: 'desc' as const }, take: 1 },
    },
  },
  stage_events: { orderBy: [{ created_at: 'asc' as const }, { id: 'asc' as const }] },
} satisfies Prisma.LeadInclude;
type Row = Prisma.LeadGetPayload<{ include: typeof include }>;
export function trialOutcome(row: Row): 'PENDING' | 'ATTENDED' | 'NO_SHOW' | 'CANCELLED' {
  const l = row.trial_lesson,
    report = l?.outcome_reports[0];
  if (report?.result === 'NOT_CONDUCTED') return report.student_no_show ? 'NO_SHOW' : 'CANCELLED';
  if (l?.status === 'CANCELLED') return 'CANCELLED';
  if (report?.result === 'CONDUCTED') return 'ATTENDED';
  return 'PENDING';
}
export interface LeadIntakePort {
  intake(
    managerId: string,
    dto: CreateLeadDto,
    source: CreateLeadDto['source'],
  ): Promise<Result<{ leadId: string }, DomainError>>;
}
@Injectable()
export class ManagerLeadsService implements LeadIntakePort {
  constructor(
    private readonly transactions: TransactionService,
    private readonly scope: ManagerScopeService,
    private readonly students: ManagerStudentsService,
    private readonly schedule: ManagerScheduleService,
    private readonly notifications: NotificationOutboxPublisher,
  ) {}
  private actor(ctx: ManagerContext, c?: Pick<CriticalContext, 'operationId'>): LeadActor {
    return {
      accountId: ctx.accountId,
      requestId: ctx.requestId,
      operationId: c?.operationId ?? randomUUID(),
    };
  }
  private async command<T>(
    fn: () => Promise<Result<T, DomainError>>,
  ): Promise<Result<T, DomainError>> {
    try {
      return await fn();
    } catch (e: unknown) {
      return err(e instanceof AppException ? e.domain : databaseError(e));
    }
  }
  private async authorize(
    ctx: ManagerContext,
    c: CriticalContext,
  ): Promise<Result<void, DomainError>> {
    const result = await this.scope.resolveContext({ ...c.actor, requestId: c.requestId }, c.tx);
    return !result.ok
      ? result
      : result.value.managerId === ctx.managerId && result.value.accountId === ctx.accountId
        ? ok(undefined)
        : err(domainError('FORBIDDEN_ROLE', 403));
  }
  async find(
    ctx: ManagerContext,
    id: string,
    tx: Prisma.TransactionClient,
  ): Promise<Result<Row, DomainError>> {
    const allowed = await this.scope.assertLeadInPortfolio(ctx, id, tx);
    if (!allowed.ok) return allowed;
    try {
      const row = await tx.lead.findFirst({
        where: { AND: [{ id }, this.scope.leadWhere(ctx)] },
        include,
      });
      if (!row) return err(domainError('LEAD_NOT_FOUND', 404));
      if (row.student_links.length > 1) return err(domainError('LEAD_LINK_AMBIGUOUS', 409));
      if (row.student_links[0]) {
        const s = await this.scope.assertStudentInPortfolio(
          ctx,
          row.student_links[0].student_id,
          tx,
        );
        if (!s.ok) return err(domainError('LEAD_NOT_FOUND', 404));
      }
      return ok(row);
    } catch (error: unknown) {
      return err(databaseError(error));
    }
  }
  private item(row: Row, now: Date): LeadListItemDto {
    return {
      leadId: row.id,
      stage: publicStage(row.stage),
      audience: row.audience,
      contactName: row.full_name,
      subjectName: row.subject?.name ?? '',
      grade: row.grade,
      maskedPhone: maskPhone(row.phone),
      source: LEAD_SOURCES.includes(row.source as CreateLeadDto['source'])
        ? (row.source as CreateLeadDto['source'])
        : 'OTHER',
      createdAt: row.created_at.toISOString(),
      stageChangedAt: row.stage_changed_at.toISOString(),
      trialAt: row.trial_lesson?.scheduled_at.toISOString() ?? null,
      nextActionAt: row.tasks[0]?.due_at.toISOString() ?? null,
      isOverdue: row.tasks.some((t) => t.due_at < now),
    };
  }
  private view(row: Row, now: Date): LeadDto {
    const l = row.trial_lesson,
      report = l?.outcome_reports[0],
      config = unwrap(leadConfig());
    return {
      ...this.item(row, now),
      version: row.version,
      guardianName: row.guardian_name,
      phone: row.phone,
      email: row.email,
      ageYears: row.age_years,
      level: row.level,
      comment: row.comment,
      studentId: row.student_links[0]?.student_id ?? null,
      subjectId: row.subject_id,
      lostReason: row.lost_reason,
      lostComment: row.lost_comment,
      trial: l
        ? {
            lessonId: l.id,
            startsAt: l.scheduled_at.toISOString(),
            endsAt: l.scheduled_end_at.toISOString(),
            teacherName: l.scheduled_teacher_ref.full_name,
            meetLink: effectiveMeetLink(
              l.meet_link_overridden,
              l.google_meet_link,
              l.teaching_assignment_ref.google_meet_link,
            ),
            outcome: trialOutcome(row),
            feedbackStatus: report ? 'SUBMITTED' : 'PENDING',
            feedbackSummary: config.feedbackVisible && report ? report.note.slice(0, 500) : null,
          }
        : null,
      history: row.stage_events.map((e) => ({
        from: e.from_stage ? publicStage(e.from_stage) : null,
        to: publicStage(e.to_stage),
        at: e.created_at.toISOString(),
        byManager: e.actor === 'MANAGER',
      })),
      openTasks: row.tasks.flatMap((t) =>
        t.type === 'LEAD_FOLLOWUP' || t.type === 'ASSIGN_TEACHER'
          ? [{ taskId: t.id, type: t.type, dueAt: t.due_at.toISOString() }]
          : [],
      ),
    };
  }
  get(ctx: ManagerContext, id: string): Promise<Result<LeadDto, DomainError>> {
    return this.transactions.runResult(async (tx) => {
      const row = await this.find(ctx, id, tx);
      if (!row.ok) return row;
      await recordLead(tx, this.actor(ctx), id, 'LEAD_PII_VIEWED');
      return ok(this.view(row.value, await at(tx)));
    });
  }
  list(ctx: ManagerContext, q: ListLeadsQueryDto): Promise<Result<LeadPageDto, DomainError>> {
    return this.transactions.runReadOnly(async (tx) => {
      const liveNow = await at(tx),
        cursor = unwrap(readLeadCursor(ctx, q, liveNow)),
        conditions: Prisma.LeadWhereInput[] = [this.scope.leadWhere(ctx, liveNow)];
      if (q.stage?.length)
        conditions.push({
          stage: {
            in: q.stage.flatMap((s) =>
              s === 'TRIAL' ? ['TRIAL_SCHEDULED', 'TRIAL_DONE'] : [STAGE_STORAGE[s]],
            ),
          },
        });
      if (q.subjectId) conditions.push({ subject_id: q.subjectId });
      if (q.source) conditions.push({ source: q.source });
      if (q.search) {
        const s = q.search.trim();
        conditions.push({
          OR: [
            { full_name: { contains: s, mode: 'insensitive' } },
            { phone: { contains: s } },
            { email: { contains: s, mode: 'insensitive' } },
          ],
        });
      }
      if (q.overdue !== undefined) {
        const overdue = {
          tasks: {
            some: {
              type: {
                in: ['LEAD_FOLLOWUP', 'ASSIGN_TEACHER'] as ('LEAD_FOLLOWUP' | 'ASSIGN_TEACHER')[],
              },
              status: { in: ['OPEN', 'IN_PROGRESS'] as ('OPEN' | 'IN_PROGRESS')[] },
              due_at: { lt: cursor.now },
            },
          },
        };
        conditions.push(q.overdue ? overdue : { NOT: overdue });
      }
      if (cursor.id)
        conditions.push({
          OR: [
            { created_at: { lt: cursor.createdAt! } },
            { created_at: cursor.createdAt!, id: { lt: cursor.id } },
          ],
        });
      const rows = await tx.lead.findMany({
        where: { AND: conditions },
        include,
        orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
        take: q.limit + 1,
      });
      const last = rows[q.limit - 1];
      return ok({
        items: rows.slice(0, q.limit).map((r) => this.item(r, cursor.now)),
        nextCursor:
          rows.length > q.limit && last
            ? unwrap(writeLeadCursor(ctx, q, cursor, last.id, last.created_at))
            : null,
      });
    });
  }
  summary(ctx: ManagerContext): Promise<Result<LeadSummaryDto, DomainError>> {
    return this.transactions.runReadOnly(async (tx) => {
      const now = await at(tx),
        zone = process.env.SCHOOL_TIMEZONE ?? 'Europe/Chisinau';
      try {
        new Intl.DateTimeFormat('en', { timeZone: zone });
      } catch {
        return err(domainError('LEAD_CONFIGURATION_INVALID', 503));
      }
      return readLeadSummary(tx, this.scope.leadSql(ctx, now), now, zone);
    });
  }
  private async duplicate(
    ctx: ManagerContext,
    dto: { phone?: string | null; email?: string | null },
    tx: Prisma.TransactionClient,
    exclude?: string,
    excludeStudent?: string,
  ): Promise<Result<void, DomainError>> {
    const phone = dto.phone ? normalizePhone(dto.phone) : null,
      email = dto.email?.trim().toLowerCase() ?? null,
      now = await at(tx);
    const result = await duplicateLeadContact(tx, {
      managerId: ctx.managerId,
      now,
      studentScope: this.scope.portfolioSql(ctx, now),
      phone,
      email,
      excludeLead: exclude ?? null,
      excludeStudent: excludeStudent ?? null,
    });
    return !result.ok
      ? result
      : result.value
        ? err({
            ...domainError('LEAD_DUPLICATE_SUSPECTED', 409),
            details: { existingId: result.value },
          })
        : ok(undefined);
  }
  private async writeCreate(
    ctx: ManagerContext,
    dto: CreateLeadDto,
    c: Pick<CriticalContext, 'tx' | 'operationId' | 'requestId'>,
    system = false,
  ): Promise<Result<LeadDto, DomainError>> {
    if (Object.values(dto).some((v) => v === null) || dto.contactName.trim().length < 2)
      return err(domainError('INVALID_INPUT', 422));
    const now = await at(c.tx),
      config = unwrap(leadConfig());
    if (!dto.phone && !dto.email) return err(domainError('CONTACT_REQUIRED', 422));
    if (dto.audience === 'CHILD' && (!dto.guardianName || dto.guardianName.trim().length < 2))
      return err(domainError('GUARDIAN_REQUIRED', 422));
    if (
      !(await c.tx.subject.findFirst({
        where: { id: dto.subjectId, archived_at: null },
        select: { id: true },
      }))
    )
      return err(domainError('SUBJECT_NOT_FOUND', 404));
    const locked = await lockLeadCreation(c.tx, ctx.managerId);
    if (!locked.ok) return locked;
    const count = await c.tx.lead.count({
      where: {
        AND: [this.scope.leadWhere(ctx, now), { created_at: { gt: new Date(+now - 60000) } }],
      },
    });
    if (count >= config.perMinute) return err(domainError('LEAD_RATE_LIMITED', 429));
    if (!dto.forceCreate) {
      const d = await this.duplicate(ctx, dto, c.tx);
      if (!d.ok) return d;
    }
    const row = await c.tx.lead.create({
      data: {
        full_name: dto.contactName.trim(),
        audience: dto.audience,
        guardian_name: dto.guardianName?.trim() ?? null,
        phone: dto.phone?.trim() ?? null,
        email: dto.email?.trim().toLowerCase() ?? null,
        subject_id: dto.subjectId,
        grade: dto.grade ?? null,
        age_years: dto.ageYears ?? null,
        level: dto.level ?? null,
        source: dto.source,
        comment: dto.comment ?? null,
        stage_changed_at: now,
      },
    });
    await c.tx.assignedManager.create({ data: { lead_id: row.id, manager_id: ctx.managerId } });
    await stageEvent(c.tx, row.id, null, 'NEW', !system, now);
    const due = new Date(+now + config.followupMinutes * 60000);
    for (const type of ['LEAD_FOLLOWUP', 'ASSIGN_TEACHER'] as const)
      await leadTask(c.tx, row.id, ctx.managerId, type, due, `lead:${row.id}:${type}:1`);
    await recordLead(
      c.tx,
      system ? { requestId: ctx.requestId, operationId: c.operationId } : this.actor(ctx, c),
      row.id,
      'LEAD_CREATED',
      { forceCreate: dto.forceCreate === true },
    );
    return ok(this.view(unwrap(await this.find(ctx, row.id, c.tx)), now));
  }
  async create(
    ctx: ManagerContext,
    dto: CreateLeadDto,
    _key: string,
    c: CriticalContext,
  ): Promise<Result<LeadDto, DomainError>> {
    return this.command(async () => {
      const actor = await this.authorize(ctx, c);
      return actor.ok ? this.writeCreate(ctx, dto, c) : actor;
    });
  }
  async intake(
    managerId: string,
    dto: CreateLeadDto,
    source: CreateLeadDto['source'],
  ): Promise<Result<{ leadId: string }, DomainError>> {
    const input = plainToInstance(IntakeDto, { ...dto, source });
    if (
      validateSync(input, {
        whitelist: true,
        forbidNonWhitelisted: true,
        forbidUnknownValues: true,
      }).length
    )
      return err(domainError('INVALID_INPUT', 422));
    return this.transactions.runResult(async (tx) => {
      const now = await at(tx),
        manager = await tx.staffAccount.findFirst({
          where: {
            id: managerId,
            deactivated_at: null,
            account: {
              disabled_at: null,
              role_assignments: {
                some: {
                  role: { code: 'MANAGER' },
                  valid_from: { lte: now },
                  OR: [{ valid_to: null }, { valid_to: { gt: now } }],
                },
              },
            },
          },
          select: { account_id: true },
        });
      if (!manager) return err(domainError('MANAGER_PROFILE_NOT_FOUND', 403));
      const ctx = {
          managerId,
          accountId: manager.account_id,
          sessionId: randomUUID(),
          requestId: randomUUID(),
        },
        operationId = randomUUID();
      // No public route exposes intake; the system identity is recorded explicitly.
      const result = await this.writeCreate(
        ctx,
        input,
        { tx, operationId, requestId: ctx.requestId },
        true,
      );
      return result.ok ? ok({ leadId: result.value.leadId }) : result;
    });
  }
  private async lock(
    ctx: ManagerContext,
    id: string,
    version: number,
    c: CriticalContext,
  ): Promise<Result<Row, DomainError>> {
    const actor = await this.authorize(ctx, c);
    if (!actor.ok) return actor;
    const allowed = await this.scope.assertLeadInPortfolio(ctx, id, c.tx);
    if (!allowed.ok) return allowed;
    const locked = await lockLead(c.tx, id);
    if (!locked.ok) return locked;
    const row = await this.find(ctx, id, c.tx);
    if (!row.ok) return row;
    if (row.value.version !== version) return err(domainError('LEAD_VERSION_CONFLICT', 409));
    return row;
  }
  async update(
    ctx: ManagerContext,
    id: string,
    dto: UpdateLeadDto,
    c: CriticalContext,
  ): Promise<Result<LeadDto, DomainError>> {
    try {
      if (
        Object.values(dto).some((v) => v === null) ||
        (dto.contactName !== undefined && dto.contactName.trim().length < 2)
      )
        return err(domainError('INVALID_INPUT', 422));
      const row = unwrap(await this.lock(ctx, id, dto.version, c));
      if (['CONVERTED', 'CLOSED'].includes(row.stage))
        return err(domainError('LEAD_TERMINAL', 409));
      const merged = {
        audience: dto.audience ?? row.audience,
        guardianName: dto.guardianName ?? row.guardian_name,
        phone: dto.phone ?? row.phone,
        email: dto.email ?? row.email,
      };
      if (!merged.phone && !merged.email) return err(domainError('CONTACT_REQUIRED', 422));
      if (
        merged.audience === 'CHILD' &&
        (!merged.guardianName || merged.guardianName.trim().length < 2)
      )
        return err(domainError('GUARDIAN_REQUIRED', 422));
      if (
        dto.subjectId &&
        row.student_links.length &&
        row.subject_id &&
        dto.subjectId !== row.subject_id
      )
        return err(domainError('LEAD_SUBJECT_IMMUTABLE', 409));
      if (
        dto.subjectId &&
        !(await c.tx.subject.findFirst({
          where: { id: dto.subjectId, archived_at: null },
          select: { id: true },
        }))
      )
        return err(domainError('SUBJECT_NOT_FOUND', 404));
      if (dto.phone !== undefined || dto.email !== undefined) {
        const d = await this.duplicate(
          ctx,
          { phone: dto.phone ?? null, email: dto.email ?? null },
          c.tx,
          id,
          row.student_links[0]?.student_id,
        );
        if (!d.ok) return d;
      }
      const data: Prisma.LeadUncheckedUpdateInput = { version: { increment: 1 } };
      if (dto.contactName !== undefined) data.full_name = dto.contactName.trim();
      if (dto.guardianName !== undefined) data.guardian_name = dto.guardianName.trim();
      if (dto.audience !== undefined) data.audience = dto.audience;
      if (dto.phone !== undefined) data.phone = dto.phone.trim();
      if (dto.email !== undefined) data.email = dto.email.trim().toLowerCase();
      if (dto.subjectId !== undefined) data.subject_id = dto.subjectId;
      if (dto.grade !== undefined) data.grade = dto.grade;
      if (dto.ageYears !== undefined) data.age_years = dto.ageYears;
      if (dto.level !== undefined) data.level = dto.level;
      if (dto.source !== undefined) data.source = dto.source;
      if (dto.comment !== undefined) data.comment = dto.comment;
      await c.tx.lead.update({ where: { id }, data });
      await recordLead(c.tx, this.actor(ctx, c), id, 'LEAD_UPDATED', {
        changedFields: Object.keys(dto).filter((k) => k !== 'version'),
      });
      return ok(this.view(unwrap(await this.find(ctx, id, c.tx)), await at(c.tx)));
    } catch (e: unknown) {
      return err(
        e instanceof Error && 'domain' in e
          ? (e as { domain: DomainError }).domain
          : databaseError(e),
      );
    }
  }
  claim(
    ctx: ManagerContext,
    id: string,
    version: number,
    c: CriticalContext,
  ): Promise<Result<LeadDto, DomainError>> {
    return this.move(ctx, id, version, 'claim', c);
  }
  transition(
    ctx: ManagerContext,
    id: string,
    dto: TransitionLeadDto,
    c: CriticalContext,
  ): Promise<Result<LeadDto, DomainError>> {
    return this.move(ctx, id, dto.version, 'transition', c, dto);
  }
  lose(
    ctx: ManagerContext,
    id: string,
    dto: LoseLeadDto,
    c: CriticalContext,
  ): Promise<Result<LeadDto, DomainError>> {
    return this.move(ctx, id, dto.version, 'lose', c, dto);
  }
  reopen(
    ctx: ManagerContext,
    id: string,
    version: number,
    c: CriticalContext,
  ): Promise<Result<LeadDto, DomainError>> {
    return this.move(ctx, id, version, 'reopen', c);
  }
  private move(
    ctx: ManagerContext,
    id: string,
    version: number,
    action: 'claim' | 'transition' | 'lose' | 'reopen',
    c: CriticalContext,
    input?: TransitionLeadDto | LoseLeadDto,
  ): Promise<Result<LeadDto, DomainError>> {
    return this.command(() => this.moveInner(ctx, id, version, action, c, input));
  }
  private async moveInner(
    ctx: ManagerContext,
    id: string,
    version: number,
    action: 'claim' | 'transition' | 'lose' | 'reopen',
    c: CriticalContext,
    input?: TransitionLeadDto | LoseLeadDto,
  ): Promise<Result<LeadDto, DomainError>> {
    const row = unwrap(await this.lock(ctx, id, version, c)),
      from = publicStage(row.stage),
      now = await at(c.tx);
    if (from === 'CONVERTED') return err(domainError('LEAD_TERMINAL', 409));
    const to =
      action === 'lose'
        ? 'LOST'
        : action === 'reopen' || action === 'claim'
          ? 'IN_PROGRESS'
          : (input as TransitionLeadDto).to;
    if (action === 'reopen' && from !== 'LOST')
      return err(domainError('INVALID_STAGE_TRANSITION', 409));
    if (action !== 'reopen' && from === 'LOST') return err(domainError('LEAD_TERMINAL', 409));
    if (action === 'claim' && from !== 'NEW')
      return err(domainError('INVALID_STAGE_TRANSITION', 409));
    const check = leadTransition(
      from,
      to,
      trialOutcome(row),
      (input as TransitionLeadDto | undefined)?.skipTrialReason,
    );
    if (!check.ok) return check;
    if (to === 'AWAITING_PAYMENT' && from === 'IN_PROGRESS' && !row.student_links.length) {
      const created = await this.students.create(
        ctx,
        {
          fullName: row.full_name,
          ...(row.phone ? { phone: row.phone } : {}),
          ...(row.email ? { email: row.email } : {}),
          ...(row.guardian_name ? { guardianName: row.guardian_name } : {}),
        },
        c.operationId,
        c,
      );
      if (!created.ok) return created;
      await c.tx.leadStudentLink.create({
        data: {
          lead_id: id,
          student_id: created.value.studentId,
          checked_by_staff_id: ctx.managerId,
          basis: 'MGR11_SKIP_TRIAL_WITH_REASON',
        },
      });
    }
    if (
      to === 'LOST' &&
      row.trial_lesson &&
      row.trial_lesson.status !== 'CANCELLED' &&
      row.trial_lesson.scheduled_at > now
    ) {
      const cancelled = await this.schedule.cancel(
        ctx,
        row.trial_lesson.id,
        { reason: 'Заявка потеряна', chargeable: false, initiator: 'ACADEMY' },
        c,
      );
      if (!cancelled.ok) return cancelled;
    }
    await c.tx.lead.update({
      where: { id },
      data: {
        stage: STAGE_STORAGE[to],
        stage_changed_at: now,
        version: { increment: 1 },
        ...(to === 'LOST'
          ? {
              lost_reason: (input as LoseLeadDto).reason,
              lost_comment: (input as LoseLeadDto).comment ?? null,
            }
          : action === 'reopen'
            ? { lost_reason: null, lost_comment: null }
            : {}),
      },
    });
    await stageEvent(
      c.tx,
      id,
      row.stage,
      STAGE_STORAGE[to],
      true,
      now,
      (input as TransitionLeadDto | undefined)?.skipTrialReason ??
        (input as LoseLeadDto | undefined)?.reason,
    );
    if (action === 'claim') await closeLeadTasks(c.tx, id, ['LEAD_FOLLOWUP'], now, ctx.managerId);
    if (to === 'LOST' || to === 'AWAITING_PAYMENT')
      await closeLeadTasks(c.tx, id, ['LEAD_FOLLOWUP', 'ASSIGN_TEACHER'], now, ctx.managerId);
    const student = row.student_links[0]?.student_id;
    if (to === 'LOST' && student) {
      const receipt = await c.tx.paymentReceipt.findFirst({
          where: { student_id: student },
          select: { id: true },
        }),
        allocation = await c.tx.paymentDistribution.findFirst({
          where: { subscription_ref: { enrollment_ref: { student_id: student } } },
          select: { id: true },
        });
      const account = await c.tx.studentAccount.findFirst({
        where: { student_id: student },
        select: { id: true },
      });
      if (!receipt && !allocation && !account) {
        const archived = await c.tx.student.updateMany({
          where: { AND: [{ id: student, archived_at: null }, this.scope.portfolioWhere(ctx)] },
          data: { archived_at: now, version: { increment: 1 } },
        });
        if (archived.count)
          await c.tx.lead.update({ where: { id }, data: { archived_student_at: now } });
      }
    }
    if (action === 'reopen') {
      if (student && row.archived_student_at)
        await c.tx.student.updateMany({
          where: {
            AND: [
              { id: student, archived_at: row.archived_student_at },
              this.scope.portfolioWhere(ctx),
            ],
          },
          data: { archived_at: null, version: { increment: 1 } },
        });
      await c.tx.lead.update({ where: { id }, data: { archived_student_at: null } });
      await leadTask(
        c.tx,
        id,
        ctx.managerId,
        'LEAD_FOLLOWUP',
        new Date(+now + unwrap(leadConfig()).followupMinutes * 60000),
        `lead-reopen:${id}:${row.version}`,
        student,
      );
      if (!row.trial_lesson)
        await leadTask(
          c.tx,
          id,
          ctx.managerId,
          'ASSIGN_TEACHER',
          new Date(+now + unwrap(leadConfig()).followupMinutes * 60000),
          `lead-reopen-teacher:${id}:${row.version}`,
          student,
        );
    }
    await recordLead(
      c.tx,
      this.actor(ctx, c),
      id,
      action === 'lose'
        ? 'LEAD_LOST'
        : action === 'reopen'
          ? 'LEAD_REOPENED'
          : 'LEAD_STAGE_CHANGED',
      { from, to },
    );
    return ok(this.view(unwrap(await this.find(ctx, id, c.tx)), now));
  }
  scheduleTrial(
    ctx: ManagerContext,
    id: string,
    input: ScheduleTrialDto,
    _key: string,
    c: CriticalContext,
  ): Promise<Result<LeadDto, DomainError>> {
    return this.command(() => this.scheduleTrialInner(ctx, id, input, _key, c));
  }
  private async scheduleTrialInner(
    ctx: ManagerContext,
    id: string,
    input: ScheduleTrialDto,
    _key: string,
    c: CriticalContext,
  ): Promise<Result<LeadDto, DomainError>> {
    const row = unwrap(await this.lock(ctx, id, input.version, c)),
      config = unwrap(leadConfig()),
      now = await at(c.tx),
      from = publicStage(row.stage);
    if (from === 'CONVERTED' || from === 'LOST') return err(domainError('LEAD_TERMINAL', 409));
    if (row.trial_lesson && trialOutcome(row) === 'PENDING')
      return err(domainError('TRIAL_ALREADY_SCHEDULED', 409));
    const transition = leadTransition(from, 'TRIAL');
    if (!transition.ok) return transition;
    if (!row.subject_id) return err(domainError('SUBJECT_NOT_FOUND', 404));
    let studentId = row.student_links[0]?.student_id;
    if (!studentId) {
      const created = await this.students.create(
        ctx,
        {
          fullName: row.full_name,
          ...(row.phone ? { phone: row.phone } : {}),
          ...(row.email ? { email: row.email } : {}),
          ...(row.guardian_name ? { guardianName: row.guardian_name } : {}),
        },
        _key,
        c,
      );
      if (!created.ok) return created;
      studentId = created.value.studentId;
      await c.tx.leadStudentLink.create({
        data: {
          lead_id: id,
          student_id: studentId,
          checked_by_staff_id: ctx.managerId,
          basis: 'MGR11_TRIAL_STUDENT',
        },
      });
    }
    const trial = await this.schedule.create(
      ctx,
      studentId,
      {
        teacherId: input.teacherId,
        startsAt: input.startsAt,
        durationMinutes: config.minutes,
        kind: 'TRIAL',
        subjectId: row.subject_id,
      },
      c,
      id,
    );
    if (!trial.ok) return trial;
    await c.tx.lead.update({
      where: { id },
      data: {
        stage: 'TRIAL_SCHEDULED',
        trial_lesson_id: trial.value.lessonId,
        stage_changed_at: now,
        version: { increment: 1 },
      },
    });
    await stageEvent(c.tx, id, row.stage, 'TRIAL_SCHEDULED', true, now);
    await closeLeadTasks(c.tx, id, ['LEAD_FOLLOWUP', 'ASSIGN_TEACHER'], now, ctx.managerId);
    await recordLead(c.tx, this.actor(ctx, c), id, 'TRIAL_SCHEDULED', {
      lessonId: trial.value.lessonId,
    });
    const notification = await this.notifications.enqueueContact(c.tx, {
      leadId: id,
      lessonId: trial.value.lessonId,
      operationId: c.operationId,
      requestId: c.requestId,
      actorId: ctx.accountId,
    });
    if (!notification.ok) return notification;
    return ok(this.view(unwrap(await this.find(ctx, id, c.tx)), now));
  }
}
