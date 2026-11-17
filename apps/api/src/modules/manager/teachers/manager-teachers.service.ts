import { Injectable } from '@nestjs/common';
import type { Prisma } from '@online-school/db';
import { err, ok } from '@online-school/shared';
import type { Result } from '@online-school/shared';
import { domainError } from '../../../core/errors/domain-error.js';
import type { DomainError } from '../../../core/errors/domain-error.js';
import type { CriticalContext } from '../../../core/http.js';
import { UUID } from '../../../core/http.js';
import { TransactionService } from '../../../core/transaction/transaction.service.js';
import { at } from '../../finance/finance-common.js';
import { ScheduleRegistry } from '../../schedule/registry.service.js';
import { interval, schedulePolicy, scheduleFailure } from '../../schedule/manager/policy.js';
import type { ManagerContext } from '../context/manager-context.js';
import { leadConfig } from '../leads/policy.js';
import { ManagerScopeService } from '../scope/manager-scope.service.js';
import { clip, subtract, toIso } from './intervals.js';
import { loadTeacherData, teacherItem } from './teacher-load.js';
import type { TeacherRow } from './teacher-load.js';
import type {
  AssignTeacherCommandDto,
  TeacherAssignmentDto,
  TeacherCandidatesDto,
  TeacherDirectoryDto,
  TeacherDirectoryQueryDto,
  TeacherWindowsDto,
} from './manager-teachers.dto.js';

const DAY = 86400000;
const SLOT_LIMIT = 10;
const rank = (flag: boolean): number => (flag ? 1 : 0);

@Injectable()
export class ManagerTeachersService {
  constructor(
    private readonly transactions: TransactionService,
    private readonly scope: ManagerScopeService,
    private readonly registry: ScheduleRegistry,
  ) {}

  private activeTeachers(tx: Prisma.TransactionClient, search?: string): Promise<TeacherRow[]> {
    return tx.teacherAccount.findMany({
      where: {
        deactivated_at: null,
        account: { disabled_at: null },
        ...(search ? { full_name: { contains: search, mode: 'insensitive' as const } } : {}),
      },
      orderBy: [{ full_name: 'asc' }, { id: 'asc' }],
      take: 200,
      select: { id: true, full_name: true },
    });
  }

  directory(
    _ctx: ManagerContext,
    q: TeacherDirectoryQueryDto,
  ): Promise<Result<TeacherDirectoryDto, DomainError>> {
    return this.transactions.runReadOnly(async (tx) => {
      const now = new Date(),
        to = new Date(+now + 7 * DAY);
      const teachers = await this.activeTeachers(tx, q.search?.trim() || undefined);
      const data = await loadTeacherData(tx, teachers, now, to, now);
      const items = teachers
        .map((t) => teacherItem(t, data, now, to, q.subjectId).item)
        .sort(
          (a, b) =>
            rank(b.teachesSubject) - rank(a.teachesSubject) || a.fullName.localeCompare(b.fullName),
        );
      return ok({ items });
    });
  }

  windows(
    _ctx: ManagerContext,
    teacherId: string,
    fromRaw: string,
    toRaw: string,
  ): Promise<Result<TeacherWindowsDto, DomainError>> {
    return this.transactions.runReadOnly(async (tx) => {
      if (!UUID.test(teacherId)) return err(domainError('TEACHER_NOT_FOUND', 404));
      const dates = interval(fromRaw, toRaw);
      if (!dates.ok) return dates;
      const { from, to } = dates.value;
      const teacher = (
        await tx.teacherAccount.findMany({
          where: { id: teacherId, deactivated_at: null, account: { disabled_at: null } },
          select: { id: true, full_name: true },
        })
      )[0];
      if (!teacher) return err(domainError('TEACHER_NOT_FOUND', 404));
      const data = await loadTeacherData(tx, [teacher], from, to, new Date());
      const busyAll = data.busyOf(teacher.id);
      return ok({
        teacherId: teacher.id,
        fullName: teacher.full_name,
        windows: data.windows.flatMap((w) => {
          const span = clip({ start: w.starts_at, end: w.ends_at }, from, to);
          if (!span) return [];
          const busy = busyAll.flatMap((b) => {
            const c = clip(b, span.start, span.end);
            return c ? [c] : [];
          });
          return [
            {
              availabilityId: w.id,
              ...toIso(span),
              timezone: w.timezone,
              busy: busy.map(toIso),
              free: subtract(span, busy).map(toIso),
            },
          ];
        }),
      });
    });
  }

