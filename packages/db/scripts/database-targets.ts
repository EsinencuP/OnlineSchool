import { err, ok } from '@online-school/shared';
import type { Result } from '@online-school/shared';

export type DatabaseToolError = { code: string };
export type DatabaseTarget = { url: string; database: string; local: boolean };

export function databaseTarget(
  value: string | undefined,
): Result<DatabaseTarget, DatabaseToolError> {
  if (!value) return err({ code: 'DATABASE_TARGET_MISSING' });
  try {
    const parsed = new URL(value);
    const database = decodeURIComponent(parsed.pathname.slice(1));
    if (
      !['postgres:', 'postgresql:'].includes(parsed.protocol) ||
      !parsed.hostname ||
      !database ||
      (parsed.searchParams.has('schema') && parsed.searchParams.get('schema') !== 'public')
    ) {
      return err({ code: 'DATABASE_TARGET_INVALID' });
    }
    return ok({
      url: value,
      database,
      local: ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname),
    });
  } catch {
    return err({ code: 'DATABASE_TARGET_INVALID' });
  }
}

export function qaTarget(
  environment: NodeJS.ProcessEnv = process.env,
  destructive = false,
): Result<DatabaseTarget, DatabaseToolError> {
  if (environment.APP_ENV === 'production')
    return err({ code: 'QA_OPERATION_IN_PRODUCTION_FORBIDDEN' });
  const target = databaseTarget(environment.QA_DATABASE_URL ?? environment.DIRECT_URL);
  if (!target.ok) return target;
  const namedLocalQA =
    target.value.local && /^online_school_(qa|test_qa)[a-z0-9_]*$/.test(target.value.database);
  if (namedLocalQA) return target;
  // Remote fixture seeding requires an explicitly configured QA environment.
  // Reset is deliberately restricted to a named local QA database.
  if (
    !destructive &&
    !target.value.local &&
    environment.APP_ENV === 'qa' &&
    environment.QA_DATABASE_URL
  )
    return target;
  return err({
    code: destructive ? 'RESET_REQUIRES_NAMED_LOCAL_QA_DATABASE' : 'QA_DATABASE_REQUIRED',
  });
}
