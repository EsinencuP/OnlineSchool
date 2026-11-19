import type { AccountContext } from '../http.js';
import { UUID } from '../http.js';

export type PasswordOnlyActor = Pick<
  AccountContext,
  'accountId' | 'kind' | 'roles' | 'recoveryOnly'
>;

/** Only explicitly enrolled account IDs can use a password-only exception. */
export function listedPasswordOnlyAccount(accountId: string, list: string | undefined): boolean {
  return (
    UUID.test(accountId) &&
    (list?.split(',').some((id) => id.trim().toLowerCase() === accountId.toLowerCase()) ?? false)
  );
}

/** Owner-approved temporary QA login mode; never records a verified second factor. */
export function qaPasswordOnlyLogin(actor: PasswordOnlyActor): boolean {
  if (
    process.env.QA_PASSWORD_ONLY_LOGIN !== 'true' ||
    actor.recoveryOnly ||
    actor.roles.length !== 1 ||
    !listedPasswordOnlyAccount(actor.accountId, process.env.QA_PASSWORD_ONLY_ACCOUNT_IDS)
  )
    return false;
  const role = actor.roles[0];
  return actor.kind === 'STAFF'
    ? role === 'DIRECTOR' || role === 'MANAGER' || role === 'TECH_OPERATOR'
    : actor.kind === 'TEACHER'
      ? role === 'TEACHER'
      : actor.kind === 'STUDENT' && role === 'STUDENT';
}
