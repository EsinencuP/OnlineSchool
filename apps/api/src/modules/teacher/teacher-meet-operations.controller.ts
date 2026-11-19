import {
  applyDecorators,
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Req,
  SetMetadata,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProperty,
  ApiResponse,
} from '@nestjs/swagger';
import { IsUUID, Matches } from 'class-validator';
import type { CriticalContext } from '../../core/http.js';
import { CriticalCommand, CurrentTransaction } from '../../core/idempotency/idempotency.module.js';
import { RequireVerifiedMfa } from '../../core/rbac/decorators.js';
import { STRICT_INPUT_DTO } from '../../openapi/dto-validation.pipe.js';
import { ApiError } from '../../openapi/dtos.js';
import { MEET_OPERATION_TOPIC } from '../schedule/google-meet/meet-operations.js';
import { MEET_LINK_REGEX } from '../schedule/meet-link.js';
import type { TeacherRequest } from './context/teacher-context.js';
import { TeacherRoute } from './guards/teacher-route.decorator.js';
import { TeacherMeetOperationsService } from './teacher-meet-operations.service.js';

const command = (type: string) =>
  applyDecorators(
    Header('Cache-Control', 'private, no-store'),
    ApiHeader({
      name: 'Idempotency-Key',
      required: true,
      schema: { type: 'string', format: 'uuid' },
    }),
    ApiHeader({ name: 'X-CSRF-Token', required: true }),
    CriticalCommand({
      type: `teacher.meet.${type}`,
      resourceType: 'TeacherMeetOperation',
      topic: MEET_OPERATION_TOPIC,
      successStatus: 202,
      conflictOnPayloadMismatch: true,
    }),
  );

class TeacherMeetOperationDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: ['CREATE', 'VERIFY', 'RECONCILE'] }) kind!: string;
  @ApiProperty({
    enum: [
      'QUEUED',
      'DISPATCHING',
      'SUCCEEDED',
      'FAILED',
      'UNKNOWN',
      'RECONCILED',
      'CLOSED_WITHOUT_SPACE',
    ],
  })
  state!: string;
  @ApiProperty({ format: 'date-time' }) queuedAt!: string;
  @ApiProperty({ type: String, nullable: true, format: 'date-time' }) finishedAt!: string | null;
  @ApiProperty({ type: String, nullable: true }) diagnosticCode!: string | null;
  @ApiProperty({ type: String, nullable: true, format: 'date-time' }) retryAt!: string | null;
}

class TeacherMeetSpaceDto {
  @ApiProperty({ format: 'uri' }) meetLink!: string;
  @ApiProperty({ format: 'date-time' }) lastVerifiedAt!: string;
}

class TeacherMeetPairDto {
  @ApiProperty({ format: 'uuid' }) assignmentId!: string;
  @ApiProperty({ type: TeacherMeetSpaceDto, nullable: true })
  published!: TeacherMeetSpaceDto | null;
  @ApiProperty({ type: TeacherMeetOperationDto, nullable: true })
  latestOperation!: TeacherMeetOperationDto | null;
  @ApiProperty({ type: String, nullable: true, format: 'uuid' }) unresolvedOperationId!:
    string | null;
}

@SetMetadata(STRICT_INPUT_DTO, true)
class ReconcileTeacherMeetDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() operationId!: string;
  @ApiProperty({
    format: 'uri',
    description: 'The recovered link of the unresolved create operation',
  })
  @Matches(MEET_LINK_REGEX)
  meetingUri!: string;
}

@TeacherRoute()
@RequireVerifiedMfa()
@ApiParam({ name: 'assignmentId', type: String, format: 'uuid' })
@ApiResponse({ status: 404, type: ApiError })
@Controller('api/v1/teacher/assignments/:assignmentId/meet')
export class TeacherMeetOperationsController {
  constructor(private readonly operations: TeacherMeetOperationsService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    operationId: 'getTeacherMeetPair',
    summary: 'Read the Meet space and operation state for an active teaching assignment',
  })
  @ApiOkResponse({ type: TeacherMeetPairDto })
  read(@Req() req: TeacherRequest, @Param('assignmentId') assignmentId: string) {
    return this.operations.read(req.teacherCtx!, assignmentId);
  }

  @Post('create')
  @command('create')
  @ApiOperation({
    operationId: 'createTeacherMeetSpace',
    summary: 'Queue a single Google Meet space creation for the pair',
  })
  @ApiAcceptedResponse({ type: TeacherMeetOperationDto })
  create(
    @Req() req: TeacherRequest,
    @CurrentTransaction() ctx: CriticalContext,
    @Param('assignmentId') assignmentId: string,
  ) {
    return this.operations.queue(ctx, req.teacherCtx!, assignmentId, { kind: 'CREATE' });
  }

  @Post('verify')
  @command('verify')
  @ApiOperation({
    operationId: 'verifyTeacherMeetSpace',
    summary: 'Queue confirmation of the published Meet resource by name',
  })
  @ApiAcceptedResponse({ type: TeacherMeetOperationDto })
  verify(
    @Req() req: TeacherRequest,
    @CurrentTransaction() ctx: CriticalContext,
    @Param('assignmentId') assignmentId: string,
  ) {
    return this.operations.queue(ctx, req.teacherCtx!, assignmentId, { kind: 'VERIFY' });
  }

  @Post('reconcile')
  @command('reconcile')
  @ApiOperation({
    operationId: 'reconcileTeacherMeetSpace',
    summary: 'Verify the teacher-supplied recovery reference for an unresolved creation',
  })
  @ApiAcceptedResponse({ type: TeacherMeetOperationDto })
  reconcile(
    @Req() req: TeacherRequest,
    @CurrentTransaction() ctx: CriticalContext,
    @Param('assignmentId') assignmentId: string,
    @Body() dto: ReconcileTeacherMeetDto,
  ) {
    return this.operations.queue(ctx, req.teacherCtx!, assignmentId, { kind: 'RECONCILE', ...dto });
  }
}
