import { Body, Controller, Get, Patch, Res } from '@nestjs/common';
import { ApiCookieAuth, ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RequireRole } from '../../core/rbac/decorators.js';
import { CriticalCommand, CurrentTransaction } from '../../core/idempotency/idempotency.module.js';
import type { CriticalContext, HttpResponse } from '../../core/http.js';
import { StudentCtx } from '../student-context.decorator.js';
import type { IStudentContext } from '../student-context.interface.js';
import { StudentProfileService } from './profile.service.js';
import { StudentProfileDto, UpdateProfileDto } from './profile.dto.js';
@ApiTags('Student')
@ApiCookieAuth('sessionCookie')
@RequireRole('STUDENT')
@Controller('api/v1/student/profile')
export class StudentProfileController {
  constructor(private readonly profile: StudentProfileService) {}
  @Patch()
  @ApiOperation({
    operationId: 'updateStudentProfile',
    summary: 'Update own display name and owned verified avatar',
    description:
      'Does not change registry full_name, email or phone. CSRF and UUID Idempotency-Key required. Avatar is private and available through an authenticated endpoint.',
  })
  @ApiHeader({ name: 'X-CSRF-Token', required: true })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiResponse({ status: 200, type: StudentProfileDto })
  @CriticalCommand({
    type: 'student.profile.update',
    topic: 'student.profile.updated.v1',
    resourceType: 'Student',
    resultIdField: 'id',
    successStatus: 200,
  })
  update(
    @CurrentTransaction() ctx: CriticalContext,
    @StudentCtx() student: IStudentContext,
    @Body() input: UpdateProfileDto,
  ) {
    return this.profile.update(ctx, student, input);
  }
  @Get('avatar')
  @ApiOperation({
    operationId: 'getStudentAvatar',
    summary: 'Read own selected private raster avatar',
    description:
      'Private no-store binary response, no signed capability URL. Deleted/quarantined/foreign files are not served.',
  })
  @ApiResponse({
    status: 200,
    content: {
      'image/png': { schema: { type: 'string', format: 'binary' } },
      'image/jpeg': { schema: { type: 'string', format: 'binary' } },
      'image/webp': { schema: { type: 'string', format: 'binary' } },
    },
  })
  async avatar(@StudentCtx() student: IStudentContext, @Res() res: HttpResponse) {
    const image = await this.profile.avatar(student);
    res.setHeader('Content-Type', image.contentType);
    res.setHeader('Content-Length', image.bytes.length);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    res.end(image.bytes);
  }
}
