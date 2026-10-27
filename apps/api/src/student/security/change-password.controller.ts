import { Body, Controller, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ApiCookieAuth, ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RequireRole } from '../../core/rbac/decorators.js';
import { unwrap } from '../../core/errors/domain-error.js';
import { ProblemDetails } from '../../core/errors/error-mapper.js';
import { SessionStore } from '../../core/session/session.store.js';
import type { HttpResponse } from '../../core/http.js';
import { StudentCtx } from '../student-context.decorator.js';
import type { IStudentContext, StudentRequest } from '../student-context.interface.js';
import { ChangeStudentPasswordService } from './change-password.service.js';
import { ChangeStudentPasswordDto, StudentPasswordChangedDto } from './change-password.dto.js';
@ApiTags('Student')
@ApiCookieAuth('sessionCookie')
@RequireRole('STUDENT')
@Controller('api/v1/student/security')
export class ChangeStudentPasswordController {
  constructor(
    private readonly passwords: ChangeStudentPasswordService,
    private readonly sessions: SessionStore,
  ) {}
  @Post('change-password')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'changeStudentPassword',
    summary: 'Replace temporary student password',
    description:
      'Session and CSRF required; valid without active paid access. Atomically changes the hash, clears the initial flag, revokes all old sessions, rotates cookies and records audit/outbox. No MFA or passkey.',
  })
  @ApiHeader({ name: 'X-CSRF-Token', required: true })
  @ApiResponse({ status: 200, type: StudentPasswordChangedDto })
  @ApiResponse({ status: 400, type: ProblemDetails })
  @ApiResponse({ status: 401, type: ProblemDetails })
  @ApiResponse({ status: 403, type: ProblemDetails })
  @ApiResponse({ status: 429, type: ProblemDetails })
  @ApiResponse({ status: 503, type: ProblemDetails })
  async change(
    @StudentCtx() student: IStudentContext,
    @Req() req: StudentRequest,
    @Body() input: ChangeStudentPasswordDto,
    @Res({ passthrough: true }) res: HttpResponse,
  ): Promise<StudentPasswordChangedDto> {
    const result = unwrap(await this.passwords.change(req, student, input));
    if (result.issued) this.sessions.cookies(res, result.issued);
    return { mustChangePassword: false };
  }
}
