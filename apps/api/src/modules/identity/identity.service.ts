import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { AuthAccount, MfaChallenge, Prisma, RoleCode } from '@online-school/db';
import { err } from '@online-school/shared';
import type { Result } from '@online-school/shared';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/server';
import { AuditService } from '../../core/audit/audit.service.js';
import { DatabaseService } from '../../core/database/database.module.js';
import { AppException, domainError, fail, unwrap } from '../../core/errors/domain-error.js';
import type { DomainError } from '../../core/errors/domain-error.js';
import { cookie, header, UUID } from '../../core/http.js';
import type { AccountContext, HttpRequest } from '../../core/http.js';
import {
  LOGIN_COOKIE,
  SESSION_COOKIE,
  SessionStore,
  randomToken,
  tokenHash,
} from '../../core/session/session.store.js';
import type { IssuedSession } from '../../core/session/session.store.js';
import {
  clientChallenge,
  WebAuthnChallengeStore,
} from '../../core/session/webauthn-challenge.store.js';
import { TransactionService } from '../../core/transaction/transaction.service.js';
import { AuthRateLimitService } from './auth-rate-limit.service.js';
import { email, object } from './input.js';
import { Passwords } from './passwords.js';
import { WebAuthnConfig } from './webauthn.config.js';

type Tx = Prisma.TransactionClient;
export type IdentityOutcome = {
  body: unknown;
  actorId: string | null;
  resourceType: string;
  resourceId: string;
  issued?: IssuedSession;
  loginBinding?: string;
  clearLoginBinding?: boolean;
};
export const now = async (tx: Tx): Promise<Date> =>
  (await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`)[0]!.now;
export const userHandle = (id: string): Uint8Array<ArrayBuffer> =>
  new Uint8Array(Buffer.from(id.replaceAll('-', ''), 'hex'));

@Injectable()
export class IdentityService {
  constructor(
    private readonly db: DatabaseService,
    private readonly transactions: TransactionService,
    private readonly audit: AuditService,
    private readonly sessions: SessionStore,
    private readonly challenges: WebAuthnChallengeStore,
    private readonly config: WebAuthnConfig,
    private readonly passwords: Passwords,
    private readonly rate: AuthRateLimitService,
  ) {}

  async execute(
    req: HttpRequest,
    action: string,
    fn: (tx: Tx, operationId: string) => Promise<IdentityOutcome>,
    identifier?: string,
  ): Promise<Result<IdentityOutcome, DomainError>> {
    let result: Result<IdentityOutcome, DomainError>;
    try {
      await this.rate.limit(req, action, identifier);
      const origin = header(req, 'origin');
      if (action.includes('webauthn') && origin && origin !== this.config.settings.origin)
        return fail(domainError('WEBAUTHN_ORIGIN_INVALID', 400));
      const supplied = header(req, 'idempotency-key');
      if (supplied && !UUID.test(supplied))
        return fail(domainError('IDEMPOTENCY_KEY_INVALID', 400));
      const operationId = supplied?.toLowerCase() ?? randomUUID();
      result = await this.transactions.runCritical(async (tx) => {
        const outcome = await fn(tx, operationId);
        const id = randomUUID();
        await this.audit.record(
          {
            id,
            actor_kind: outcome.actorId ? 'ACCOUNT' : 'ANONYMOUS',
            actor_id: outcome.actorId,
            action,
            resource_type: outcome.resourceType,
            resource_id: outcome.resourceId,
            result: 'SUCCESS',
            request_id: req.requestId!,
            source_operation_id: operationId,
            event_key: `identity:${id}`,
          },
          tx,
        );
        await tx.outboxEvent.create({
          data: {
            topic: `${action}.v1`,
            aggregate_type: outcome.resourceType,
            aggregate_id: outcome.resourceId,
            source_operation_id: operationId,
            audit_event_id: id,
            event_key: `identity:${id}`,
            payload: { schemaVersion: 1, resourceId: outcome.resourceId },
          },
        });
        return outcome;
      });
    } catch (error: unknown) {
      result = err(
        error instanceof AppException ? error.domain : domainError('IDENTITY_UNAVAILABLE', 503),
      );
    }
    if (!result.ok) {
      const audit = await this.audit.denial({
        requestId: req.requestId!,
        action: `${action}.denied`,
        code: result.error.code,
        ...(req.account ? { actor: req.account } : {}),
      });
      if (!audit.ok) return audit;
    }
    return result;
  }
  async account(tx: Tx, id: string, recovery = false): Promise<AuthAccount> {
    const rows = await tx.$queryRaw<
      { id: string }[]
    >`SELECT id FROM auth_accounts WHERE id=${id}::uuid FOR UPDATE`;
    if (!rows.length) return fail(domainError('INVALID_CREDENTIALS', 401));
    const account = await tx.authAccount.findUniqueOrThrow({ where: { id } });
    if (account.disabled_at || (!recovery && account.recovery_registration_required))
      return fail(domainError('INVALID_CREDENTIALS', 401));
    const profile =
      account.kind === 'STAFF'
        ? await tx.staffAccount.findFirst({ where: { account_id: id, deactivated_at: null } })
        : account.kind === 'TEACHER'
          ? await tx.teacherAccount.findFirst({ where: { account_id: id, deactivated_at: null } })
          : await tx.studentAccount.findFirst({ where: { account_id: id, deactivated_at: null } });
    const roles = await this.roles(tx, id);
    if (!profile || roles.length === 0) return fail(domainError('INVALID_CREDENTIALS', 401));
    return account;
  }
  async roles(tx: Tx, id: string): Promise<RoleCode[]> {
    return (
      await tx.$queryRaw<
        { code: RoleCode }[]
      >`SELECT r.code FROM role_assignments a JOIN roles r ON r.id=a.role_id WHERE a.account_id=${id}::uuid AND a.valid_from<=clock_timestamp() AND (a.valid_to IS NULL OR a.valid_to>clock_timestamp()) ORDER BY r.code`
    ).map((row) => row.code);
  }
  async actor(req: HttpRequest, tx: Tx): Promise<AccountContext> {
    return unwrap(await this.sessions.resolve(cookie(req, SESSION_COOKIE), tx));
  }
  async sessionBody(
    tx: Tx,
    account: AuthAccount,
    issued: IssuedSession,
    mfa: boolean,
    recoveryOnly = false,
  ): Promise<unknown> {
    const roles = await this.roles(tx, account.id);
    return {
      account: { id: account.id, kind: account.kind, roles },
      mfa_completed: mfa,
      recovery_only: recoveryOnly,
      expires_at: issued.expiresAt.toISOString(),
      csrfToken: issued.csrfToken,
    };
  }
  async revoke(
    tx: Tx,
    accountId: string,
    actorId: string | null,
    reason: string,
    all: boolean,
    sessionId?: string,
  ): Promise<void> {
    const at = await now(tx);
    await tx.session.updateMany({
      where: { account_id: accountId, revoked_at: null, ...(all ? {} : { id: sessionId! }) },
      data: { revoked_at: at },
    });
    await tx.accessRevocation.create({
      data: {
        account_id: accountId,
        session_id: all ? null : sessionId!,
        revoked_by_account_id: actorId,
        source: reason,
        reason,
        revoked_at: at,
        created_at: at,
        updated_at: at,
      },
    });
  }
  login(req: HttpRequest): Promise<Result<IdentityOutcome, DomainError>> {
    const input = object(req.body, ['method', 'email', 'password']);
    if (input.method === 'passkey') {
      if (input.password !== undefined)
        return Promise.resolve(err(domainError('INVALID_INPUT', 400)));
      return this.authenticateStart(req, { email: input.email });
    }
    if (input.method !== undefined && input.method !== 'password')
      return Promise.resolve(err(domainError('INVALID_INPUT', 400)));
    const login = email(input.email);
    if (typeof input.password !== 'string' || !input.password.length || input.password.length > 256)
      return Promise.resolve(err(domainError('INVALID_INPUT', 400)));
    const password = input.password;
    return this.execute(
      req,
      'auth.password',
      async (tx) => {
        const found = await tx.authAccount.findUnique({ where: { login_id: login } });
        const valid = await this.passwords.verify(password, found?.password_hash ?? null);
        if (!found || !valid) return fail(domainError('INVALID_CREDENTIALS', 401));
        const account = await this.account(tx, found.id);
        if (cookie(req, SESSION_COOKIE)) {
          const existing = await this.sessions.resolve(cookie(req, SESSION_COOKIE), tx);
          if (existing.ok)
            await this.revoke(
              tx,
              existing.value.accountId,
              existing.value.accountId,
              'SESSION_REPLACED',
              false,
              existing.value.sessionId,
            );
        }
        const issued = await this.sessions.issue(tx, account.id);
        return {
          actorId: account.id,
          resourceType: 'Session',
          resourceId: issued.sessionId,
          issued,
          body: await this.sessionBody(tx, account, issued, false),
        };
      },
      login,
    );
  }
  logout(req: HttpRequest): Promise<Result<IdentityOutcome, DomainError>> {
    object(req.body ?? {}, []);
    return this.execute(req, 'auth.logout', async (tx) => {
      const actor = await this.actor(req, tx);
      await this.revoke(
        tx,
        actor.accountId,
        actor.accountId,
        'USER_LOGOUT',
        false,
        actor.sessionId,
      );
      return {
        actorId: actor.accountId,
        resourceType: 'Session',
        resourceId: actor.sessionId,
        body: { loggedOut: true },
        clearLoginBinding: true,
      };
    });
  }
  registerStart(req: HttpRequest): Promise<Result<IdentityOutcome, DomainError>> {
    object(req.body ?? {}, []);
    return this.execute(req, 'auth.webauthn.register.start', async (tx) => {
      const actor = await this.actor(req, tx);
      const account = await this.account(tx, actor.accountId, true);
      if (account.kind === 'STUDENT') return fail(domainError('STUDENT_PASSKEYS_NOT_ALLOWED', 403));
      const credentials = await tx.webAuthnCredential.findMany({
        where: { account_id: actor.accountId, revoked_at: null },
      });
      if (credentials.length && !actor.mfaCompleted) return fail(domainError('MFA_REQUIRED', 403));
      const challenge = await this.challenges.create(tx, actor, 'REGISTRATION');
      const config = this.config.settings;
      const options = await generateRegistrationOptions({
        rpName: config.rpName,
        rpID: config.rpId,
        userName: account.login_id,
        userID: userHandle(account.id),
        challenge: new Uint8Array(Buffer.from(challenge.challenge, 'base64url')),
        timeout: 300000,
        attestationType: 'none',
        supportedAlgorithmIDs: [-7, -257],
        authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
        excludeCredentials: credentials.map((key) => ({
          id: Buffer.from(key.credential_id).toString('base64url'),
          transports: key.transports,
        })),
      });
      return {
        actorId: actor.accountId,
        resourceType: 'MfaChallenge',
        resourceId: challenge.id,
        body: { challengeId: challenge.id, options },
      };
    });
  }
  private clientData(
    body: unknown,
    type: 'webauthn.create' | 'webauthn.get',
  ): {
    input: { id: string; challenge: string };
    response: RegistrationResponseJSON | AuthenticationResponseJSON;
  } {
    const request = object(body, ['challengeId', 'response']);
    const input = unwrap(clientChallenge(request));
    const response = request.response as RegistrationResponseJSON | AuthenticationResponseJSON;
    let data: { origin?: string; type?: string; crossOrigin?: boolean; topOrigin?: string };
    try {
      data = JSON.parse(
        Buffer.from(response.response.clientDataJSON, 'base64url').toString('utf8'),
      ) as typeof data;
    } catch {
      return fail(domainError('WEBAUTHN_RESPONSE_INVALID', 400));
    }
    if (
      data.origin !== this.config.settings.origin ||
      data.crossOrigin === true ||
      data.topOrigin !== undefined
    )
      return fail(domainError('WEBAUTHN_ORIGIN_INVALID', 400));
    if (
      data.type !== type ||
      typeof response.id !== 'string' ||
      !response.id.length ||
      response.id.length > 1400 ||
      !/^[A-Za-z0-9_-]+$/.test(response.id) ||
      response.rawId !== response.id ||
      response.type !== 'public-key'
    )
      return fail(domainError('WEBAUTHN_RESPONSE_INVALID', 400));
    return { input, response };
  }
  private async challenge(
    tx: Tx,
    req: HttpRequest,
    purpose: 'REGISTRATION' | 'AUTHENTICATION',
    input: { id: string; challenge: string },
  ): Promise<MfaChallenge> {
    await tx.$queryRaw`SELECT id FROM mfa_challenges WHERE id=${input.id}::uuid FOR UPDATE`;
    const row = await tx.mfaChallenge.findUnique({ where: { id: input.id } });
    const at = await now(tx);
    if (
      !row ||
      row.used_at ||
      row.expires_at <= at ||
      row.purpose !== purpose ||
      row.challenge_hash !== tokenHash(input.challenge)
    )
      return fail(domainError('WEBAUTHN_CHALLENGE_INVALID', 400));
    if (row.session_id) {
      const actor = await this.actor(req, tx);
      if (actor.sessionId !== row.session_id || actor.accountId !== row.account_id)
        return fail(domainError('WEBAUTHN_CHALLENGE_INVALID', 400));
    } else {
      const binding = cookie(req, LOGIN_COOKIE);
      if (
        purpose !== 'AUTHENTICATION' ||
        !binding ||
        !/^[A-Za-z0-9_-]{43}$/.test(binding) ||
        row.login_binding_hash !== tokenHash(binding)
      )
        return fail(domainError('WEBAUTHN_CHALLENGE_INVALID', 400));
    }
    return row;
  }
  private async consume(tx: Tx, row: MfaChallenge): Promise<void> {
    const count =
      await tx.$executeRaw`UPDATE mfa_challenges SET used_at=clock_timestamp(),updated_at=clock_timestamp() WHERE id=${row.id}::uuid AND used_at IS NULL AND expires_at>clock_timestamp()`;
    if (count !== 1) return fail(domainError('WEBAUTHN_CHALLENGE_INVALID', 400));
  }
  registerFinish(req: HttpRequest): Promise<Result<IdentityOutcome, DomainError>> {
    return this.execute(req, 'auth.webauthn.register.finish', async (tx) => {
      const actor = await this.actor(req, tx);
      const account = await this.account(tx, actor.accountId, true);
      if (account.kind === 'STUDENT') return fail(domainError('STUDENT_PASSKEYS_NOT_ALLOWED', 403));
      const { input, response } = this.clientData(req.body, 'webauthn.create');
      const challenge = await this.challenge(tx, req, 'REGISTRATION', input);
      if (
        (await tx.webAuthnCredential.count({
          where: { account_id: account.id, revoked_at: null },
        })) &&
        !actor.mfaCompleted
      )
        return fail(domainError('MFA_REQUIRED', 403));
      let verified;
      try {
        verified = await verifyRegistrationResponse({
          response: response as RegistrationResponseJSON,
          expectedChallenge: input.challenge,
          expectedOrigin: this.config.settings.origin,
          expectedRPID: this.config.settings.rpId,
          requireUserVerification: true,
          requireUserPresence: true,
          supportedAlgorithmIDs: [-7, -257],
        });
      } catch {
        return fail(domainError('WEBAUTHN_VERIFICATION_FAILED', 400));
      }
      if (!verified.verified || !verified.registrationInfo)
        return fail(domainError('WEBAUTHN_VERIFICATION_FAILED', 400));
      const info = verified.registrationInfo;
      const key = await tx.webAuthnCredential.create({
        data: {
          account_id: account.id,
          aaguid: info.aaguid,
          credential_id: Buffer.from(info.credential.id, 'base64url'),
          public_key: new Uint8Array(info.credential.publicKey),
          sign_count: BigInt(info.credential.counter),
          transports: info.credential.transports ?? [],
          backup_eligible: info.credentialDeviceType === 'multiDevice',
          backed_up: info.credentialBackedUp,
        },
      });
      await this.consume(tx, challenge);
      if (account.recovery_registration_required) {
        if (!actor.recoveryOnly) return fail(domainError('RECOVERY_REGISTRATION_ONLY', 403));
        await tx.authAccount.update({
          where: { id: account.id },
          data: { recovery_registration_required: false },
        });
        await tx.session.update({ where: { id: actor.sessionId }, data: { recovery_only: false } });
      }
      return {
        actorId: account.id,
        resourceType: 'WebAuthnCredential',
        resourceId: key.id,
        body: { id: key.id, registered: true, mfa_completed: actor.mfaCompleted },
      };
    });
  }
  authenticateStart(
    req: HttpRequest,
    body: unknown = req.body ?? {},
  ): Promise<Result<IdentityOutcome, DomainError>> {
    const input = object(body, ['email']);
    const login = input.email === undefined ? undefined : email(input.email);
    return this.execute(
      req,
      'auth.webauthn.authenticate.start',
      async (tx) => {
        const config = this.config.settings;
        const challenge = randomToken();
        const binding = randomToken();
        let actor: AccountContext | undefined;
        let account: AuthAccount | null = null;
        if (login) account = await tx.authAccount.findUnique({ where: { login_id: login } });
        else {
          actor = await this.actor(req, tx);
          account = await this.account(tx, actor.accountId);
        }
        // Public account discovery is deliberately identical for absent/disabled/recovery accounts.
        let id: string = randomUUID();
        if (actor && account?.kind === 'STUDENT')
          return fail(domainError('STUDENT_PASSKEYS_NOT_ALLOWED', 403));
        if (
          account &&
          account.kind !== 'STUDENT' &&
          !account.disabled_at &&
          !account.recovery_registration_required
        ) {
          const at = await now(tx);
          const row = await tx.mfaChallenge.create({
            data: {
              account_id: account.id,
              session_id: actor?.sessionId ?? null,
              login_binding_hash: actor ? null : tokenHash(binding),
              purpose: 'AUTHENTICATION',
              challenge_hash: tokenHash(challenge),
              expires_at: new Date(+at + 300000),
              created_at: at,
              updated_at: at,
            },
          });
          id = row.id;
        }
        const credentials = actor
          ? await tx.webAuthnCredential.findMany({
              where: { account_id: actor.accountId, revoked_at: null },
            })
          : [];
        const options = await generateAuthenticationOptions({
          rpID: config.rpId,
          challenge: new Uint8Array(Buffer.from(challenge, 'base64url')),
          timeout: 300000,
          userVerification: 'required',
          ...(actor
            ? {
                allowCredentials: credentials.map((key) => ({
                  id: Buffer.from(key.credential_id).toString('base64url'),
                  transports: key.transports,
                })),
              }
            : {}),
        });
        return {
          actorId: actor?.accountId ?? null,
          resourceType: 'MfaChallenge',
          resourceId: id,
          body: { challengeId: id, options },
          ...(!actor ? { loginBinding: binding } : {}),
        };
      },
      login,
    );
  }
  authenticateFinish(req: HttpRequest): Promise<Result<IdentityOutcome, DomainError>> {
    return this.execute(req, 'auth.webauthn.authenticate.finish', async (tx) => {
      const { input, response } = this.clientData(req.body, 'webauthn.get');
      const challenge = await this.challenge(tx, req, 'AUTHENTICATION', input);
      let account: AuthAccount;
      try {
        account = await this.account(tx, challenge.account_id);
      } catch (error: unknown) {
        if (error instanceof AppException && error.domain.status === 401)
          return fail(domainError('WEBAUTHN_VERIFICATION_FAILED', 400));
        return Promise.reject(error);
      }
      const credentialId = Buffer.from(response.id, 'base64url');
      if (account.kind === 'STUDENT') return fail(domainError('WEBAUTHN_VERIFICATION_FAILED', 400));
      const key = await tx.webAuthnCredential.findUnique({
        where: { credential_id: credentialId },
      });
      if (!key || key.account_id !== account.id || key.revoked_at)
        return fail(domainError('WEBAUTHN_VERIFICATION_FAILED', 400));
      await tx.$queryRaw`SELECT id FROM webauthn_credentials WHERE id=${key.id}::uuid FOR UPDATE`;
      const current = await tx.webAuthnCredential.findUniqueOrThrow({ where: { id: key.id } });
      if (current.revoked_at) return fail(domainError('WEBAUTHN_VERIFICATION_FAILED', 400));
      const auth = response as AuthenticationResponseJSON;
      if (
        auth.response.userHandle &&
        auth.response.userHandle !== Buffer.from(userHandle(account.id)).toString('base64url')
      )
        return fail(domainError('WEBAUTHN_VERIFICATION_FAILED', 400));
      let verified;
      try {
        verified = await verifyAuthenticationResponse({
          response: auth,
          expectedChallenge: input.challenge,
          expectedOrigin: this.config.settings.origin,
          expectedRPID: this.config.settings.rpId,
          requireUserVerification: true,
          credential: {
            id: response.id,
            publicKey: new Uint8Array(current.public_key),
            counter: Number(current.sign_count),
          },
        });
      } catch {
        return fail(domainError('WEBAUTHN_VERIFICATION_FAILED', 400));
      }
      const info = verified.authenticationInfo;
      if (
        !verified.verified ||
        (info.credentialDeviceType === 'multiDevice') !== current.backup_eligible
      )
        return fail(domainError('WEBAUTHN_VERIFICATION_FAILED', 400));
      await tx.webAuthnCredential.update({
        where: { id: current.id },
        data: {
          sign_count: BigInt(info.newCounter),
          last_used_at: await now(tx),
          backed_up: info.credentialBackedUp,
        },
      });
      await this.consume(tx, challenge);
      if (challenge.session_id)
        await this.revoke(tx, account.id, account.id, 'MFA_UPGRADE', false, challenge.session_id);
      const issued = await this.sessions.issue(tx, account.id, await now(tx));
      return {
        actorId: account.id,
        resourceType: 'Session',
        resourceId: issued.sessionId,
        issued,
        clearLoginBinding: true,
        body: await this.sessionBody(tx, account, issued, true),
      };
    });
  }
}
