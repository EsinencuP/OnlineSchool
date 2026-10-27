import { createHash, randomUUID } from 'node:crypto';
import { createParamDecorator, Injectable, Module, SetMetadata } from '@nestjs/common';
import type { CanActivate, CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import type { Prisma } from '@online-school/db';
import type { Result } from '@online-school/shared';
import { from, lastValueFrom } from 'rxjs';
import type { Observable } from 'rxjs';
import { AuditModule, AuditService } from '../audit/audit.service.js';
import { DatabaseService } from '../database/database.module.js';
import { domainError, fail, unwrap } from '../errors/domain-error.js';
import type { DomainError } from '../errors/domain-error.js';
import { cookie, header, isMutation, UUID } from '../http.js';
import type { HttpRequest, HttpResponse } from '../http.js';
import { SessionModule } from '../session/session.service.js';
import { SESSION_COOKIE, SessionStore } from '../session/session.store.js';
import { AccessService, RbacModule } from '../rbac/rbac.guard.js';
import { ACCESS } from '../rbac/decorators.js';
import { TransactionModule, TransactionService } from '../transaction/transaction.service.js';

export type CommandMetadata = {
  type: string;
  resourceType: string;
  topic: string;
  successStatus?: 200 | 201;
  resultIdField?: string;
};
const COMMAND = 'core.criticalCommand';
export const CriticalCommand = (metadata: CommandMetadata) => SetMetadata(COMMAND, metadata);
export const CurrentTransaction = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<HttpRequest>().critical,
);
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, item]) => [key, canonical(item)]),
    );
  return value;
}
export function payloadHash(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex');
}
function asJson(value: unknown): Prisma.InputJsonValue {
  try {
    const encoded = JSON.stringify(value);
    if (encoded === undefined) return fail(domainError('INVALID_COMMAND_RESULT', 500));
    // A wrapper always provides a non-null JSON value, including a null response body.
    return JSON.parse(encoded) as Prisma.InputJsonValue;
  } catch {
    return fail(domainError('INVALID_COMMAND_RESULT', 500));
  }
}
@Injectable()
export class IdempotencyGuard implements CanActivate {
  constructor(
    private readonly access: AccessService,
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const command = this.access.metadata<CommandMetadata>(COMMAND, context);
    if (!command) return true;
    const req = context.switchToHttp().getRequest<HttpRequest>();
    let error: DomainError | undefined;
    const key = header(req, 'idempotency-key');
    if (
      !isMutation(req.method) ||
      this.access.metadata<boolean>(ACCESS.public, context) ||
      !req.account ||
      ![command.type, command.resourceType, command.topic].every((value) =>
        /^[a-zA-Z][a-zA-Z0-9_.:-]{0,119}$/.test(value),
      )
    )
      error = domainError('COMMAND_CONFIGURATION_ERROR', 403);
    else if (!key || !UUID.test(key)) error = domainError('IDEMPOTENCY_KEY_REQUIRED', 400);
    if (!error && req.account && key) {
      req.idempotencyKey = key.toLowerCase();
      req.requestHash = payloadHash({
        method: req.method,
        path: req.originalUrl.split('?')[0],
        params: req.params,
        query: req.query,
        body: req.body ?? null,
      });
      const existing = await this.db.client.idempotencyRecord.findUnique({
        where: {
          scope_command_type_key: {
            scope: req.account.accountId,
            command_type: command.type,
            key: req.idempotencyKey,
          },
        },
      });
      if (existing && existing.expires_at > new Date() && existing.request_hash !== req.requestHash)
        error = domainError('IDEMPOTENCY_PAYLOAD_MISMATCH', 422);
    }
    if (!error) return true;
    unwrap(
      await this.audit.denial({
        requestId: req.requestId!,
        action: 'idempotency.denied',
        code: error.code,
        ...(req.account ? { actor: req.account } : {}),
      }),
    );
    return fail(error);
  }
}
@Injectable()
export class IdempotencyService {
  constructor(
    private readonly transactions: TransactionService,
    private readonly audit: AuditService,
  ) {}
  async execute(
    input: {
      scope: string;
      key: string;
      hash: string;
      command: CommandMetadata;
      requestId: string;
    },
    authorize: (tx: Prisma.TransactionClient) => Promise<string>,
    handler: (tx: Prisma.TransactionClient) => Promise<unknown>,
  ): Promise<Result<unknown, DomainError>> {
    return this.transactions.runCritical(async (tx) => {
      const actorId = await authorize(tx);
      const lock = `${input.scope}:${input.command.type}:${input.key}`;
      await tx.$queryRaw`SELECT true AS locked FROM pg_advisory_xact_lock(hashtextextended(${lock},0))`;
      const identity = { scope: input.scope, command_type: input.command.type, key: input.key };
      let record = await tx.idempotencyRecord.findUnique({
        where: { scope_command_type_key: identity },
      });
      const clock = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`;
      const now = clock[0]?.now ?? new Date();
      if (record && record.expires_at <= now) {
        await tx.idempotencyRecord.delete({ where: { id: record.id } });
        record = null;
      }
      if (record) {
        if (record.request_hash !== input.hash)
          return fail(domainError('IDEMPOTENCY_PAYLOAD_MISMATCH', 422));
        if (record.status !== 'COMPLETED' || !record.result)
          return fail(domainError('COMMAND_IN_PROGRESS', 409));
        const cached = record.result as { body?: unknown };
        if (record.result_hash !== payloadHash(record.result))
          return fail(domainError('CACHED_RESULT_INVALID', 503));
        return cached.body;
      }
      const recordId = randomUUID();
      await tx.idempotencyRecord.create({
        data: {
          id: recordId,
          ...identity,
          request_hash: input.hash,
          expires_at: new Date(now.getTime() + 48 * 60 * 60 * 1000),
          created_at: now,
          updated_at: now,
        },
      });
      const result = asJson({ body: await handler(tx) });
      const response = result as { body?: unknown };
      const body = response.body;
      const resultIdField = input.command.resultIdField ?? 'id';
      const resourceId =
        body &&
        typeof body === 'object' &&
        resultIdField in body &&
        typeof (body as Record<string, unknown>)[resultIdField] === 'string' &&
        UUID.test((body as Record<string, string>)[resultIdField]!)
          ? (body as Record<string, string>)[resultIdField]!
          : actorId;
      const auditId = randomUUID();
      await this.audit.record(
        {
          id: auditId,
          actor_kind: 'ACCOUNT',
          actor_id: actorId,
          action: input.command.type,
          resource_type: input.command.resourceType,
          resource_id: resourceId,
          result: 'SUCCESS',
          request_id: input.requestId,
          source_operation_id: input.key,
          event_key: `command:${recordId}`,
        },
        tx,
      );
      await tx.outboxEvent.create({
        data: {
          topic: input.command.topic,
          aggregate_type: input.command.resourceType,
          aggregate_id: resourceId,
          source_operation_id: input.key,
          audit_event_id: auditId,
          event_key: `command:${recordId}`,
          payload: { schemaVersion: 1, resourceId },
        },
      });
      const completedAt = (await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`)[0]!
        .now;
      await tx.idempotencyRecord.update({
        where: { id: recordId },
        data: {
          status: 'COMPLETED',
          result,
          result_hash: payloadHash(result),
          completed_at: completedAt,
        },
      });
      return body;
    });
  }
}
@Injectable()
export class CriticalCommandInterceptor implements NestInterceptor {
  constructor(
    private readonly service: IdempotencyService,
    private readonly access: AccessService,
    private readonly sessions: SessionStore,
    private readonly audit: AuditService,
  ) {}
  intercept(context: ExecutionContext, next: CallHandler<unknown>): Observable<unknown> {
    const command = this.access.metadata<CommandMetadata>(COMMAND, context);
    if (!command) return next.handle();
    return from(this.run(context, next, command));
  }
  private async run(
    context: ExecutionContext,
    next: CallHandler<unknown>,
    command: CommandMetadata,
  ): Promise<unknown> {
    const req = context.switchToHttp().getRequest<HttpRequest>();
    const res = context.switchToHttp().getResponse<HttpResponse>();
    if (!req.account || !req.idempotencyKey || !req.requestHash)
      return fail(domainError('COMMAND_CONTEXT_MISSING', 500));
    const scope = req.account.accountId;
    const result = await this.service.execute(
      { scope, key: req.idempotencyKey, hash: req.requestHash, command, requestId: req.requestId! },
      async (tx) => {
        const actor = unwrap(await this.sessions.resolve(cookie(req, SESSION_COOKIE), tx));
        if (actor.accountId !== scope) return fail(domainError('UNAUTHENTICATED', 401));
        unwrap(await this.access.authorize(context, actor, tx));
        req.account = actor;
        return actor.accountId;
      },
      async (tx) => {
        req.critical = {
          tx,
          actor: req.account!,
          operationId: req.idempotencyKey!,
          requestId: req.requestId!,
        };
        try {
          return await lastValueFrom(next.handle());
        } finally {
          delete req.critical;
        }
      },
    );
    if (!result.ok) {
      if ([401, 403, 422].includes(result.error.status))
        unwrap(
          await this.audit.denial({
            requestId: req.requestId!,
            actor: req.account,
            action: 'command.denied',
            code: result.error.code,
          }),
        );
      return fail(result.error);
    }
    res.status(command.successStatus ?? 200);
    return req.afterCriticalCommit ? req.afterCriticalCommit(result.value) : result.value;
  }
}
@Module({
  imports: [AuditModule, TransactionModule, SessionModule, RbacModule],
  providers: [IdempotencyGuard, IdempotencyService, CriticalCommandInterceptor],
  exports: [IdempotencyGuard, IdempotencyService, CriticalCommandInterceptor],
})
export class IdempotencyModule {}
