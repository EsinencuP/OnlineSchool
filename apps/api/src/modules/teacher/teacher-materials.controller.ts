import {
  applyDecorators,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConflictResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiServiceUnavailableResponse,
} from '@nestjs/swagger';
import type { CriticalContext } from '../../core/http.js';
import { unwrap } from '../../core/errors/domain-error.js';
import { CriticalCommand, CurrentTransaction } from '../../core/idempotency/idempotency.module.js';
import { RequirePermission } from '../../core/rbac/decorators.js';
import { ApiError } from '../../openapi/dtos.js';
import { serialize } from '../finance/finance-common.js';
import type { TeacherRequest } from './context/teacher-context.js';
import {
  MaterialConfirmResponseDto,
  MaterialUploadResponseDto,
  RequestMaterialUploadDto,
  RevokeMaterialResponseDto,
  ShareMaterialDto,
  ShareMaterialResponseDto,
  TeacherMaterialPageDto,
  TeacherMaterialsQueryDto,
  TeacherSharedMaterialsDto,
} from './dto/teacher-materials.dto.js';
import { TeacherRoute } from './guards/teacher-route.decorator.js';
import { TeacherMaterialsService } from './teacher-materials.service.js';

const commandHeaders = () =>
  applyDecorators(
    ApiHeader({
      name: 'Idempotency-Key',
      required: true,
      schema: { type: 'string', format: 'uuid' },
    }),
    ApiHeader({ name: 'X-CSRF-Token', required: true, schema: { type: 'string' } }),
  );

@TeacherRoute()
@Controller('api/v1/teacher')
export class TeacherMaterialsController {
  constructor(private readonly materials: TeacherMaterialsService) {}

  @Get('materials')
  @ApiOperation({
    operationId: 'getTeacherMaterials',
    summary: "The teacher's private material library",
  })
  @ApiOkResponse({ type: TeacherMaterialPageDto })
  @ApiServiceUnavailableResponse({ type: ApiError, description: 'Data store unavailable' })
  async list(
    @Req() req: TeacherRequest,
    @Query() query: TeacherMaterialsQueryDto,
  ): Promise<TeacherMaterialPageDto> {
    return unwrap(await this.materials.list(req.teacherCtx!, query));
  }

  @Post('materials/uploads')
  @RequirePermission('education:teacher')
  @CriticalCommand({
    type: 'teacher.material.upload',
    resourceType: 'S3Object',
    topic: 'teacher.material.upload.v1',
  })
  @commandHeaders()
  @ApiOperation({
    operationId: 'requestTeacherMaterialUpload',
    summary: 'Register a file and get a short-lived signed URL to upload it to staging',
  })
  @ApiBody({ type: RequestMaterialUploadDto })
  @ApiOkResponse({ type: MaterialUploadResponseDto })
  async requestUpload(
    @CurrentTransaction() ctx: CriticalContext,
    @Body() body: RequestMaterialUploadDto,
  ): Promise<unknown> {
    return serialize(await this.materials.requestUpload(ctx, body));
  }

  @Post('materials/:fileId/confirm')
  @RequirePermission('education:teacher')
  @CriticalCommand({
    type: 'teacher.material.confirm',
    resourceType: 'S3Object',
    topic: 'teacher.material.confirm.v1',
  })
  @commandHeaders()
  @ApiOperation({
    operationId: 'confirmTeacherMaterialUpload',
    summary: 'Verify the uploaded staging object and publish it as a private file',
    description:
      'Require a clean malware verdict on the staging bytes before copying the verified ETag to the private final key.',
  })
  @ApiParam({ name: 'fileId', type: String, format: 'uuid' })
  @ApiOkResponse({ type: MaterialConfirmResponseDto })
  @ApiNotFoundResponse({ type: ApiError, description: 'Not found or not uploaded by this teacher' })
  async confirm(
    @CurrentTransaction() ctx: CriticalContext,
    @Param('fileId') fileId: string,
  ): Promise<unknown> {
    return serialize(await this.materials.confirm(ctx, fileId));
  }

  @Post('materials/:fileId/grants')
  @RequirePermission('education:teacher')
  @CriticalCommand({
    type: 'teacher.material.share',
    resourceType: 'FilePermission',
    topic: 'teacher.material.share.v1',
  })
  @commandHeaders()
  @ApiOperation({
    operationId: 'shareTeacherMaterial',
    summary: 'Give a taught student access to a verified file (optionally tied to a lesson)',
  })
  @ApiParam({ name: 'fileId', type: String, format: 'uuid' })
  @ApiBody({ type: ShareMaterialDto })
  @ApiOkResponse({ type: ShareMaterialResponseDto })
  @ApiConflictResponse({
    type: ApiError,
    description: 'Not verified, already shared or no student account',
  })
  async share(
    @CurrentTransaction() ctx: CriticalContext,
    @Param('fileId') fileId: string,
    @Body() body: ShareMaterialDto,
  ): Promise<unknown> {
    return serialize(await this.materials.share(ctx, fileId, body));
  }

  @Delete('materials/grants/:permissionId')
  @RequirePermission('education:teacher')
  @CriticalCommand({
    type: 'teacher.material.revoke',
    resourceType: 'FilePermission',
    topic: 'teacher.material.revoke.v1',
  })
  @commandHeaders()
  @ApiOperation({
    operationId: 'revokeTeacherMaterial',
    summary: 'Withdraw a student’s access to a file',
  })
  @ApiParam({ name: 'permissionId', type: String, format: 'uuid' })
  @ApiOkResponse({ type: RevokeMaterialResponseDto })
  @ApiNotFoundResponse({ type: ApiError, description: 'Not found or granted by another teacher' })
  async revoke(
    @CurrentTransaction() ctx: CriticalContext,
    @Param('permissionId') permissionId: string,
  ): Promise<unknown> {
    return serialize(await this.materials.revoke(ctx, permissionId));
  }

  @Get('enrollments/:enrollmentId/materials')
  @ApiOperation({
    operationId: 'getTeacherSharedMaterials',
    summary: 'Files this teacher shared with a taught student, for the enrollment subject',
  })
  @ApiParam({ name: 'enrollmentId', type: String, format: 'uuid' })
  @ApiOkResponse({ type: TeacherSharedMaterialsDto })
  @ApiNotFoundResponse({ type: ApiError, description: 'Not found or not taught by this teacher' })
  async shared(
    @Req() req: TeacherRequest,
    @Param('enrollmentId') enrollmentId: string,
  ): Promise<TeacherSharedMaterialsDto> {
    return unwrap(await this.materials.shared(req.teacherCtx!, enrollmentId));
  }
}
