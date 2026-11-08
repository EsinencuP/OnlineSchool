import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RequireRole } from '../../core/rbac/decorators.js';
import { cookie } from '../../core/http.js';
import { SESSION_COOKIE } from '../../core/session/session.store.js';
import { ProblemDetails } from '../../core/errors/error-mapper.js';
import { object, uuid } from '../../modules/identity/input.js';
import { StudentCtx } from '../student-context.decorator.js';
import type { IStudentContext, StudentRequest } from '../student-context.interface.js';
import { StudentMaterialsService } from './materials.service.js';
import {
  FileSignedUrlResponseDto,
  MaterialsQueryDto,
  MaterialsQueryPipe,
  MaterialsResponseDto,
} from './materials.dto.js';
import type { MaterialsQuery } from './materials.dto.js';

@ApiTags('Student')
@ApiCookieAuth('sessionCookie')
@RequireRole('STUDENT')
@ApiResponse({ status: 400, type: ProblemDetails })
@ApiResponse({ status: 401, type: ProblemDetails })
@ApiResponse({ status: 402, type: ProblemDetails })
@ApiResponse({ status: 403, type: ProblemDetails })
@ApiResponse({ status: 503, type: ProblemDetails })
@Controller('api/v1/student/materials')
export class StudentMaterialsController {
  constructor(private readonly materials: StudentMaterialsService) {}
  @Get()
  @ApiOperation({
    operationId: 'getStudentMaterials',
    summary: 'Only materials explicitly shared with this student by a teacher',
    description:
      'Current FilePermission + VERIFIED object required. No object key, bucket or URL in the list. Optional educational subject filter. Historical contextless grants show «Без предмета».',
  })
  @ApiResponse({ status: 200, type: MaterialsResponseDto })
  list(
    @StudentCtx() student: IStudentContext,
    @Query(MaterialsQueryPipe) query: MaterialsQueryDto,
  ) {
    return this.materials.list(student, query as MaterialsQuery);
  }
  @Get(':fileId/url')
  @ApiOperation({
    operationId: 'getStudentMaterialUrl',
    summary: 'Authorize one private material and issue a temporary GET capability',
    description:
      'Rechecks live session, student access, explicit permission and verified object under a row lock; appends FileAuditLog without the signed URL. Maximum TTL 900 seconds, capped by grant expiry. Revocation stops new URL issuance; an already issued S3 capability remains valid until its expiry. No CSRF/Idempotency-Key needed for this GET.',
  })
  @ApiParam({ name: 'fileId', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, type: FileSignedUrlResponseDto })
  url(
    @StudentCtx() student: IStudentContext,
    @Param('fileId') id: string,
    @Req() req: StudentRequest,
  ) {
    object(req.query, []);
    return this.materials.signedUrl(
      student,
      uuid(id),
      cookie(req, SESSION_COOKIE),
      req.account!,
      req.requestId!,
    );
  }
}
