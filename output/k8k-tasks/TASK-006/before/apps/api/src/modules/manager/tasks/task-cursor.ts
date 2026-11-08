import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { err, ok } from '@online-school/shared';
import type { Result } from '@online-school/shared';
import { domainError } from '../../../core/errors/domain-error.js';
import type { DomainError } from '../../../core/errors/domain-error.js';
import { UUID } from '../../../core/http.js';
import type { ManagerContext } from '../context/manager-context.js';
import type { TaskQuery } from './contracts.js';
const key = () => {
  const s = process.env.MANAGER_CURSOR_SECRET ?? process.env.CSRF_SIGNING_SECRET;
  return s && Buffer.byteLength(s) >= 32 ? createHash('sha256').update(s).digest() : undefined;
};
const fingerprint = (ctx: ManagerContext, q: TaskQuery) =>
  createHash('sha256')
    .update(
      JSON.stringify([
        ctx.managerId,
        [...(q.status ?? [])].sort(),
        [...(q.type ?? [])].sort(),
        q.overdue ?? null,
        q.studentId ?? null,
        q.dueBefore ?? null,
        q.limit,
      ]),
    )
    .digest('hex')
    .slice(0, 16);
export type TaskCursor = { id?: string; dueAt?: Date; now: Date };
export function readTaskCursor(
  ctx: ManagerContext,
  q: TaskQuery,
  now: Date,
): Result<TaskCursor, DomainError> {
  if (!q.cursor) return ok({ now });
  const secret = key();
  if (!secret) return err(domainError('CURSOR_CONFIGURATION_MISSING', 503));
  try {
    if (!/^[A-Za-z0-9_-]{40,200}$/.test(q.cursor)) return err(domainError('INVALID_CURSOR', 422));
    const raw = Buffer.from(q.cursor, 'base64url'),
      cipher = createDecipheriv('aes-256-gcm', secret, raw.subarray(0, 12));
    cipher.setAuthTag(raw.subarray(12, 28));
    const p: unknown = JSON.parse(
      Buffer.concat([cipher.update(raw.subarray(28)), cipher.final()]).toString('utf8'),
    );
    if (
      !Array.isArray(p) ||
      p.length !== 4 ||
      typeof p[0] !== 'string' ||
      !UUID.test(p[0]) ||
      !Number.isSafeInteger(p[1]) ||
      !Number.isSafeInteger(p[2]) ||
      p[2] > +now + 5000 ||
      +now - p[2] > 1800000 ||
      p[3] !== fingerprint(ctx, q) ||
      !Number.isFinite(+new Date(p[1]))
    )
      return err(domainError('INVALID_CURSOR', 422));
    return ok({ id: p[0], dueAt: new Date(p[1]), now: new Date(p[2]) });
  } catch {
    return err(domainError('INVALID_CURSOR', 422));
  }
}
export function writeTaskCursor(
  ctx: ManagerContext,
  q: TaskQuery,
  c: TaskCursor,
  id: string,
  dueAt: Date,
): Result<string, DomainError> {
  const secret = key();
  if (!secret) return err(domainError('CURSOR_CONFIGURATION_MISSING', 503));
  const iv = randomBytes(12),
    cipher = createCipheriv('aes-256-gcm', secret, iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify([id, +dueAt, +c.now, fingerprint(ctx, q)])),
    cipher.final(),
  ]);
  return ok(Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url'));
}
