import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@online-school/db';
import { ok } from '@online-school/shared';
import { AuditService } from '../../core/audit/audit.service.js';
import { domainError, fail, unwrap } from '../../core/errors/domain-error.js';
import { TransactionService } from '../../core/transaction/transaction.service.js';
import {
  GoogleMeetOAuthClient,
  isMeetOAuthProof,
  meetOAuthStateHash,
  readMeetOAuthConfig,
} from '../schedule/google-meet/google-meet-oauth.js';
import { MeetSecretStore } from '../schedule/google-meet/meet-secret-store.js';
import { requireVerifiedMeetTeacher } from '../schedule/google-meet/teacher-meet-scope.js';
import type { TeacherContext } from './context/teacher-context.js';

const CHALLENGE_TTL_MS = 10 * 60 * 1000;
const REVOCATION_CLAIM_MS = 30_000;
type Tx = Prisma.TransactionClient;
type Projection = {
  state: 'DISCONNECTED' | 'REVOCATION_PENDING' | 'CONNECTED';
  available: boolean;
};

@Injectable()
export class TeacherMeetOAuthService {
  constructor(
    private readonly transactions: TransactionService,
    private readonly audit: AuditService,
  ) {}

  private runtime() {
    const config = readMeetOAuthConfig(process.env);
    const secrets = MeetSecretStore.fromEnvironment(process.env);
    return config.ok && secrets.ok
      ? { oauth: new GoogleMeetOAuthClient(config.value), secrets: secrets.value }
      : null;
  }

  private available() {
    return process.env.GOOGLE_MEET_OAUTH_ENABLED === 'true';
  }

  private record(tx: Tx, ctx: TeacherContext, action: string) {
    return this.audit.record(
      {
        actor_kind: 'ACCOUNT',
        actor_id: ctx.accountId,
        request_id: ctx.requestId,
        action,
        resource_type: 'TeacherMeetOAuthGrant',
        resource_id: ctx.teacherId,
        result: 'SUCCESS',
        event_key: `meet-oauth:${randomUUID()}`,
      },
      tx,
    );
  }

  async status(ctx: TeacherContext): Promise<Projection> {
    return unwrap(
      await this.transactions.runReadOnly(async (tx) => {
        await requireVerifiedMeetTeacher(tx, ctx);
        const row = await tx.teacherMeetOAuthGrant.findUnique({
          where: { teacher_id: ctx.teacherId },
          select: { disconnected_at: true, provider_revoked_at: true },
        });
        const state =
          !row || row.provider_revoked_at
            ? 'DISCONNECTED'
            : row.disconnected_at
              ? 'REVOCATION_PENDING'
              : 'CONNECTED';
        return ok({ state, available: this.available() && this.runtime() !== null });
      }),
    );
  }

  async start(ctx: TeacherContext) {
    const runtime = this.available() && this.runtime();
    if (!runtime) return fail(domainError('MEET_OAUTH_UNAVAILABLE', 503));
    const proof = runtime.oauth.authorization();
    return unwrap(
      await this.transactions.runCritical(async (tx) => {
        const now = await requireVerifiedMeetTeacher(tx, ctx, true);
        const grant = await tx.teacherMeetOAuthGrant.findUnique({
          where: { teacher_id: ctx.teacherId },
        });
        if (grant?.disconnected_at && !grant.provider_revoked_at)
          return fail(domainError('MEET_OAUTH_REVOCATION_PENDING', 409));
        const expires = new Date(+now + CHALLENGE_TTL_MS);
        const values = {
          session_id: ctx.sessionId,
          state_hash: proof.stateHash,
          verifier_ciphertext: runtime.secrets.seal(proof.verifier, {
            purpose: 'pkce',
            teacherId: ctx.teacherId,
            sessionId: ctx.sessionId,
            stateHash: proof.stateHash,
          }),
          grant_generation: grant?.generation ?? 0,
          expires_at: expires,
          claimed_at: null,
        };
        await tx.teacherMeetOAuthChallenge.upsert({
          where: { teacher_id: ctx.teacherId },
          create: { teacher_id: ctx.teacherId, ...values },
          update: values,
        });
        await this.record(tx, ctx, 'teacher.meet-oauth.started');
        return { authorizationUrl: proof.authorizationUrl, expiresAt: expires.toISOString() };
      }),
    );
  }

