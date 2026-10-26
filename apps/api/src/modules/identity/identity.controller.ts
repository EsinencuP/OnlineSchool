import * as ApiDto from '../../openapi/dtos.js';
import {
  ApiBody,
  ApiCookieAuth,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Body, Controller, Delete, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { domainError, fail, unwrap } from '../../core/errors/domain-error.js';
import type { HttpRequest, HttpResponse } from '../../core/http.js';
import {
  Authenticated,
  AllowPreMfa,
  Public,
  RequireMfa,
  RequireRole,
} from '../../core/rbac/decorators.js';
import { LOGIN_COOKIE, SessionStore } from '../../core/session/session.store.js';
import { IdentityService } from './identity.service.js';
import type { IdentityOutcome } from './identity.service.js';
import { RecoveryService } from './recovery.service.js';
import type { Result } from '@online-school/shared';
import type { DomainError } from '../../core/errors/domain-error.js';

@Controller('api/v1/auth')
export class IdentityController {
  constructor(
    private readonly identity: IdentityService,
    private readonly recovery: RecoveryService,
    private readonly sessions: SessionStore,
  ) {}
  private async response(
    result: Promise<Result<IdentityOutcome, DomainError>>,
    res: HttpResponse,
  ): Promise<unknown> {
    const outcome = unwrap(await result);
    if (outcome.issued) this.sessions.cookies(res, outcome.issued);
    const previous = res.getHeader('Set-Cookie');
    const cookies =
      typeof previous === 'string'
        ? [previous]
        : Array.isArray(previous)
          ? previous.map(String)
          : [];
    if (outcome.loginBinding)
      cookies.push(
        `${LOGIN_COOKIE}=${outcome.loginBinding}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=300`,
      );
    if (outcome.clearLoginBinding)
      cookies.push(`${LOGIN_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
    if (cookies.length) res.setHeader('Set-Cookie', cookies);
    return outcome.body;
  }
  @ApiOperation({
    operationId: 'createSession',
    summary: 'Create session',
    description:
      'Password creates stage-one session; method=passkey starts a browser-bound, discoverable passkey login.',
  })
  @ApiResponse({
    status: 200,
    type: ApiDto.CreateSessionResponse,
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
  @ApiHeader({ name: 'X-CSRF-Token', required: true, schema: { type: 'string' } })
  @ApiBody({ type: ApiDto.LoginRequest, required: true })
  @ApiTags('Identity')
  @Post('session')
  @Public()
  @HttpCode(200)
  login(
    @Body() _body: ApiDto.LoginRequest,
    @Req() req: HttpRequest,
    @Res({ passthrough: true }) res: HttpResponse,
  ): Promise<unknown> {
    return this.response(this.identity.login(req), res);
  }
  @ApiOperation({
    operationId: 'currentSession',
    summary: 'Current session',
    description: 'Current account and MFA/recovery stage; missing session returns 401.',
  })
  @ApiResponse({
    status: 200,
    type: ApiDto.SessionResponse,
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
  @ApiCookieAuth('sessionCookie')
  @ApiTags('Identity')
  @Get('session')
  @Public()
  current(@Req() req: HttpRequest): unknown {
    const actor = req.account;
    if (!actor) return fail(domainError('UNAUTHENTICATED', 401));
    return {
      account: { id: actor.accountId, kind: actor.kind, role: actor.role, roles: actor.roles },
      mfa_completed: actor.mfaCompleted,
      recovery_only: actor.recoveryOnly ?? false,
      expires_at: actor.expiresAt.toISOString(),
    };
  }
  @ApiOperation({
    operationId: 'deleteSession',
    summary: 'Delete session',
    description: 'Revoke current session and record AccessRevocation and audit atomically.',
  })
  @ApiResponse({
    status: 200,
    type: ApiDto.LogoutResponse,
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
  @ApiHeader({ name: 'X-CSRF-Token', required: true, schema: { type: 'string' } })
  @ApiCookieAuth('sessionCookie')
  @ApiBody({ type: ApiDto.EmptyRequest, required: false })
  @ApiTags('Identity')
  @Delete('session')
  @Public()
  @HttpCode(200)
  async logout(
    @Body() _body: ApiDto.EmptyRequest,
    @Req() req: HttpRequest,
    @Res({ passthrough: true }) res: HttpResponse,
  ): Promise<unknown> {
    const result = await this.response(this.identity.logout(req), res);
    this.sessions.clearCookies(res);
    return result;
  }
  @ApiOperation({
    operationId: 'registerPasskeyStart',
    summary: 'Register passkey start',
    description:
      'Five-minute challenge; register requires a session. Auth start accepts email for passwordless login, or empty body for the current session.',
  })
  @ApiResponse({
    status: 200,
    type: ApiDto.WebAuthnStartResponse,
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
  @ApiHeader({ name: 'X-CSRF-Token', required: true, schema: { type: 'string' } })
  @ApiCookieAuth('sessionCookie')
  @ApiBody({ type: ApiDto.EmptyRequest, required: false })
  @ApiTags('Identity')
  @Post('webauthn/register/start')
  @Authenticated()
  @AllowPreMfa()
  @HttpCode(200)
  registerStart(
    @Body() _body: ApiDto.EmptyRequest,
    @Req() req: HttpRequest,
    @Res({ passthrough: true }) res: HttpResponse,
  ): Promise<unknown> {
    return this.response(this.identity.registerStart(req), res);
  }
  @ApiOperation({
    operationId: 'registerPasskeyFinish',
    summary: 'Register passkey finish',
    description:
      'Verify exact RP/origin, UV, signature and single-use challenge. Authentication advances counter and rotates session. Replay returns 400.',
  })
  @ApiResponse({
    status: 200,
    type: ApiDto.PasskeyRegisteredResponse,
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
  @ApiHeader({ name: 'X-CSRF-Token', required: true, schema: { type: 'string' } })
  @ApiCookieAuth('sessionCookie')
  @ApiBody({ type: ApiDto.WebAuthnFinishRequest, required: true })
  @ApiTags('Identity')
  @Post('webauthn/register/finish')
  @Authenticated()
  @AllowPreMfa()
  @HttpCode(200)
  registerFinish(
    @Body() _body: ApiDto.WebAuthnFinishRequest,
    @Req() req: HttpRequest,
    @Res({ passthrough: true }) res: HttpResponse,
  ): Promise<unknown> {
    return this.response(this.identity.registerFinish(req), res);
  }
  @ApiOperation({
    operationId: 'authenticatePasskeyStart',
    summary: 'Authenticate passkey start',
    description:
      'Five-minute challenge; register requires a session. Auth start accepts email for passwordless login, or empty body for the current session.',
  })
  @ApiResponse({
    status: 200,
    type: ApiDto.WebAuthnStartResponse,
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
  @ApiHeader({ name: 'X-CSRF-Token', required: true, schema: { type: 'string' } })
  @ApiBody({ type: ApiDto.WebAuthnStartRequest, required: true })
  @ApiTags('Identity')
  @Post('webauthn/authenticate/start')
  @Public()
  @HttpCode(200)
  authenticateStart(
    @Body() _body: ApiDto.WebAuthnStartRequest,
    @Req() req: HttpRequest,
    @Res({ passthrough: true }) res: HttpResponse,
  ): Promise<unknown> {
    return this.response(this.identity.authenticateStart(req), res);
  }
  @ApiOperation({
    operationId: 'authenticatePasskeyFinish',
    summary: 'Authenticate passkey finish',
    description:
      'Verify exact RP/origin, UV, signature and single-use challenge. Authentication advances counter and rotates session. Replay returns 400.',
  })
  @ApiResponse({
    status: 200,
    type: ApiDto.SessionResponse,
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
  @ApiHeader({ name: 'X-CSRF-Token', required: true, schema: { type: 'string' } })
  @ApiBody({ type: ApiDto.WebAuthnFinishRequest, required: true })
  @ApiTags('Identity')
  @Post('webauthn/authenticate/finish')
  @Public()
  @HttpCode(200)
  authenticateFinish(
    @Body() _body: ApiDto.WebAuthnFinishRequest,
    @Req() req: HttpRequest,
    @Res({ passthrough: true }) res: HttpResponse,
  ): Promise<unknown> {
    return this.response(this.identity.authenticateFinish(req), res);
  }
  @ApiOperation({
    operationId: 'initiateRecovery',
    summary: 'Initiate recovery',
    description:
      'MFA director recovers staff/teachers; tech operator recovers director with pre-recorded identity evidence and confirmed owner instruction. Token is shown once and is never cached.',
  })
  @ApiResponse({
    status: 200,
    type: ApiDto.RecoveryInitiatedResponse,
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
    required: true,
    schema: { type: 'string', format: 'uuid' },
    description: 'Required for critical business commands; reuse only for identical payload',
  })
  @ApiHeader({ name: 'X-Request-ID', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({ name: 'X-CSRF-Token', required: true, schema: { type: 'string' } })
  @ApiCookieAuth('sessionCookie')
  @ApiBody({ type: ApiDto.RecoveryInitiateRequest, required: true })
  @ApiTags('Identity')
  @Post('recovery/initiate')
  @RequireRole('DIRECTOR', 'TECH_OPERATOR')
  @RequireMfa()
  @HttpCode(200)
  initiateRecovery(
    @Body() _body: ApiDto.RecoveryInitiateRequest,
    @Req() req: HttpRequest,
    @Res({ passthrough: true }) res: HttpResponse,
  ): Promise<unknown> {
    return this.response(this.recovery.initiate(req), res);
  }
  @ApiOperation({
    operationId: 'completeRecovery',
    summary: 'Complete recovery',
    description:
      'Redeem a single-use proof for a registration-only session. Prior sessions remain revoked.',
  })
  @ApiResponse({
    status: 200,
    type: ApiDto.SessionResponse,
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
  @ApiHeader({ name: 'X-CSRF-Token', required: true, schema: { type: 'string' } })
  @ApiBody({ type: ApiDto.RecoveryCompleteRequest, required: true })
  @ApiTags('Identity')
  @Post('recovery/complete')
  @Public()
  @HttpCode(200)
  completeRecovery(
    @Body() _body: ApiDto.RecoveryCompleteRequest,
    @Req() req: HttpRequest,
    @Res({ passthrough: true }) res: HttpResponse,
  ): Promise<unknown> {
    return this.response(this.recovery.complete(req), res);
  }
}
