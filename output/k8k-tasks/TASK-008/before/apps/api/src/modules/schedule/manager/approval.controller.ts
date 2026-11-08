import { SetMetadata, Body, Controller, Param, Post, Get, Req, Header } from '@nestjs/common';
import {
  ApiBody,
  ApiCookieAuth,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RequireMfa, RequireRole } from '../../../core/rbac/decorators.js';
import {
  CriticalCommand,
  CurrentTransaction,
} from '../../../core/idempotency/idempotency.module.js';
import type { CriticalContext, HttpRequest } from '../../../core/http.js';
import { TransactionService } from '../../../core/transaction/transaction.service.js';
import type { ChangeInitiator } from './contracts.js';
import { domainError, unwrap } from '../../../core/errors/domain-error.js';
import { UUID } from '../../../core/http.js';
import { ApiError } from '../../../openapi/dtos.js';
import { STRICT_INPUT_DTO } from '../../../openapi/dto-validation.pipe.js';
import { ManagerScheduleWorkflow } from './workflow.service.js';
@SetMetadata(STRICT_INPUT_DTO, true)
export class ApproveScheduleChangeDto {}
export class ScheduleChangeApprovalDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) lessonId!: string;
  @ApiProperty({ enum: ['APPROVED'] }) status!: 'APPROVED';
}
export class ScheduleChangeReviewDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) lessonId!: string;
  @ApiProperty({ format: 'uuid' }) studentId!: string;
  @ApiProperty({ enum: ['RESCHEDULE', 'CANCEL'] }) action!: 'RESCHEDULE' | 'CANCEL';
  @ApiProperty({ enum: ['STUDENT', 'TEACHER', 'ACADEMY'] }) initiator!: ChangeInitiator;
  @ApiProperty() reason!: string;
  @ApiProperty({ format: 'date-time' }) oldStartsAt!: string;
  @ApiProperty({ type: String, nullable: true, format: 'date-time' }) newStartsAt!: string | null;
  @ApiProperty({ format: 'uuid' }) oldTeacherId!: string;
  @ApiProperty({ type: String, nullable: true, format: 'uuid' }) newTeacherId!: string | null;
  @ApiProperty({ type: Boolean, nullable: true }) chargeable!: boolean | null;
  @ApiProperty({ enum: ['PENDING', 'APPROVED', 'APPLIED', 'STALE'] }) status!:
    'PENDING' | 'APPROVED' | 'APPLIED' | 'STALE';
}
@Controller('api/v1/schedule-change-approvals')
@RequireMfa()
@RequireRole('DIRECTOR')
@ApiTags('Schedule')
@ApiCookieAuth('sessionCookie')
@ApiResponse({ status: 401, type: ApiError })
@ApiResponse({ status: 403, type: ApiError })
@ApiResponse({ status: 404, type: ApiError })
@ApiResponse({ status: 409, type: ApiError })
@ApiResponse({ status: 422, type: ApiError })
export class ScheduleChangeApprovalController {
  constructor(
    private readonly workflow: ManagerScheduleWorkflow,
    private readonly transactions: TransactionService,
  ) {}
  @Get(':id')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    operationId: 'getScheduleChangeApproval',
    description: 'Director review of the exact requested change before approval.',
  })
  @ApiOkResponse({ type: ScheduleChangeReviewDto })
  async review(@Param('id') id: string, @Req() r: HttpRequest): Promise<ScheduleChangeReviewDto> {
    if (!UUID.test(id))
      return unwrap({ ok: false, error: domainError('CHANGE_REQUEST_NOT_FOUND', 404) });
    return unwrap(
      await this.transactions.runResult((tx) =>
        this.workflow.review(
          { tx, actor: r.account!, requestId: r.requestId!, operationId: r.requestId! },
          id,
        ),
      ),
    );
  }
  @Post(':id/approve')
  @ApiOperation({
    operationId: 'approveScheduleChange',
    description:
      'Director approval for one immutable lesson/version/change payload. Does not change the lesson or grant financial rights.',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiHeader({ name: 'X-CSRF-Token', required: true })
  @ApiBody({ required: false, type: ApproveScheduleChangeDto })
  @ApiOkResponse({ type: ScheduleChangeApprovalDto })
  @CriticalCommand({
    type: 'schedule.change.approve',
    resourceType: 'ScheduleChangeApproval',
    topic: 'schedule.change.approved.v1',
    conflictOnPayloadMismatch: true,
  })
  async approve(
    @Param('id') id: string,
    @Body() _body: ApproveScheduleChangeDto,
    @CurrentTransaction() c: CriticalContext,
  ): Promise<ScheduleChangeApprovalDto> {
    if (!UUID.test(id))
      return unwrap({ ok: false, error: domainError('CHANGE_REQUEST_NOT_FOUND', 404) });
    return unwrap(await this.workflow.approve(c, id));
  }
}
