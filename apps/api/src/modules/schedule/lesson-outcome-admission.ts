import type { LessonOccurrence, Prisma } from '@online-school/db';
import { domainError, fail } from '../../core/errors/domain-error.js';
import { uuid } from '../identity/input.js';
import { admission } from './booking.service.js';

export async function lessonOutcomeAdmission(
  tx: Prisma.TransactionClient,
  lesson: Pick<LessonOccurrence, 'id' | 'enrollment_id'>,
  start: Date,
  requested: unknown,
) {
  const permissionId = requested === undefined ? undefined : uuid(requested);
  const held = await tx.lessonAdmissionStart.findUnique({
    where: { lesson_id: lesson.id },
    select: { permission_id: true },
  });
  if (held) {
    if (permissionId !== undefined && held.permission_id !== permissionId)
      return fail(domainError('DIRECTOR_PERMISSION_NOT_APPLICABLE', 422));
    return { paid: false, permissionId: held.permission_id };
  }
  if (permissionId)
    await tx.$queryRaw`SELECT id FROM temporary_access_permissions WHERE id=${permissionId}::uuid FOR UPDATE`;
  const allowed = await admission(tx, lesson.enrollment_id, start, permissionId);
  if (permissionId && allowed.permissionId !== permissionId)
    return fail(domainError('DIRECTOR_PERMISSION_NOT_APPLICABLE', 422));
  // Legacy outcomes can record an unpaid fact without assigning an unused decision retroactively.
  return { paid: allowed.paid, permissionId: permissionId ?? null };
}
