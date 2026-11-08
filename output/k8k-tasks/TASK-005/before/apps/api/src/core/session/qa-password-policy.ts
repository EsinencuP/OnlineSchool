import type { AccountContext } from '../http.js';

/** Owner-approved temporary QA login mode; never records a verified second factor. */
export function qaPasswordOnlyLogin(
  actor: Pick<AccountContext, 'kind' | 'roles' | 'recoveryOnly'>,
): boolean {
  if (
    process.env.QA_PASSWORD_ONLY_LOGIN !== 'true' ||
    actor.recoveryOnly ||
    actor.roles.length !== 1
  )
    return false;
  const role = actor.roles[0];
  return actor.kind === 'STAFF'
    ? role === 'DIRECTOR' || role === 'MANAGER' || role === 'TECH_OPERATOR'
    : actor.kind === 'TEACHER'
      ? role === 'TEACHER'
      : actor.kind === 'STUDENT' && role === 'STUDENT';
}
