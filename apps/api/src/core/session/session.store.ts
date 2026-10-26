import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { Prisma, PrismaClient, RoleCode } from '@online-school/db';
import { err, ok } from '@online-school/shared';
import type { Result } from '@online-school/shared';
import { DatabaseService } from '../database/database.module.js';
import { domainError } from '../errors/domain-error.js';
import type { DomainError } from '../errors/domain-error.js';
import type { AccountContext, HttpResponse } from '../http.js';

export const SESSION_COOKIE = '__Host-school_session';
export const CSRF_COOKIE = '__Host-school_csrf';
export const LOGIN_COOKIE = '__Host-school_webauthn_login';
export const tokenHash = (value: string): string =>
  createHash('sha256').update(value).digest('hex');
export const randomToken = (): string => randomBytes(32).toString('base64url');
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
export const SESSION_IDLE_MS = 30 * 60 * 1000;
type Connection = Prisma.TransactionClient | PrismaClient;
export type IssuedSession = {
  token: string;
  csrfToken: string;
  expiresAt: Date;
  sessionId: string;
};
const roleOrder: RoleCode[] = ['DIRECTOR', 'MANAGER', 'TEACHER', 'STUDENT', 'TECH_OPERATOR'];

@Injectable()
export class SessionStore {
  constructor(private readonly db: DatabaseService) {}
  async resolve(
    token: string | undefined,
    connection?: Connection,
  ): Promise<Result<AccountContext, DomainError>> {
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token))
      return err(domainError('UNAUTHENTICATED', 401));
    try {
      const tx = connection ?? this.db.client;
      const clock = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`;
      const now = clock[0]?.now ?? new Date();
      const session = await tx.session.findUnique({
        where: { token_hash: tokenHash(token) },
        include: {
          account: {
            select: {
              id: true,
              kind: true,
              disabled_at: true,
              recovery_registration_required: true,
            },
          },
        },
      });
      if (
        !session ||
        session.revoked_at ||
        session.expires_at <= now ||
        now.getTime() - (session.last_seen_at ?? session.created_at).getTime() > SESSION_IDLE_MS
      )
        return err(domainError('UNAUTHENTICATED', 401));
      const account = session.account;
      if (account.recovery_registration_required && !session.recovery_only)
        return err(domainError('UNAUTHENTICATED', 401));
      // Load the one relevant profile sequentially; no parallel queries on a transaction connection.
      const profile =
        account.kind === 'STAFF'
          ? await tx.staffAccount.findFirst({
              where: { account_id: account.id },
              select: { deactivated_at: true },
            })
          : account.kind === 'TEACHER'
            ? await tx.teacherAccount.findFirst({
                where: { account_id: account.id },
                select: { deactivated_at: true },
              })
            : await tx.studentAccount.findFirst({
                where: { account_id: account.id },
                select: { deactivated_at: true },
              });
      if (account.disabled_at || !profile || profile.deactivated_at)
        return err(domainError('UNAUTHENTICATED', 401));
      const revocation = await tx.accessRevocation.findFirst({
        where: {
          account_id: account.id,
          OR: [
            { session_id: session.id },
            { session_id: null, revoked_at: { gte: session.created_at } },
          ],
        },
      });
      if (revocation) return err(domainError('UNAUTHENTICATED', 401));
      const assignments = await tx.$queryRaw<{ code: RoleCode }[]>`
        SELECT r.code FROM role_assignments a JOIN roles r ON r.id=a.role_id
        WHERE a.account_id=${account.id}::uuid AND a.valid_from<=${now}
          AND (a.valid_to IS NULL OR a.valid_to>${now})
      `;
      const active = new Set(assignments.map((r) => r.code));
      const roles = roleOrder.filter((role) => active.has(role));
      const role = roles[0];
      if (!role) return err(domainError('FORBIDDEN', 403));
      const updated = await tx.session.updateMany({
        where: { id: session.id, revoked_at: null, expires_at: { gt: now } },
        data: { last_seen_at: now },
      });
      if (updated.count !== 1) return err(domainError('UNAUTHENTICATED', 401));
      return ok({
        accountId: account.id,
        sessionId: session.id,
        kind: account.kind,
        roles,
        role,
        mfaCompleted: session.mfa_verified_at !== null,
        lastActiveAt: now,
        expiresAt: session.expires_at,
        recoveryOnly: session.recovery_only,
      });
    } catch (error: unknown) {
      if (connection) return Promise.reject(error);
      return err(domainError('SESSION_STORE_UNAVAILABLE', 503));
    }
  }
  // Only a verified identity command may call this trusted API. No client-supplied account/MFA flag.
  async issue(
    tx: Prisma.TransactionClient,
    accountId: string,
    mfaVerifiedAt: Date | null = null,
    recoveryOnly = false,
  ): Promise<IssuedSession> {
    const token = randomToken();
    const csrfToken = randomToken();
    const clock = await tx.$queryRaw<{ now: Date }[]>`
      SELECT greatest(clock_timestamp(),coalesce((SELECT max(revoked_at)+interval '1 millisecond' FROM access_revocations WHERE account_id=${accountId}::uuid AND session_id IS NULL),'epoch'::timestamptz)) AS now
    `;
    const now = clock[0]?.now ?? new Date();
    const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
    const session = await tx.session.create({
      data: {
        account_id: accountId,
        token_hash: tokenHash(token),
        csrf_token_hash: tokenHash(csrfToken),
        expires_at: expiresAt,
        last_seen_at: now,
        mfa_verified_at: mfaVerifiedAt ? now : null,
        recovery_only: recoveryOnly,
        created_at: now,
        updated_at: now,
      },
    });
    return { token, csrfToken, expiresAt, sessionId: session.id };
  }
  cookies(res: HttpResponse, issued: IssuedSession): void {
    res.setHeader('Set-Cookie', [
      `${SESSION_COOKIE}=${issued.token}; Path=/; HttpOnly; Secure; SameSite=Strict; Expires=${issued.expiresAt.toUTCString()}`,
      `${CSRF_COOKIE}=${issued.csrfToken}; Path=/; Secure; SameSite=Strict; Expires=${issued.expiresAt.toUTCString()}`,
    ]);
  }
  clearCookies(res: HttpResponse): void {
    res.setHeader('Set-Cookie', [
      `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
      `${CSRF_COOKIE}=; Path=/; Secure; SameSite=Strict; Max-Age=0`,
      `${LOGIN_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
    ]);
  }
}
