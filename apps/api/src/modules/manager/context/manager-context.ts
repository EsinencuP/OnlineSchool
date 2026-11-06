import type { AccountContext, HttpRequest } from '../../../core/http.js';

// SessionPrincipal is the existing opaque-session principal plus server request metadata.
export type SessionPrincipal = AccountContext & { readonly requestId: string };
export interface ManagerContext {
  readonly accountId: string;
  readonly managerId: string;
  readonly sessionId: string;
  readonly requestId: string;
}
export const MANAGER_CAPABILITIES = [
  'LEADS_MANAGE',
  'STUDENTS_VIEW',
  'ACCOUNTS_CREATE',
  'PAYMENTS_CONFIRM',
  'PAYMENTS_REQUEST_APPROVAL',
  'SUBSCRIPTIONS_MANAGE',
  'SCHEDULE_MANAGE',
  'TASKS_PROCESS',
  'NOTIFICATIONS_SEND',
] as const;
export type ManagerCapability = (typeof MANAGER_CAPABILITIES)[number];
export interface ManagerRequest extends HttpRequest {
  managerCtx?: ManagerContext;
}
