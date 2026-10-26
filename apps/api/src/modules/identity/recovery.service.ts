import { Injectable } from '@nestjs/common';
import type { Prisma } from '@online-school/db';
import type { Result } from '@online-school/shared';
import type { DomainError } from '../../core/errors/domain-error.js';
import { domainError, fail } from '../../core/errors/domain-error.js';
import type { HttpRequest } from '../../core/http.js';
import { header } from '../../core/http.js';
import { constantEqual } from '../../core/csrf/csrf.module.js';
import { randomToken, SessionStore, tokenHash } from '../../core/session/session.store.js';
import { IdentityService, now } from './identity.service.js';
import type { IdentityOutcome } from './identity.service.js';
import { object, string, uuid } from './input.js';

@Injectable()
export class RecoveryService {
  constructor(
    private readonly identity: IdentityService,
    private readonly sessions: SessionStore,
  ) {}
  private async allowed(
    tx: Prisma.TransactionClient,
    actorId: string,
    subjectId: string,
    ownerInstruction: string | null,
  ): Promise<void> {
    if (actorId === subjectId) return fail(domainError('RECOVERY_FORBIDDEN', 403));
    await this.identity.account(tx, actorId);
    const roles = await this.identity.roles(tx, actorId);
    const targetRoles = await this.identity.roles(tx, subjectId);
    if (
      targetRoles.includes('DIRECTOR')
        ? !roles.includes('TECH_OPERATOR') || !ownerInstruction
        : !roles.includes('DIRECTOR')
    )
      return fail(domainError('RECOVERY_FORBIDDEN', 403));
  }
  initiate(req: HttpRequest): Promise<Result<IdentityOutcome, DomainError>> {
    const input = object(req.body, ['authorizationId']);
    const authorizationId = uuid(input.authorizationId);
    return this.identity.execute(req, 'auth.recovery.initiate', async (tx, operationId) => {
      if (!header(req, 'idempotency-key'))
        return fail(domainError('IDEMPOTENCY_KEY_REQUIRED', 400));
      const actor = await this.identity.actor(req, tx);
      if (!actor.mfaCompleted || actor.recoveryOnly) return fail(domainError('MFA_REQUIRED', 403));
      await tx.$queryRaw`SELECT id FROM recovery_authorizations WHERE id=${authorizationId}::uuid FOR UPDATE`;
      const authorization = await tx.recoveryAuthorization.findUnique({
        where: { id: authorizationId },
      });
      const at = await now(tx);
      if (
        !authorization ||
        authorization.authorized_actor_id !== actor.accountId ||
        authorization.expires_at <= at
      )
        return fail(domainError('RECOVERY_AUTHORIZATION_INVALID', 403));
      const subject = await this.identity.account(tx, authorization.subject_account_id, true);
      if (subject.kind === 'STUDENT') return fail(domainError('RECOVERY_FORBIDDEN', 403));
      await this.allowed(tx, actor.accountId, subject.id, authorization.owner_instruction_ref);
      if (await tx.recoveryRequest.findUnique({ where: { authorization_id: authorizationId } }))
        return fail(domainError('RECOVERY_ALREADY_INITIATED', 409));
      await this.identity.revoke(tx, subject.id, actor.accountId, 'RECOVERY_INITIATED', true);
      await tx.webAuthnCredential.updateMany({
        where: { account_id: subject.id, revoked_at: null },
        data: { revoked_at: at },
      });
      await tx.$executeRaw`UPDATE mfa_challenges SET used_at=clock_timestamp(),updated_at=clock_timestamp() WHERE account_id=${subject.id}::uuid AND used_at IS NULL AND expires_at>clock_timestamp()`;
      await tx.authAccount.update({
        where: { id: subject.id },
        data: { recovery_registration_required: true },
      });
      await tx.recoveryRequest.updateMany({
        where: {
          authorization: { subject_account_id: subject.id },
          completed_at: null,
          revoked_at: null,
        },
        data: { revoked_at: at },
      });
      const token = randomToken();
      const expiresAt = new Date(Math.min(+authorization.expires_at, +at + 15 * 60 * 1000));
      const request = await tx.recoveryRequest.create({
        data: {
          authorization_id: authorization.id,
          command_operation_id: operationId,
          token_hash: tokenHash(token),
          expires_at: expiresAt,
          created_at: at,
          updated_at: at,
        },
      });
      // A one-time authorized handoff, not a cached command result or a self-service backup code.
      return {
        actorId: actor.accountId,
        resourceType: 'AuthAccount',
        resourceId: subject.id,
        body: { recoveryId: request.id, token, expires_at: expiresAt.toISOString() },
      };
    });
  }
  complete(req: HttpRequest): Promise<Result<IdentityOutcome, DomainError>> {
    const input = object(req.body, ['recoveryId', 'token']);
    const recoveryId = uuid(input.recoveryId);
    const token = string(input.token, 43, 43);
    return this.identity.execute(
      req,
      'auth.recovery.complete',
      async (tx) => {
        if (!/^[A-Za-z0-9_-]{43}$/.test(token))
          return fail(domainError('RECOVERY_TOKEN_INVALID', 400));
        await tx.$queryRaw`SELECT id FROM recovery_requests WHERE id=${recoveryId}::uuid FOR UPDATE`;
        const request = await tx.recoveryRequest.findUnique({
          where: { id: recoveryId },
          include: { authorization: true },
        });
        const at = await now(tx);
        if (
          !request ||
          request.completed_at ||
          request.revoked_at ||
          request.expires_at <= at ||
          !constantEqual(request.token_hash, tokenHash(token))
        )
          return fail(domainError('RECOVERY_TOKEN_INVALID', 400));
        const authorization = request.authorization;
        const subject = await this.identity.account(tx, authorization.subject_account_id, true);
        if (!subject.recovery_registration_required || authorization.expires_at <= at)
          return fail(domainError('RECOVERY_TOKEN_INVALID', 400));
        await this.allowed(
          tx,
          authorization.authorized_actor_id,
          subject.id,
          authorization.owner_instruction_ref,
        );
        await this.identity.revoke(
          tx,
          subject.id,
          authorization.authorized_actor_id,
          'RECOVERY_COMPLETED',
          true,
        );
        await tx.recoveryRequest.update({ where: { id: request.id }, data: { completed_at: at } });
        const issued = await this.sessions.issue(tx, subject.id, null, true);
        return {
          actorId: subject.id,
          resourceType: 'Session',
          resourceId: issued.sessionId,
          issued,
          body: await this.identity.sessionBody(tx, subject, issued, false, true),
        };
      },
      recoveryId,
    );
  }
}
