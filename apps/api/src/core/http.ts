import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Prisma, RoleCode } from '@online-school/db';
import type { Result } from '@online-school/shared';
import type { DomainError } from './errors/domain-error.js';

export interface AccountContext {
  accountId: string;
  sessionId: string;
  roles: RoleCode[];
  role: RoleCode;
  kind: 'STAFF' | 'TEACHER' | 'STUDENT';
  mfaCompleted: boolean;
  lastActiveAt: Date;
  expiresAt: Date;
  recoveryOnly?: boolean;
}
export interface CriticalContext {
  tx: Prisma.TransactionClient;
  actor: AccountContext;
  operationId: string;
  requestId: string;
}
export interface HttpRequest extends IncomingMessage {
  csrfValidated?: boolean;
  body?: unknown;
  params: Record<string, string | undefined>;
  query: unknown;
  originalUrl: string;
  requestId?: string;
  account?: AccountContext;
  critical?: CriticalContext;
  idempotencyKey?: string;
  requestHash?: string;
  resourceAuthorizer?: (
    tx: Prisma.TransactionClient,
    actor: AccountContext,
  ) => Promise<Result<void, DomainError>>;
}
export interface HttpResponse extends ServerResponse {
  status(code: number): this;
  json(body: unknown): this;
}
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function header(req: HttpRequest, key: string): string | undefined {
  const value = req.headers[key];
  return typeof value === 'string' ? value : undefined;
}
export function cookie(req: HttpRequest, name: string): string | undefined {
  const values = (header(req, 'cookie') ?? '')
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${name}=`));
  return values.length === 1 ? values[0]?.slice(name.length + 1) : undefined;
}
export const isMutation = (method: string | undefined): boolean =>
  ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method ?? '');
