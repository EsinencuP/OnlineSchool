import { Injectable } from '@nestjs/common';
import { err, ok } from '@online-school/shared';
import type { Result } from '@online-school/shared';
import { TransactionService } from '../../../core/transaction/transaction.service.js';
import { databaseError } from '../../../core/errors/database-error.js';
import type { DomainError } from '../../../core/errors/domain-error.js';
import type { ManagerContext } from '../context/manager-context.js';
import { ManagerScopeService } from '../scope/manager-scope.service.js';
import type { ManagerOptionsDto } from './manager-options.dto.js';

@Injectable()
export class ManagerOptionsService {
  constructor(
    private readonly transactions: TransactionService,
    private readonly scope: ManagerScopeService,
  ) {}
  async get(
    ctx: ManagerContext,
    studentId?: string,
  ): Promise<Result<ManagerOptionsDto, DomainError>> {
    try {
      return await this.transactions.runReadOnly(async (tx) => {
        if (studentId) {
          const access = await this.scope.assertStudentInPortfolio(ctx, studentId, tx);
          if (!access.ok) return access;
        }
        const now = new Date();
        const teachers = await tx.teacherAccount.findMany({
          where: { deactivated_at: null, account: { disabled_at: null } },
          orderBy: [{ full_name: 'asc' }, { id: 'asc' }],
          select: { id: true, full_name: true },
        });
        const students = await tx.student.findMany({
          where: {
            AND: [this.scope.portfolioWhere(ctx, now), ...(studentId ? [{ id: studentId }] : [])],
          },
          orderBy: [{ full_name: 'asc' }, { id: 'asc' }],
          select: { id: true, full_name: true },
        });
        const current = {
          valid_from: { lte: now },
          OR: [{ valid_to: null }, { valid_to: { gt: now } }],
        };
        const subjects = await tx.subject.findMany({
          where: { archived_at: null },
          orderBy: [{ name: 'asc' }, { id: 'asc' }],
          select: { id: true, name: true },
        });
        const plans = await tx.saleCondition.findMany({
          where: current,
          orderBy: [{ code: 'asc' }, { version: 'desc' }],
          select: {
            id: true,
            code: true,
            version: true,
            price: true,
            currency: true,
            lesson_count: true,
          },
        });
        const enrollments = studentId
          ? await tx.studentSubjectEnrollment.findMany({
              where: {
                ...current,
                student_id: studentId,
                status: 'ACTIVE',
                student_ref: this.scope.portfolioWhere(ctx, now),
              },
              orderBy: { id: 'asc' },
              select: {
                id: true,
                subject_id: true,
                subject_ref: { select: { name: true } },
                t03_teachingassignment_enrollment_id: {
                  where: { ...current, teacher_ref: { deactivated_at: null } },
                  select: { teacher_ref: { select: { id: true, full_name: true } } },
                },
              },
            })
          : [];
        const subscriptions = studentId
          ? await tx.subscription.findMany({
              where: {
                enrollment_ref: {
                  student_id: studentId,
                  student_ref: this.scope.portfolioWhere(ctx, now),
                },
              },
              orderBy: [{ valid_from: 'desc' }, { id: 'asc' }],
              select: {
                id: true,
                enrollment_id: true,
                currency: true,
                valid_from: true,
                enrollment_ref: { select: { subject_ref: { select: { name: true } } } },
                sale_condition_ref: { select: { code: true, version: true } },
              },
            })
          : [];
        return ok({
          teachers: teachers.map((t) => ({ id: t.id, label: t.full_name })),
          students: students.map((s) => ({ id: s.id, label: s.full_name })),
          subjects: subjects.map((s) => ({ id: s.id, label: s.name })),
          plans: plans.map((p) => ({
            id: p.id,
            label: `${p.code} · v${p.version}`,
            price: p.price.toFixed(4),
            currency: p.currency,
            lessonCount: p.lesson_count,
          })),
          enrollments: enrollments.map((e) => ({
            id: e.id,
            subjectId: e.subject_id,
            label: e.subject_ref.name,
            teachers: e.t03_teachingassignment_enrollment_id.map((a) => ({
              id: a.teacher_ref.id,
              label: a.teacher_ref.full_name,
            })),
          })),
          financialSubscriptions: subscriptions.map((s) => ({
            id: s.id,
            enrollmentId: s.enrollment_id,
            currency: s.currency,
            startsAt: s.valid_from.toISOString(),
            label: `${s.enrollment_ref.subject_ref.name} · ${s.sale_condition_ref.code} v${s.sale_condition_ref.version}`,
          })),
        });
      });
    } catch (error: unknown) {
      return err(databaseError(error));
    }
  }
}