  async complete(ctx: TeacherContext, state: string, code: string): Promise<Projection> {
    const runtime = this.available() && this.runtime();
    if (!runtime) return fail(domainError('MEET_OAUTH_UNAVAILABLE', 503));
    if (!isMeetOAuthProof(state)) return fail(domainError('MEET_OAUTH_STATE_INVALID', 422));
    const stateHash = meetOAuthStateHash(state);
    const match = { teacher_id: ctx.teacherId, session_id: ctx.sessionId, state_hash: stateHash };
    const verifier = unwrap(
      await this.transactions.runCritical(async (tx) => {
        const now = await requireVerifiedMeetTeacher(tx, ctx, true);
        const row = await tx.teacherMeetOAuthChallenge.findFirst({
          where: { ...match, claimed_at: null, expires_at: { gt: now } },
        });
        if (!row) return fail(domainError('MEET_OAUTH_STATE_INVALID', 409));
        const value = runtime.secrets.open(row.verifier_ciphertext, {
          purpose: 'pkce',
          teacherId: ctx.teacherId,
          sessionId: ctx.sessionId,
          stateHash,
        });
        if (!value.ok) return fail(domainError(value.error.code, 503));
        await tx.teacherMeetOAuthChallenge.update({
          where: { teacher_id: ctx.teacherId },
          data: { claimed_at: now },
        });
        return value.value;
      }),
    );
    const tokens = await runtime.oauth.exchange(code, verifier);
    if (!tokens.ok) {
      const status = tokens.error.code === 'OAUTH_PROVIDER_UNAVAILABLE' ? 503 : 422;
      return fail(domainError(tokens.error.code, status));
    }
    return unwrap(
      await this.transactions.runCritical(async (tx) => {
        const now = await requireVerifiedMeetTeacher(tx, ctx, true);
        const challenge = await tx.teacherMeetOAuthChallenge.findFirst({
          where: { ...match, claimed_at: { not: null }, expires_at: { gt: now } },
        });
        const grant = await tx.teacherMeetOAuthGrant.findUnique({
          where: { teacher_id: ctx.teacherId },
        });
        if (!challenge || challenge.grant_generation !== (grant?.generation ?? 0))
          return fail(domainError('MEET_OAUTH_STATE_INVALID', 409));
        if (
          grant &&
          !grant.provider_revoked_at &&
          (grant.disconnected_at || grant.google_subject !== tokens.value.subject)
        )
          return fail(domainError('MEET_OAUTH_DISCONNECT_REQUIRED', 409));
        const other = await tx.teacherMeetOAuthGrant.findFirst({
          where: {
            teacher_id: { not: ctx.teacherId },
            google_subject: tokens.value.subject,
            refresh_ciphertext: { not: null },
          },
          select: { teacher_id: true },
        });
        if (other) return fail(domainError('MEET_OAUTH_IDENTITY_IN_USE', 409));
        const generation = challenge.grant_generation + 1;
        const values = {
          google_subject: tokens.value.subject,
          generation,
          refresh_ciphertext: runtime.secrets.seal(tokens.value.refreshToken, {
            purpose: 'refresh',
            teacherId: ctx.teacherId,
            googleSubject: tokens.value.subject,
            generation,
          }),
          authorized_at: now,
          disconnected_at: null,
          provider_revoked_at: null,
          revocation_claim_id: null,
          revocation_claimed_at: null,
        };
        await tx.teacherMeetOAuthGrant.upsert({
          where: { teacher_id: ctx.teacherId },
          create: { teacher_id: ctx.teacherId, ...values },
          update: values,
        });
        await tx.teacherMeetOAuthChallenge.delete({ where: { teacher_id: ctx.teacherId } });
        await this.record(tx, ctx, 'teacher.meet-oauth.connected');
        return { state: 'CONNECTED', available: true };
      }),
    );
  }

  async disconnect(ctx: TeacherContext): Promise<Projection> {
    const runtime = this.runtime();
    const available = this.available() && runtime !== null;
    const claim = randomUUID();
    const grant = unwrap(
      await this.transactions.runCritical(async (tx) => {
        const now = await requireVerifiedMeetTeacher(tx, ctx, true);
        await tx.teacherMeetOAuthChallenge.deleteMany({ where: { teacher_id: ctx.teacherId } });
        const row = await tx.teacherMeetOAuthGrant.findUnique({
          where: { teacher_id: ctx.teacherId },
        });
        if (!row?.refresh_ciphertext) return row;
        const claimed =
          runtime &&
          (!row.revocation_claimed_at || +now - +row.revocation_claimed_at >= REVOCATION_CLAIM_MS);
        if (!claimed && row.disconnected_at) return row;
        const update = await tx.teacherMeetOAuthGrant.update({
          where: { teacher_id: ctx.teacherId },
          data: {
            disconnected_at: row.disconnected_at ?? now,
            ...(claimed ? { revocation_claim_id: claim, revocation_claimed_at: now } : {}),
          },
        });
        if (!row.disconnected_at) await this.record(tx, ctx, 'teacher.meet-oauth.disconnected');
        return update;
      }),
    );
    if (!grant?.refresh_ciphertext) return { state: 'DISCONNECTED', available };
    if (!runtime || grant.revocation_claim_id !== claim)
      return { state: 'REVOCATION_PENDING', available };
    const token = runtime.secrets.open(grant.refresh_ciphertext, {
      purpose: 'refresh',
      teacherId: ctx.teacherId,
      googleSubject: grant.google_subject,
      generation: grant.generation,
    });
    if (!token.ok) return { state: 'REVOCATION_PENDING', available };
    const revoked = await runtime.oauth.revoke(token.value);
    if (!revoked.ok && revoked.error.code !== 'OAUTH_AUTHORIZATION_REQUIRED')
      return { state: 'REVOCATION_PENDING', available };
    return unwrap(
      await this.transactions.runCritical(async (tx) => {
        const [{ now }] = await tx.$queryRaw<[{ now: Date }]>`SELECT clock_timestamp() AS now`;
        const updated = await tx.teacherMeetOAuthGrant.updateMany({
          where: {
            teacher_id: ctx.teacherId,
            generation: grant.generation,
            disconnected_at: { not: null },
            provider_revoked_at: null,
            revocation_claim_id: claim,
          },
          data: {
            provider_revoked_at: now,
            refresh_ciphertext: null,
            revocation_claim_id: null,
            revocation_claimed_at: null,
          },
        });
        if (updated.count) await this.record(tx, ctx, 'teacher.meet-oauth.provider-revoked');
        return { state: updated.count ? 'DISCONNECTED' : 'REVOCATION_PENDING', available };
      }),
    );
  }
}
