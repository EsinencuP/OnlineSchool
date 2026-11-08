import { Injectable, Module } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { MfaChallengePurpose, Prisma } from '@online-school/db';
import { err, ok } from '@online-school/shared';
import type { Result } from '@online-school/shared';
import { DatabaseService } from '../database/database.module.js';
import { AuditModule, AuditService } from '../audit/audit.service.js';
import type { DomainError } from '../errors/domain-error.js';
import { domainError, fail, unwrap } from '../errors/domain-error.js';
import { UUID, cookie } from '../http.js';
import type { AccountContext, HttpRequest } from '../http.js';
import { LOGIN_COOKIE, randomToken, tokenHash } from './session.store.js';

export function clientChallenge(
  body: unknown,
): Result<{ id: string; challenge: string }, DomainError> {
  try {
    if (
      !body ||
      typeof body !== 'object' ||
      !('challengeId' in body) ||
      typeof body.challengeId !== 'string' ||
      !UUID.test(body.challengeId) ||
      !('response' in body)
    )
      return err(domainError('WEBAUTHN_CHALLENGE_INVALID', 400));
    const input = body as {
      challengeId: string;
      response: { response: { clientDataJSON: string } };
    };
    const encoded = input.response?.response?.clientDataJSON;
    if (typeof encoded !== 'string' || encoded.length > 16384 || !/^[A-Za-z0-9_-]+$/.test(encoded))
      return err(domainError('WEBAUTHN_CHALLENGE_INVALID', 400));
    const data: unknown = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (
      !data ||
      typeof data !== 'object' ||
      !('challenge' in data) ||
      typeof data.challenge !== 'string' ||
      !/^[A-Za-z0-9_-]{43}$/.test(data.challenge)
    )
      return err(domainError('WEBAUTHN_CHALLENGE_INVALID', 400));
    return ok({ id: input.challengeId, challenge: data.challenge });
  } catch {
    return err(domainError('WEBAUTHN_CHALLENGE_INVALID', 400));
  }
}
@Injectable()
export class WebAuthnChallengeStore {
  constructor(private readonly db: DatabaseService) {}
  async create(
    tx: Prisma.TransactionClient,
    actor: AccountContext,
    purpose: MfaChallengePurpose,
  ): Promise<{ id: string; challenge: string }> {
    const challenge = randomToken();
    const clock = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`;
    const now = clock[0]?.now ?? new Date();
    const row = await tx.mfaChallenge.create({
      data: {
        account_id: actor.accountId,
        session_id: actor.sessionId,
        purpose,
        challenge_hash: tokenHash(challenge),
        expires_at: new Date(+now + 300000),
        created_at: now,
        updated_at: now,
      },
    });
    return { id: row.id, challenge };
  }
  async check(
    actor: AccountContext | undefined,
    purpose: MfaChallengePurpose,
    body: unknown,
    loginBinding?: string,
  ): Promise<Result<void, DomainError>> {
    const input = clientChallenge(body);
    if (!input.ok) return input;
    const owners: Prisma.MfaChallengeWhereInput[] = [];
    if (actor) owners.push({ account_id: actor.accountId, session_id: actor.sessionId });
    if (purpose === 'AUTHENTICATION' && loginBinding && /^[A-Za-z0-9_-]{43}$/.test(loginBinding))
      owners.push({ session_id: null, login_binding_hash: tokenHash(loginBinding) });
    if (!owners.length) return err(domainError('WEBAUTHN_CHALLENGE_INVALID', 400));
    const row = await this.db.client.mfaChallenge.findFirst({
      where: {
        id: input.value.id,
        OR: owners,
        purpose,
        challenge_hash: tokenHash(input.value.challenge),
        used_at: null,
        expires_at: { gt: new Date() },
      },
    });
    return row ? ok(undefined) : err(domainError('WEBAUTHN_CHALLENGE_INVALID', 400));
  }
  // Consume only AFTER cryptographic verification, in the same transaction as the credential/MFA update.
  async consume(
    tx: Prisma.TransactionClient,
    actor: AccountContext,
    purpose: MfaChallengePurpose,
    body: unknown,
  ): Promise<Result<void, DomainError>> {
    const input = clientChallenge(body);
    if (!input.ok) return input;
    const rows = await tx.$queryRaw<{ id: string }[]>`
      UPDATE mfa_challenges SET used_at=clock_timestamp(),updated_at=clock_timestamp()
      WHERE id=${input.value.id}::uuid AND account_id=${actor.accountId}::uuid AND session_id=${actor.sessionId}::uuid
        AND purpose=${purpose}::"MfaChallengePurpose" AND challenge_hash=${tokenHash(input.value.challenge)}
        AND used_at IS NULL AND expires_at>clock_timestamp() RETURNING id
    `;
    return rows.length === 1 ? ok(undefined) : err(domainError('WEBAUTHN_CHALLENGE_INVALID', 400));
  }
}
@Injectable()
export class WebAuthnChallengeGuard implements CanActivate {
  constructor(
    private readonly store: WebAuthnChallengeStore,
    private readonly audit: AuditService,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<HttpRequest>();
    const match = /^\/api\/v1\/auth\/webauthn\/(register|authenticate)\/finish$/.exec(
      req.originalUrl.split('?')[0]?.toLowerCase().replace(/\/+$/, '') ?? '',
    );
    if (req.method !== 'POST' || !match) return true;
    const result = await this.store.check(
      req.account,
      match[1] === 'register' ? 'REGISTRATION' : 'AUTHENTICATION',
      req.body,
      cookie(req, LOGIN_COOKIE),
    );
    if (result.ok) return true;
    unwrap(
      await this.audit.denial({
        requestId: req.requestId!,
        action: 'webauthn.challenge.denied',
        code: result.error.code,
        ...(req.account ? { actor: req.account } : {}),
      }),
    );
    return fail(result.error);
  }
}
@Module({
  imports: [AuditModule],
  providers: [WebAuthnChallengeStore, WebAuthnChallengeGuard],
  exports: [WebAuthnChallengeStore, WebAuthnChallengeGuard],
})
export class WebAuthnChallengeModule {}
