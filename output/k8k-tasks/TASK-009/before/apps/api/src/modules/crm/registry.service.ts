import { Injectable } from '@nestjs/common';
import type { CriticalContext } from '../../core/http.js';
import { domainError, fail, unwrap } from '../../core/errors/domain-error.js';
import { PolicyService } from '../../core/policy/policy.service.js';
import { email, object, string, uuid } from '../identity/input.js';
import { now } from '../identity/identity.service.js';

@Injectable()
export class RegistryService {
  constructor(private readonly policy: PolicyService) {}
  private async staff(context: CriticalContext): Promise<string> {
    const staff = await context.tx.staffAccount.findFirst({
      where: { account_id: context.actor.accountId, deactivated_at: null },
      select: { id: true },
    });
    return staff?.id ?? fail(domainError('FORBIDDEN', 403));
  }
  async createStudent(context: CriticalContext, body: unknown): Promise<unknown> {
    const input = object(body, ['fullName', 'email', 'phone', 'birthDate']);
    const fullName = string(input.fullName, 1, 200);
    const phone = input.phone === undefined ? undefined : string(input.phone, 5, 40);
    if (phone && !/^\+?[0-9 ()-]+$/.test(phone)) return fail(domainError('INVALID_INPUT', 400));
    const birth = input.birthDate === undefined ? undefined : string(input.birthDate, 10, 10);
    if (
      birth &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(birth) ||
        Number.isNaN(+new Date(birth)) ||
        new Date(birth).toISOString().slice(0, 10) !== birth ||
        new Date(birth) > new Date())
    )
      return fail(domainError('INVALID_INPUT', 400));
    const staffId = await this.staff(context);
    const student = await context.tx.student.create({
      data: {
        full_name: fullName,
        ...(phone ? { phone } : {}),
        ...(input.email !== undefined ? { email: email(input.email) } : {}),
        ...(birth ? { birth_date: new Date(birth) } : {}),
      },
    });
    if (context.actor.roles.includes('MANAGER') && !context.actor.roles.includes('DIRECTOR'))
      await context.tx.assignedManager.create({
        data: { student_id: student.id, manager_id: staffId, assigned_at: await now(context.tx) },
      });
    // A registry identity creates neither a login nor paid entitlements.
    return { id: student.id, fullName: student.full_name };
  }
  async createHousehold(context: CriticalContext, body: unknown): Promise<unknown> {
    const input = object(body ?? {}, ['label']);
    const household = await context.tx.household.create({
      data: {
        created_by_staff_id: await this.staff(context),
        ...(input.label !== undefined ? { label: string(input.label, 1, 150) } : {}),
      },
    });
    return { id: household.id };
  }
  async addMember(context: CriticalContext, householdId: string, body: unknown): Promise<unknown> {
    const id = uuid(householdId);
    const input = object(body, ['studentId', 'representativeId', 'basis']);
    if ((input.studentId !== undefined) === (input.representativeId !== undefined))
      return fail(domainError('INVALID_INPUT', 400));
    const studentId = input.studentId === undefined ? undefined : uuid(input.studentId);
    const representativeId =
      input.representativeId === undefined ? undefined : uuid(input.representativeId);
    const basis = string(input.basis, 5, 500);
    const staffId = await this.staff(context);
    await context.tx.$queryRaw`SELECT id FROM households WHERE id=${id}::uuid FOR UPDATE`;
    const household = await context.tx.household.findUnique({ where: { id } });
    if (!household || household.archived_at) return fail(domainError('FORBIDDEN', 403));
    if (!context.actor.roles.includes('DIRECTOR')) {
      if (household.created_by_staff_id !== staffId) return fail(domainError('FORBIDDEN', 403));
      const members = await context.tx.householdMembership.findMany({
        where: { household_id: id, status: 'ACTIVE', student_id: { not: null } },
        select: { student_id: true },
      });
      for (const member of members)
        unwrap(await this.policy.canAccessStudent(context.actor, member.student_id!, context.tx));
      if (studentId)
        unwrap(await this.policy.canAccessStudent(context.actor, studentId, context.tx));
      if (representativeId) {
        const at = await now(context.tx);
        const verified = await context.tx.studentRepresentativeLink.findFirst({
          where: {
            representative_id: representativeId,
            student_id: { in: members.map((m) => m.student_id!) },
            verification_status: 'VERIFIED',
            valid_from: { lte: at },
            OR: [{ valid_to: null }, { valid_to: { gt: at } }],
          },
        });
        if (!verified) return fail(domainError('FORBIDDEN', 403));
      }
    }
    if (
      studentId &&
      !(await context.tx.student.findFirst({ where: { id: studentId, archived_at: null } }))
    )
      return fail(domainError('INVALID_REFERENCE', 422));
    if (
      representativeId &&
      !(await context.tx.representative.findFirst({
        where: { id: representativeId, archived_at: null },
      }))
    )
      return fail(domainError('INVALID_REFERENCE', 422));
    const membership = await context.tx.householdMembership.create({
      data: {
        household_id: id,
        student_id: studentId ?? null,
        representative_id: representativeId ?? null,
        recorded_by_staff_id: staffId,
        basis,
        valid_from: await now(context.tx),
      },
    });
    return { id: membership.id, householdId: id };
  }
}
