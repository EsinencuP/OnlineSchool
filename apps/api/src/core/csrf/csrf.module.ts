import * as ApiDto from '../../openapi/dtos.js';
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Controller, Get, Injectable, Module, Req, Res } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { DatabaseService } from '../database/database.module.js';
import { AuditModule, AuditService } from '../audit/audit.service.js';
import { domainError, fail, unwrap } from '../errors/domain-error.js';
import { cookie, header, isMutation } from '../http.js';
import type { HttpRequest, HttpResponse } from '../http.js';
import { CSRF_COOKIE, randomToken, tokenHash } from '../session/session.store.js';
import { Public } from '../rbac/decorators.js';

const ANONYMOUS_TTL_MS = 15 * 60 * 1000;
export function constantEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
@Injectable()
export class CsrfService {
  constructor(private readonly db: DatabaseService) {}
  private sign(value: string): string {
    const secret = process.env.CSRF_SIGNING_SECRET;
    if (!secret || Buffer.byteLength(secret) < 32)
      return fail(domainError('CSRF_CONFIGURATION_MISSING', 503));
    return createHmac('sha256', secret)
      .update(`online-school:csrf:v1:${value}`)
      .digest('base64url');
  }
  async issue(req: HttpRequest, res: HttpResponse): Promise<{ csrfToken: string }> {
    let token: string;
    if (req.account) {
      const session = await this.db.client.session.findUniqueOrThrow({
        where: { id: req.account.sessionId },
      });
      const previous = cookie(req, CSRF_COOKIE);
      token =
        previous &&
        /^[A-Za-z0-9_-]{43}$/.test(previous) &&
        constantEqual(tokenHash(previous), session.csrf_token_hash ?? '')
          ? previous
          : randomToken();
      if (token !== previous)
        await this.db.client.session.update({
          where: { id: session.id },
          data: { csrf_token_hash: tokenHash(token) },
        });
    } else {
      const value = `${randomToken()}.${Date.now()}`;
      token = `${value}.${this.sign(value)}`;
    }
    res.setHeader(
      'Set-Cookie',
      `${CSRF_COOKIE}=${token}; Path=/; Secure; SameSite=Strict; Max-Age=${req.account ? Math.max(0, Math.floor((+req.account.expiresAt - Date.now()) / 1000)) : 900}`,
    );
    return { csrfToken: token };
  }
  async valid(req: HttpRequest): Promise<boolean> {
    const token = header(req, 'x-csrf-token');
    const stored = cookie(req, CSRF_COOKIE);
    if (!token || !stored || token.length > 256 || !constantEqual(token, stored)) return false;
    if (req.account) {
      if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return false;
      const session = await this.db.client.session.findUnique({
        where: { id: req.account.sessionId },
        select: { csrf_token_hash: true, revoked_at: true },
      });
      return (
        !!session &&
        !session.revoked_at &&
        constantEqual(tokenHash(token), session.csrf_token_hash ?? '')
      );
    }
    const parts = token.split('.');
    const [nonce, timestamp, signature] = parts;
    if (
      parts.length !== 3 ||
      !nonce ||
      !/^[A-Za-z0-9_-]{43}$/.test(nonce) ||
      !timestamp ||
      !/^\d{13}$/.test(timestamp) ||
      !signature
    )
      return false;
    const age = Date.now() - Number(timestamp);
    return (
      age >= -30000 &&
      age < ANONYMOUS_TTL_MS &&
      constantEqual(signature, this.sign(`${nonce}.${timestamp}`))
    );
  }
}
@Controller('api/v1/auth')
export class CsrfController {
  constructor(private readonly csrf: CsrfService) {}
  @ApiOperation({
    operationId: 'getCsrfToken',
    summary: 'Get csrf token',
    description:
      'Signed anonymous or session-bound double-submit token; also sets a Secure SameSite=Strict cookie.',
  })
  @ApiResponse({
    status: 200,
    type: ApiDto.CsrfResponse,
    description: 'Successful response',
    headers: { 'X-Request-ID': { schema: { type: 'string', format: 'uuid' } } },
  })
  @ApiResponse({ status: 400, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 401, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 403, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 409, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 422, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 503, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    schema: { type: 'string', format: 'uuid' },
    description: 'Required for critical business commands; reuse only for identical payload',
  })
  @ApiHeader({ name: 'X-Request-ID', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiTags('Identity')
  @Get('csrf')
  @Public()
  issue(
    @Req() req: HttpRequest,
    @Res({ passthrough: true }) res: HttpResponse,
  ): Promise<{ csrfToken: string }> {
    return this.csrf.issue(req, res);
  }
}
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(
    private readonly csrf: CsrfService,
    private readonly audit: AuditService,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<HttpRequest>();
    if (!isMutation(req.method) || (await this.csrf.valid(req))) return true;
    unwrap(
      await this.audit.denial({
        requestId: req.requestId!,
        action: 'csrf.denied',
        code: 'CSRF_INVALID',
        ...(req.account ? { actor: req.account } : {}),
      }),
    );
    return fail(domainError('CSRF_INVALID', 403));
  }
}
@Module({
  imports: [AuditModule],
  controllers: [CsrfController],
  providers: [CsrfService, CsrfGuard],
  exports: [CsrfService, CsrfGuard],
})
export class CsrfModule {}
