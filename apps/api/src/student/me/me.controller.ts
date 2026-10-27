import { Controller, Get, Req } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RequireRole } from '../../core/rbac/decorators.js';
import { unwrap } from '../../core/errors/domain-error.js';
import { ProblemDetails } from '../../core/errors/error-mapper.js';
import { StudentCtx } from '../student-context.decorator.js';
import type { IStudentContext, StudentRequest } from '../student-context.interface.js';
import { MeService } from './me.service.js';
import { StudentMeResponseDto } from './me.dto.js';
@ApiTags('Student')
@ApiCookieAuth('sessionCookie')
@RequireRole('STUDENT')
@Controller('api/v1/student/me')
export class MeController {
  constructor(private readonly me: MeService) {}
  @Get()
  @ApiOperation({
    operationId: 'getStudentMe',
    summary: 'Current student profile and access stage',
    description:
      'Cookie session only. Available without active subscription and before initial password change; contains no parent identity or private file URL.',
  })
  @ApiResponse({ status: 200, type: StudentMeResponseDto })
  @ApiResponse({ status: 401, type: ProblemDetails })
  @ApiResponse({ status: 403, type: ProblemDetails })
  @ApiResponse({ status: 503, type: ProblemDetails })
  get(@StudentCtx() student: IStudentContext, @Req() req: StudentRequest): StudentMeResponseDto {
    return unwrap(this.me.get(student, req));
  }
}
