import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { err, ok } from '@online-school/shared';
import type { Result } from '@online-school/shared';
import { domainError } from '../../../core/errors/domain-error.js';
import type { DomainError } from '../../../core/errors/domain-error.js';
import { UUID } from '../../../core/http.js';
import type { ManagerContext } from '../context/manager-context.js';
import type { ListStudentsQueryDto } from '../dto/student-crm.dto.js';

function key(): Buffer | undefined {
  const secret = process.env.MANAGER_CURSOR_SECRET ?? process.env.CSRF_SIGNING_SECRET;
  return secret && Buffer.byteLength(secret) >= 32
    ? createHash('sha256').update(secret).digest()
    : undefined;
}
function fingerprint(ctx: ManagerContext, q: ListStudentsQueryDto): string {
  return createHash('sha256')
    .update(
      JSON.stringify([
        ctx.managerId,
        q.search ?? null,
        q.status ?? null,
        q.hasOverdueTask ?? null,
        q.subscriptionExpiringSoon ?? null,
        q.sort ?? 'name',
      ]),
    )
    .digest('hex')
    .slice(0, 16);
}
export type StudentCursor = { studentId?: string; now: Date };
export function readCursor(
  ctx: ManagerContext,
  q: ListStudentsQueryDto,
): Result<StudentCursor, DomainError> {
  if (!q.cursor) return ok({ now: new Date() });
  const secret = key();
  if (!secret) return err(domainError('CURSOR_CONFIGURATION_MISSING', 503));
  try {
    if (!/^[A-Za-z0-9_-]{40,200}$/.test(q.cursor)) return err(domainError('INVALID_CURSOR', 422));
    const data = Buffer.from(q.cursor, 'base64url');
    const cipher = createDecipheriv('aes-256-gcm', secret, data.subarray(0, 12));
    cipher.setAuthTag(data.subarray(12, 28));
    const parsed: unknown = JSON.parse(
      Buffer.concat([cipher.update(data.subarray(28)), cipher.final()]).toString('utf8'),
    );
    if (
      !Array.isArray(parsed) ||
      parsed.length !== 3 ||
      typeof parsed[0] !== 'string' ||
      !UUID.test(parsed[0]) ||
      typeof parsed[1] !== 'number' ||
      !Number.isSafeInteger(parsed[1]) ||
      parsed[1] > Date.now() + 5000 ||
      Date.now() - parsed[1] > 30 * 60 * 1000 ||
      parsed[2] !== fingerprint(ctx, q)
    )
      return err(domainError('INVALID_CURSOR', 422));
    return ok({ studentId: parsed[0], now: new Date(parsed[1]) });
  } catch {
    return err(domainError('INVALID_CURSOR', 422));
  }
}
export function writeCursor(
  ctx: ManagerContext,
  q: ListStudentsQueryDto,
  studentId: string,
  now: Date,
): Result<string, DomainError> {
  const secret = key();
  if (!secret) return err(domainError('CURSOR_CONFIGURATION_MISSING', 503));
  const iv = randomBytes(12),
    cipher = createCipheriv('aes-256-gcm', secret, iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify([studentId, now.getTime(), fingerprint(ctx, q)])),
    cipher.final(),
  ]);
  return ok(Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url'));
}
