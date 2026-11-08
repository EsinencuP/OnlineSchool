import {
  applyDecorators,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiCookieAuth,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CriticalCommand, CurrentTransaction } from '../../core/idempotency/idempotency.module.js';
import type { CriticalContext } from '../../core/http.js';
import { ProblemDetails } from '../../core/errors/error-mapper.js';
import { RequireRole } from '../../core/rbac/decorators.js';
import { uuid } from '../../modules/identity/input.js';
import { domainError, fail } from '../../core/errors/domain-error.js';
import { StudentCtx } from '../student-context.decorator.js';
import type { IStudentContext } from '../student-context.interface.js';
import { StudentHomeworkService } from './homework.service.js';
import { StudentHomeworkScopeGuard } from './homework-scope.guard.js';
import {
  ConfirmUploadResponseDto,
  HomeworkQueryDto,
  HomeworkQueryPipe,
  HomeworkResponseDto,
  HomeworkItemDto,
  RequestUploadUrlDto,
  SaveDraftDto,
  SavedDraftDto,
  SubmitHomeworkDto,
  SubmitResponseDto,
  UploadUrlResponseDto,
} from './homework.dto.js';
import type { HomeworkQuery } from './homework.dto.js';

function Mutation(
  type: string,
  topic: string,
  resourceType: string,
  resultIdField: string,
  status: 200 | 201,
) {
  return applyDecorators(
    UseGuards(StudentHomeworkScopeGuard),
    HttpCode(status),
    ApiParam({ name: 'hwId', format: 'uuid', type: String }),
    ApiHeader({ name: 'X-CSRF-Token', required: true }),
    ApiHeader({
      name: 'Idempotency-Key',
      required: true,
      schema: { type: 'string', format: 'uuid' },
    }),
    CriticalCommand({ type, topic, resourceType, resultIdField, successStatus: status }),
  );
}
@ApiTags('Student')
@ApiCookieAuth('sessionCookie')
@RequireRole('STUDENT')
@ApiResponse({ status: 400, type: ProblemDetails })
@ApiResponse({ status: 401, type: ProblemDetails })
@ApiResponse({ status: 402, type: ProblemDetails })
@ApiResponse({ status: 403, type: ProblemDetails })
@ApiResponse({ status: 409, type: ProblemDetails })
@ApiResponse({ status: 422, type: ProblemDetails })
@ApiResponse({ status: 503, type: ProblemDetails })
@Controller('api/v1/student/homework')
export class StudentHomeworkController {
  constructor(private readonly homework: StudentHomeworkService) {}
  @Get(':hwId')
  @ApiOperation({
    operationId: 'getStudentHomeworkDetail',
    summary: 'Read one owned visible homework delivery and its versions',
  })
  @ApiParam({ name: 'hwId', format: 'uuid', type: String })
  @ApiResponse({ status: 200, type: HomeworkItemDto })
  @ApiResponse({ status: 404, type: ProblemDetails })
  async detail(@StudentCtx() student: IStudentContext, @Param('hwId') id: string) {
    const result = await this.homework.list(student, { page: 1, pageSize: 1 }, uuid(id));
    return result.items[0] ?? fail(domainError('HOMEWORK_NOT_FOUND', 404));
  }
  @Get()
  @ApiOperation({
    operationId: 'getStudentHomework',
    summary: 'Chronological homework with immutable submission versions',
  })
  @ApiResponse({ status: 200, type: HomeworkResponseDto })
  list(@StudentCtx() student: IStudentContext, @Query(HomeworkQueryPipe) query: HomeworkQueryDto) {
    return this.homework.list(student, query as HomeworkQuery);
  }
  @Patch(':hwId/draft')
  @ApiBody({ type: SaveDraftDto })
  @ApiResponse({ status: 200, type: SavedDraftDto })
  @ApiOperation({
    operationId: 'saveStudentHomeworkDraft',
    summary: 'Overwrite one draft; server TTL 30 days',
    description:
      'CSRF and a new UUID Idempotency-Key per autosave required. Empty content is accepted. Client debounce: 2 seconds.',
  })
  @Mutation(
    'student.homework.draft',
    'student.homework.draft-saved.v1',
    'HomeworkDelivery',
    'homeworkId',
    200,
  )
  draft(
    @CurrentTransaction() ctx: CriticalContext,
    @StudentCtx() student: IStudentContext,
    @Param('hwId') id: string,
    @Body() body: SaveDraftDto,
  ) {
    return this.homework.draft(ctx, student, uuid(id), body);
  }
  @Post(':hwId/upload-url')
  @ApiBody({ type: RequestUploadUrlDto })
  @ApiResponse({ status: 201, type: UploadUrlResponseDto })
  @ApiOperation({
    operationId: 'requestStudentHomeworkUpload',
    summary: 'Create PENDING file and 15-minute private S3 PUT capability',
    description:
      'PUT the file bytes with the exact declared Content-Type and size. Then confirm through the API. Cached command results contain only fileId; replay never extends the URL expiry. Maximum 50 MiB per file.',
  })
  @Mutation(
    'student.homework.upload',
    'student.homework.upload-prepared.v1',
    'S3Object',
    'fileId',
    201,
  )
  upload(
    @CurrentTransaction() ctx: CriticalContext,
    @StudentCtx() student: IStudentContext,
    @Param('hwId') id: string,
    @Body() body: RequestUploadUrlDto,
  ) {
    return this.homework.prepareUpload(ctx, student, uuid(id), body);
  }
  @Post(':hwId/files/:fileId/confirm')
  @ApiParam({ name: 'fileId', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, type: ConfirmUploadResponseDto })
  @ApiOperation({
    operationId: 'confirmStudentHomeworkUpload',
    summary: 'Verify S3 upload and seal a server-only final object',
    description:
      'HEAD validates actual bytes and content type; conditional COPY creates the private immutable final object. No client URL can overwrite it. Only confirmed files may be submitted.',
  })
  @Mutation(
    'student.homework.file-confirm',
    'student.homework.file-confirmed.v1',
    'S3Object',
    'fileId',
    200,
  )
  confirm(
    @CurrentTransaction() ctx: CriticalContext,
    @StudentCtx() student: IStudentContext,
    @Param('hwId') id: string,
    @Param('fileId') fileId: string,
  ) {
    return this.homework.confirm(ctx, student, uuid(id), uuid(fileId));
  }
  @Post(':hwId/submit')
  @ApiBody({ type: SubmitHomeworkDto })
  @ApiResponse({ status: 201, type: SubmitResponseDto })
  @ApiOperation({
    operationId: 'submitStudentHomework',
    summary: 'Submit a version, preserve history and clear the draft',
    description:
      'Late submissions are accepted. A new version is allowed only when NOT_SUBMITTED or NEEDS_REVISION. At most 20 confirmed files from this homework and account. Numeric grades are not exposed.',
  })
  @Mutation(
    'student.homework.submit',
    'student.homework.submitted.v1',
    'HomeworkSubmission',
    'submissionId',
    201,
  )
  submit(
    @CurrentTransaction() ctx: CriticalContext,
    @StudentCtx() student: IStudentContext,
    @Param('hwId') id: string,
    @Body() body: SubmitHomeworkDto,
  ) {
    return this.homework.submit(ctx, student, uuid(id), body);
  }
}
