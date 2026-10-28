import { Injectable } from '@nestjs/common';
import type { CriticalContext } from '../../core/http.js';
import type { RescheduleRequestResponseDto } from './lessons.dto.js';

@Injectable()
export class StudentCrmTaskService {
  async create(
    ctx: CriticalContext,
    input:
      | {
          lessonId: string;
          studentProfileId: string;
          type?: 'RESCHEDULE_REQUEST';
          payload: { reason: string; preferredDate: string };
        }
      | {
          lessonId: string;
          studentProfileId: string;
          type: 'ATTENDANCE_DISPUTE';
          payload: { description: string };
        },
    time: Date,
  ): Promise<RescheduleRequestResponseDto> {
    const manager = await ctx.tx.assignedManager.findFirst({
      where: {
        student_id: input.studentProfileId,
        assigned_at: { lte: time },
        OR: [{ ended_at: null }, { ended_at: { gt: time } }],
        manager: { deactivated_at: null, account: { disabled_at: null } },
      },
      orderBy: [{ assigned_at: 'desc' }, { id: 'asc' }],
    });
    const task = await ctx.tx.crmTask.create({
      data: {
        type: input.type ?? 'RESCHEDULE_REQUEST',
        student_id: input.studentProfileId,
        lesson_id: input.lessonId,
        payload: input.payload,
        title:
          input.type === 'ATTENDANCE_DISPUTE'
            ? 'Оспаривание списания за конкретный урок'
            : 'Запрос ученика на перенос конкретного урока',
        due_at: time,
        assigned_manager_id: manager?.manager_id ?? null,
        idempotency_key: `student-${input.type === 'ATTENDANCE_DISPUTE' ? 'dispute' : 'reschedule'}:${ctx.actor.accountId}:${ctx.operationId}`,
      },
    });
    return { crmTaskId: task.id, status: 'CREATED' };
  }
}
