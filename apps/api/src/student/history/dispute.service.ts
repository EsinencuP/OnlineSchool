import { Injectable } from '@nestjs/common';
import type { CriticalContext } from '../../core/http.js';
import { domainError, fail } from '../../core/errors/domain-error.js';
import { at } from '../../modules/finance/finance-common.js';
import { object, string } from '../../modules/identity/input.js';
import type { IStudentContext } from '../student-context.interface.js';
import { StudentCrmTaskService } from '../lessons/student-crm-task.service.js';
import { StudentHistoryService, DISPUTE_WINDOW_MS } from './history.service.js';
import type { DisputeResponseDto } from './history.dto.js';

@Injectable()
export class StudentDisputeService {
  constructor(
    private readonly history: StudentHistoryService,
    private readonly tasks: StudentCrmTaskService,
  ) {}
  async create(
    ctx: CriticalContext,
    student: IStudentContext,
    lessonId: string,
    body: unknown,
  ): Promise<DisputeResponseDto> {
    const input = object(body, ['description']),
      description = string(input.description, 10, 1000);
    const [lesson] = await ctx.tx.$queryRaw<
      { id: string; student_id: string; scheduled_at: Date }[]
    >`
      SELECT l.id,e.student_id,l.scheduled_at FROM lesson_occurrences l JOIN student_subject_enrollments e ON e.id=l.enrollment_id
      WHERE l.id=${lessonId}::uuid FOR UPDATE OF l`;
    if (!lesson || lesson.student_id !== student.studentProfileId)
      return fail(domainError('LESSON_FORBIDDEN', 403));
    const now = await at(ctx.tx);
    const open = await ctx.tx.crmTask.findFirst({
      where: {
        student_id: student.studentProfileId,
        lesson_id: lessonId,
        type: 'ATTENDANCE_DISPUTE',
        status: { in: ['OPEN', 'IN_PROGRESS'] },
      },
    });
    if (open) return fail(domainError('ATTENDANCE_DISPUTE_ALREADY_OPEN', 409));
    if (+lesson.scheduled_at > +now || +now - +lesson.scheduled_at > DISPUTE_WINDOW_MS)
      return fail(domainError('DISPUTE_WINDOW_CLOSED', 422));
    const eligible = await this.history.eligibility(
      ctx.tx,
      student.studentProfileId,
      lessonId,
      now,
    );
    if (!eligible || eligible.consumption_id === null)
      return fail(domainError('PUBLISHED_LESSON_DEDUCTION_REQUIRED', 422));
    if (eligible.has_open_dispute) return fail(domainError('ATTENDANCE_DISPUTE_ALREADY_OPEN', 409));
    return this.tasks.create(
      ctx,
      {
        type: 'ATTENDANCE_DISPUTE',
        lessonId,
        studentProfileId: student.studentProfileId,
        payload: { description },
      },
      now,
    );
  }
}
