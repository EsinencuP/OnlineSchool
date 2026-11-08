import type { AccountContext } from '../http.js';
import { qaPasswordOnlyLogin } from './qa-password-policy.js';

/** Temporary owner-approved manager access. Never represents a verified MFA factor. */
export function managerPasswordOnlyLogin(
  actor: Pick<AccountContext, 'kind' | 'roles' | 'recoveryOnly'>,
): boolean {
  return (
    (process.env.MANAGER_PASSWORD_ONLY_LOGIN === 'true' || qaPasswordOnlyLogin(actor)) &&
    actor.kind === 'STAFF' &&
    actor.roles.length === 1 &&
    actor.roles[0] === 'MANAGER' &&
    !actor.recoveryOnly
  );
}
