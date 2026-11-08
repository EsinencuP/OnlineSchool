import { Body, Controller, Delete, Get, HttpCode, Param, Post, Req, Res } from '@nestjs/common';
import { ApiCookieAuth, ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RequireRole } from '../../core/rbac/decorators.js';
import type { HttpResponse } from '../../core/http.js';
import { SessionStore } from '../../core/session/session.store.js';
import { ProblemDetails } from '../../core/errors/error-mapper.js';
import { uuid } from '../../modules/identity/input.js';
import { StudentCtx } from '../student-context.decorator.js';
import type { StudentRequest, IStudentContext } from '../student-context.interface.js';
import { StudentEmailService } from './email.service.js';
import { StudentSessionsService } from './sessions.service.js';
import {
  ChangeEmailRequestDto,
  ChangeEmailConfirmDto,
  EmailChangedDto,
  EmailOtpRequestedDto,
  SessionInfoDto,
} from './security.dto.js';
@ApiTags('Student')
@ApiCookieAuth('sessionCookie')
@RequireRole('STUDENT')
@ApiResponse({ status: 401, type: ProblemDetails })
@ApiResponse({ status: 402, type: ProblemDetails })
@ApiResponse({ status: 403, type: ProblemDetails })
@ApiResponse({ status: 429, type: ProblemDetails })
@ApiResponse({ status: 503, type: ProblemDetails })
@Controller('api/v1/student/security')
export class StudentSecurityController {
  constructor(
    private readonly email: StudentEmailService,
    private readonly sessions: StudentSessionsService,
    private readonly store: SessionStore,
  ) {}
  @Post('change-email/request')
  @HttpCode(200)
  @ApiHeader({ name: 'X-CSRF-Token', required: true })
  @ApiOperation({
    operationId: 'requestStudentEmailChange',
    summary: 'Verify current password and send a new-email OTP',
    description:
      'Every request invalidates previous OTPs.200 only after mail provider accepts; no cached secret body/hash.5 requests per15min/account; configured sender and OTP HMAC secret required.',
  })
  @ApiResponse({ status: 200, type: EmailOtpRequestedDto })
  @ApiResponse({ status: 409, type: ProblemDetails })
  requestEmail(
    @StudentCtx() student: IStudentContext,
    @Req() req: StudentRequest,
    @Body() body: ChangeEmailRequestDto,
  ) {
    return this.email.request(req, student, body);
  }
  @Post('change-email/confirm')
  @HttpCode(200)
  @ApiHeader({ name: 'X-CSRF-Token', required: true })
  @ApiOperation({
    operationId: 'confirmStudentEmailChange',
    summary: 'Confirm a six-digit OTP and replace the student login email',
    description:
      'OTP lifetime10min, max5 attempts, single use.Updates AuthAccount login only, records audit, revokes old sessions and rotates cookies. No change to CRM contacts or other pupil identities.',
  })
  @ApiResponse({ status: 200, type: EmailChangedDto })
  @ApiResponse({ status: 400, type: ProblemDetails })
  @ApiResponse({ status: 409, type: ProblemDetails })
  async confirmEmail(
    @StudentCtx() student: IStudentContext,
    @Req() req: StudentRequest,
    @Body() body: ChangeEmailConfirmDto,
    @Res({ passthrough: true }) res: HttpResponse,
  ) {
    const result = await this.email.confirm(req, student, body);
    if (result.issued) this.store.cookies(res, result.issued);
    return result.body;
  }
  @Get('sessions')
  @ApiOperation({
    operationId: 'getStudentSessions',
    summary: 'List own active sessions without cookie/CSRF secrets',
  })
  @ApiResponse({ status: 200, type: [SessionInfoDto] })
  list(@StudentCtx() student: IStudentContext, @Req() req: StudentRequest) {
    return this.sessions.list(student, req.account!.sessionId);
  }
  @Delete('sessions/:sessionId')
  @HttpCode(204)
  @ApiHeader({ name: 'X-CSRF-Token', required: true })
  @ApiOperation({
    operationId: 'revokeStudentSession',
    summary: 'Revoke another session belonging to the same student login',
    description: 'Current session409, foreign/unknown404, repeated revocation204. CSRF required.',
  })
  @ApiResponse({ status: 204, description: 'Other own session revoked' })
  @ApiResponse({ status: 404, type: ProblemDetails })
  @ApiResponse({ status: 409, type: ProblemDetails })
  revoke(
    @StudentCtx() student: IStudentContext,
    @Req() req: StudentRequest,
    @Param('sessionId') id: string,
    @Body() body: unknown,
  ) {
    return this.sessions.revoke(req, student, uuid(id), body);
  }
}
