import type { PasswordOnlyActor } from './qa-password-policy.js';
import { listedPasswordOnlyAccount, qaPasswordOnlyLogin } from './qa-password-policy.js';

/** Temporary owner-approved manager access. Never represents a verified MFA factor. */
export function managerPasswordOnlyLogin(actor: PasswordOnlyActor): boolean {
  return (
    actor.kind === 'STAFF' &&
    actor.roles.length === 1 &&
    actor.roles[0] === 'MANAGER' &&
    !actor.recoveryOnly &&
    (qaPasswordOnlyLogin(actor) ||
      (process.env.MANAGER_PASSWORD_ONLY_LOGIN === 'true' &&
        listedPasswordOnlyAccount(actor.accountId, process.env.MANAGER_PASSWORD_ONLY_ACCOUNT_IDS)))
  );
}
