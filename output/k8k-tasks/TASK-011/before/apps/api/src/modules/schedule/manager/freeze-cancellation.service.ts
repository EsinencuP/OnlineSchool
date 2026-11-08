import { Injectable } from '@nestjs/common';
import type { Prisma } from '@online-school/db';
import { err, ok } from '@online-school/shared';
import type { Result } from '@online-school/shared';
import type { DomainError } from '../../../core/errors/domain-error.js';
import { domainError, unwrap } from '../../../core/errors/domain-error.js';
import type { CriticalContext } from '../../../core/http.js';
import { LessonCancellationPort } from '../../finance/manager-subscriptions/contracts.js';
import type { SubscriptionActor } from '../../finance/manager-subscriptions/contracts.js';
import { ManagerScheduleWorkflow } from './workflow.service.js';
import { ScheduleAccess } from '../schedule-access.service.js';
import { scheduleFailure } from './policy.js';
@Injectable()
export class ScheduleFreezeCancellation extends LessonCancellationPort {
  constructor(
    private readonly workflow: ManagerScheduleWorkflow,
    private readonly access: ScheduleAccess,
  ) {
    super();
  }
  async cancelWithoutCharge(
    actor: SubscriptionActor,
    ids: string[],
    reason: string,
    tx: Prisma.TransactionClient,
    command: CriticalContext,
  ): Promise<Result<void, DomainError>> {
    try {
      if (
        tx !== command.tx ||
        actor.accountId !== command.actor.accountId ||
        (await this.access.staff(command)) !== actor.managerId
      )
        return err(domainError('FORBIDDEN_ROLE', 403));
      for (const id of [...new Set(ids)].sort()) {
        const lesson = await this.access.lesson(command, id);
        const enrollment = await this.access.enrollment(command, lesson.enrollment_id);
        unwrap(
          await this.workflow.cancel(
            command,
            enrollment.student_id,
            id,
            { reason: `Subscription freeze: ${reason}`, chargeable: false, initiator: 'ACADEMY' },
            true,
          ),
        );
      }
      return ok(undefined);
    } catch (error: unknown) {
      return err(scheduleFailure(error));
    }
  }
}
