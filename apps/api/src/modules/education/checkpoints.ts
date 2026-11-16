import { createHash } from 'node:crypto';
import type { Prisma } from '@online-school/db';

/**
 * Pedagogical checkpoints follow the student's confirmed conducted lessons in one subject
 * (counted across re-enrollments, exactly as the stu08 guard counts them):
 * every 4th lesson opens a LESSON_4 skill review, every 8th also a LESSON_8 education report.
 * Call after the lesson row is CONDUCTED and its LessonActualOutcome exists, inside the confirming
 * transaction. Idempotent per (enrollment, type, count).
 */
export const derivedOperationId = (operationId: string, tag: string): string => {
  const h = createHash('sha256').update(`${operationId}:${tag}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
};

export async function recordCheckpoints(
  tx: Prisma.TransactionClient,
  input: { enrollmentId: string; outcomeId: string; confirmedAt: Date; operationId: string },
): Promise<void> {
  const enrollment = await tx.studentSubjectEnrollment.findUniqueOrThrow({
    where: { id: input.enrollmentId },
    select: { student_id: true, subject_id: true },
  });
  const counted = await tx.$queryRaw<{ count: number }[]>`
    SELECT count(*)::int AS count FROM lesson_actual_outcomes o
    JOIN lesson_occurrences l ON l.id = o.lesson_occurrence_id
    JOIN student_subject_enrollments e ON e.id = l.enrollment_id
    WHERE e.student_id = ${enrollment.student_id}::uuid AND e.subject_id = ${enrollment.subject_id}::uuid
      AND l.status = 'CONDUCTED' AND o.confirmed_at <= ${input.confirmedAt}::timestamptz`;
  const count = counted[0]?.count ?? 0;
  if (count === 0 || count % 4 !== 0) return;
  const types = count % 8 === 0 ? (['LESSON_4', 'LESSON_8'] as const) : (['LESSON_4'] as const);
  for (const type of types) {
    const existing = await tx.progressCheckpoint.findFirst({
      where: { enrollment_id: input.enrollmentId, type, confirmed_lesson_count: count },
      select: { id: true },
    });
    if (existing) continue;
    await tx.progressCheckpoint.create({
      data: {
        enrollment_id: input.enrollmentId,
        type,
        confirmed_lesson_count: count,
        lesson_actual_outcome_id: input.outcomeId,
        triggered_at: input.confirmedAt,
        source_operation_id: derivedOperationId(input.operationId, `checkpoint:${type}:${count}`),
      },
    });
  }
}
