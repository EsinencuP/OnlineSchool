import { Injectable } from '@nestjs/common';
import type { Prisma, TeacherMeetOperation } from '@online-school/db';
import { ok } from '@online-school/shared';
import { domainError, fail, unwrap } from '../../core/errors/domain-error.js';
import type { CriticalContext } from '../../core/http.js';
import { TransactionService } from '../../core/transaction/transaction.service.js';
import { uuid } from '../identity/input.js';
import {
  activeMeetAssignment,
  requireVerifiedMeetTeacher,
} from '../schedule/google-meet/teacher-meet-scope.js';
import { MEET_LINK_REGEX } from '../schedule/meet-link.js';
import type { TeacherContext } from './context/teacher-context.js';

const operationView = (row: TeacherMeetOperation) => ({
  id: row.id,
  kind: row.kind,
  state: row.state,
  queuedAt: row.queued_at.toISOString(),
  finishedAt: row.finished_at?.toISOString() ?? null,
  diagnosticCode: row.diagnostic_code,
  retryAt: row.retry_at?.toISOString() ?? null,
});

type Request =
  { kind: 'CREATE' | 'VERIFY' } | { kind: 'RECONCILE'; operationId: string; meetingUri: string };

@Injectable()
export class TeacherMeetOperationsService {
  constructor(private readonly transactions: TransactionService) {}

  private async pair(
    tx: Prisma.TransactionClient,
    actor: TeacherContext,
    rawAssignmentId: string,
    lock = false,
  ) {
    const now = await requireVerifiedMeetTeacher(tx, actor, lock);
    const assignment = await activeMeetAssignment(tx, uuid(rawAssignmentId), actor.teacherId, now);
    if (!assignment) return fail(domainError('MEET_ASSIGNMENT_NOT_FOUND', 404));
    return {
      now,
      assignmentId: assignment.id,
      scope: { teacher_id: actor.teacherId, student_id: assignment.enrollment_ref.student_id },
    };
  }

  async read(actor: TeacherContext, assignmentId: string) {
    return unwrap(
      await this.transactions.runReadOnly(async (tx) => {
        const { scope } = await this.pair(tx, actor, assignmentId);
        const space = await tx.teacherMeetSpace.findFirst({
          where: { ...scope, retired_at: null },
        });
        const last = await tx.teacherMeetOperation.findFirst({
          where: scope,
          orderBy: [{ queued_at: 'desc' }, { id: 'desc' }],
        });
        const unresolved = await tx.teacherMeetOperation.findFirst({
          where: { ...scope, state: 'UNKNOWN' },
          select: { id: true },
        });
        return ok({
          assignmentId,
          published: space
            ? { meetLink: space.meeting_uri, lastVerifiedAt: space.last_verified_at.toISOString() }
            : null,
          latestOperation: last ? operationView(last) : null,
          unresolvedOperationId: unresolved?.id ?? null,
        });
      }),
    );
  }

  async queue(ctx: CriticalContext, actor: TeacherContext, assignmentId: string, input: Request) {
    if (process.env.GOOGLE_MEET_OAUTH_ENABLED !== 'true')
      return fail(domainError('MEET_OAUTH_UNAVAILABLE', 503));
    const { tx } = ctx;
    const {
      now,
      scope,
      assignmentId: ownedAssignmentId,
    } = await this.pair(tx, actor, assignmentId, true);
    const grant = await tx.teacherMeetOAuthGrant.findUnique({
      where: { teacher_id: actor.teacherId },
    });
    if (!grant?.refresh_ciphertext || grant.disconnected_at)
      return fail(domainError('MEET_CONNECTION_REQUIRED', 409));
    const space = await tx.teacherMeetSpace.findFirst({ where: { ...scope, retired_at: null } });
    const running = await tx.teacherMeetOperation.findFirst({
      where: { ...scope, state: { in: ['QUEUED', 'DISPATCHING'] } },
      select: { id: true },
    });
    if (running) return fail(domainError('MEET_OPERATION_PENDING', 409));
    const unknown = await tx.teacherMeetOperation.findFirst({
      where: { ...scope, state: 'UNKNOWN' },
    });
    let candidateCode: string | null = null;
    let resolvesOperationId: string | null = null;
    if (input.kind === 'RECONCILE') {
      if (!unknown || unknown.id !== uuid(input.operationId))
        return fail(domainError('MEET_UNKNOWN_OPERATION_NOT_FOUND', 404));
      if (unknown.google_subject !== grant.google_subject)
        return fail(domainError('MEET_GOOGLE_SUBJECT_CHANGED', 409));
      if (!MEET_LINK_REGEX.test(input.meetingUri))
        return fail(domainError('INVALID_MEET_LINK', 422));
      candidateCode = new URL(input.meetingUri).pathname.slice(1);
      resolvesOperationId = unknown.id;
    }
    if (input.kind === 'VERIFY') {
      if (!space) return fail(domainError('MEET_SPACE_NOT_FOUND', 404));
      if (space.google_subject !== grant.google_subject)
        return fail(domainError('MEET_GOOGLE_SUBJECT_CHANGED', 409));
    } else {
      if (space) return fail(domainError('MEET_PAIR_ALREADY_HAS_SPACE', 409));
      if (unknown && input.kind === 'CREATE')
        return fail(domainError('MEET_CREATION_REQUIRES_RECONCILIATION', 409));
    }
    const waiting = await tx.teacherMeetOperation.findFirst({
      where: { ...scope, kind: input.kind, retry_at: { gt: now } },
      select: { retry_at: true },
    });
    if (waiting)
      return fail({
        ...domainError('MEET_PROVIDER_RATE_LIMITED', 429),
        details: { retryAt: waiting.retry_at?.toISOString() },
      });
    const row = await tx.teacherMeetOperation.create({
      data: {
        ...scope,
        assignment_id: ownedAssignmentId,
        grant_generation: grant.generation,
        google_subject: grant.google_subject,
        kind: input.kind,
        request_operation_id: ctx.operationId,
        queued_at: now,
        candidate_code: candidateCode,
        resolves_operation_id: resolvesOperationId,
        space_id: input.kind === 'VERIFY' ? space!.id : null,
      },
    });
    return operationView(row);
  }
}