  candidates(
    ctx: ManagerContext,
    leadId: string,
    days: number,
  ): Promise<Result<TeacherCandidatesDto, DomainError>> {
    return this.transactions.runReadOnly(async (tx) => {
      const allowed = await this.scope.assertLeadInPortfolio(ctx, leadId, tx);
      if (!allowed.ok) return allowed;
      const config = leadConfig();
      if (!config.ok) return config;
      const policy = schedulePolicy();
      if (!policy.ok) return policy;
      const lead = await tx.lead.findUniqueOrThrow({
        where: { id: leadId },
        select: { subject_id: true },
      });
      const now = new Date(),
        earliest = new Date(+now + policy.value.leadMinutes * 60000),
        to = new Date(+now + days * DAY),
        need = config.value.minutes * 60000;
      const teachers = await this.activeTeachers(tx);
      const data = await loadTeacherData(tx, teachers, now, to, now);
      const subjectId = lead.subject_id ?? undefined;
      const rows = teachers.flatMap((t) => {
        const { item: row, free } = teacherItem(t, data, now, to, subjectId);
        const slots = free.flatMap((s) => {
          const c = clip(s, earliest, to);
          return c && +c.end - +c.start >= need ? [c] : [];
        });
        return slots.length
          ? [
              {
                row: { ...row, trialSlots: slots.slice(0, SLOT_LIMIT).map(toIso) },
                first: +slots[0]!.start,
              },
            ]
          : [];
      });
      rows.sort(
        (a, b) =>
          rank(b.row.teachesSubject) - rank(a.row.teachesSubject) ||
          a.first - b.first ||
          a.row.fullName.localeCompare(b.row.fullName),
      );
      return ok({
        leadId,
        subjectId: lead.subject_id,
        trialMinutes: config.value.minutes,
        candidates: rows.map((r) => r.row),
      });
    });
  }

  private async authorize(
    ctx: ManagerContext,
    c: CriticalContext,
  ): Promise<Result<void, DomainError>> {
    const current = await this.scope.resolveContext({ ...c.actor, requestId: c.requestId }, c.tx);
    if (!current.ok) return current;
    return current.value.managerId === ctx.managerId && current.value.accountId === ctx.accountId
      ? ok(undefined)
      : err(domainError('FORBIDDEN_ROLE', 403));
  }

  private view(
    a: {
      id: string;
      teacher_id: string;
      enrollment_id: string;
      valid_from: Date;
      valid_to: Date | null;
      basis: string;
    },
    studentId: string,
    subjectId: string,
  ): TeacherAssignmentDto {
    return {
      assignmentId: a.id,
      studentId,
      enrollmentId: a.enrollment_id,
      subjectId,
      teacherId: a.teacher_id,
      validFrom: a.valid_from.toISOString(),
      validTo: a.valid_to?.toISOString() ?? null,
      basis: a.basis,
    };
  }

  async assign(
    ctx: ManagerContext,
    studentId: string,
    input: AssignTeacherCommandDto,
    c: CriticalContext,
  ): Promise<Result<TeacherAssignmentDto, DomainError>> {
    const actor = await this.authorize(ctx, c);
    if (!actor.ok) return actor;
    const allowed = await this.scope.assertStudentInPortfolio(ctx, studentId, c.tx);
    if (!allowed.ok) return allowed;
    try {
      let enrollment = await c.tx.studentSubjectEnrollment.findFirst({
        where: {
          student_id: studentId,
          subject_id: input.subjectId,
          valid_to: null,
          status: 'ACTIVE',
        },
      });
      const now = await at(c.tx);
      if (enrollment) {
        const current = await c.tx.teachingAssignment.findFirst({
          where: {
            enrollment_id: enrollment.id,
            teacher_id: input.teacherId,
            OR: [{ valid_to: null }, { valid_to: { gt: now } }],
          },
          select: { id: true },
        });
        if (current) return err(domainError('TEACHER_ALREADY_ASSIGNED', 409));
      }
      enrollment ??= await this.registry.enrollment(c, {
        studentId,
        subjectId: input.subjectId,
      });
      const created = await this.registry.assignment(c, {
        enrollmentId: enrollment.id,
        teacherId: input.teacherId,
        validFrom: now.toISOString(),
        basis: input.basis,
      });
      return ok(this.view(created, studentId, enrollment.subject_id));
    } catch (error: unknown) {
      return err(scheduleFailure(error));
    }
  }

  async revoke(
    ctx: ManagerContext,
    assignmentId: string,
    reason: string,
    c: CriticalContext,
  ): Promise<Result<TeacherAssignmentDto, DomainError>> {
    const actor = await this.authorize(ctx, c);
    if (!actor.ok) return actor;
    if (!UUID.test(assignmentId)) return err(domainError('ASSIGNMENT_NOT_FOUND', 404));
    try {
      const found = await c.tx.teachingAssignment.findUnique({
        where: { id: assignmentId },
        select: { enrollment_ref: { select: { student_id: true, subject_id: true } } },
      });
      if (!found) return err(domainError('ASSIGNMENT_NOT_FOUND', 404));
      const studentId = found.enrollment_ref.student_id;
      const allowed = await this.scope.assertStudentInPortfolio(ctx, studentId, c.tx);
      if (!allowed.ok) return err(domainError('ASSIGNMENT_NOT_FOUND', 404));
      const updated = await this.registry.revoke(c, assignmentId, { reason });
      return ok(this.view(updated, studentId, found.enrollment_ref.subject_id));
    } catch (error: unknown) {
      return err(scheduleFailure(error));
    }
  }
}
