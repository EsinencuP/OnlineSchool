import { Body, Controller, Get, Header, Param, Post, Req, SetMetadata } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';
import { RequireMfa, RequireRole } from '../../../core/rbac/decorators.js';
import {
  CriticalCommand,
  CurrentTransaction,
} from '../../../core/idempotency/idempotency.module.js';
import type { CriticalContext, HttpRequest } from '../../../core/http.js';
import { UUID } from '../../../core/http.js';
import { domainError, unwrap } from '../../../core/errors/domain-error.js';
import { TransactionService } from '../../../core/transaction/transaction.service.js';
import { STRICT_INPUT_DTO } from '../../../openapi/dto-validation.pipe.js';
import { ApiError } from '../../../openapi/dtos.js';
import { DisputeFinanceService } from './dispute.service.js';
import type { DisputeProposal } from './dispute.service.js';
import { FinanceAccess } from '../finance-access.service.js';
import { redactMeet } from '../../schedule/meet-link.js';
@SetMetadata(STRICT_INPUT_DTO, true)
export class ApproveCrmDisputeDto {
  @ApiProperty({ type: 'integer', minimum: 1 }) @IsInt() @Min(1) version!: number;
}
export class CrmDisputeResolutionDto {
  @ApiProperty({ format: 'uuid' }) taskId!: string;
  @ApiProperty({ type: 'integer' }) version!: number;
  @ApiProperty({ enum: ['RESOLVED'] }) status!: 'RESOLVED';
  @ApiProperty({ format: 'uuid' }) ledgerPublicationId!: string;
  @ApiProperty({ type: String }) refundAmount!: string;
  @ApiProperty({ type: 'integer' }) refundLessons!: number;
  @ApiProperty() currency!: string;
}
export class CrmDisputeReviewDto {
  @ApiProperty({ format: 'uuid' }) taskId!: string;
  @ApiProperty({ format: 'uuid' }) studentId!: string;
  @ApiProperty({ format: 'uuid' }) lessonId!: string;
  @ApiProperty({ type: 'integer' }) version!: number;
  @ApiProperty() status!: string;
  @ApiProperty({ enum: ['FULL_REVERSAL', 'MANUAL_REVIEW'] }) mode!:
    'FULL_REVERSAL' | 'MANUAL_REVIEW';
  @ApiProperty() reason!: string;
  @ApiProperty({ type: String, nullable: true }) requestedAmount!: string | null;
  @ApiProperty({ type: Number, nullable: true }) requestedLessons!: number | null;
  @ApiProperty({ type: String }) fullAmount!: string;
  @ApiProperty({ type: 'integer' }) fullLessons!: number;
  @ApiProperty() currency!: string;
}
@Controller('api/v1/dispute-resolutions')
@RequireMfa()
@RequireRole('DIRECTOR')
@ApiTags('Finance')
@ApiCookieAuth('sessionCookie')
@ApiResponse({ status: 401, type: ApiError })
@ApiResponse({ status: 403, type: ApiError })
@ApiResponse({ status: 404, type: ApiError })
@ApiResponse({ status: 409, type: ApiError })
@ApiResponse({ status: 422, type: ApiError })
@ApiResponse({ status: 503, type: ApiError })
export class DirectorCrmDisputesController {
  constructor(
    private readonly disputes: DisputeFinanceService,
    private readonly access: FinanceAccess,
    private readonly transactions: TransactionService,
  ) {}
  @Get(':taskId')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    operationId: 'getCrmDisputeResolution',
    description:
      'Director review; full reversal restores rights and subscription advance, never cash. Partial requests require separate Finance processing.',
  })
  @ApiOkResponse({ type: CrmDisputeReviewDto })
  async get(@Req() r: HttpRequest, @Param('taskId') id: string): Promise<CrmDisputeReviewDto> {
    if (!UUID.test(id)) return unwrap({ ok: false, error: domainError('TASK_NOT_FOUND', 404) });
    return unwrap(
      await this.transactions.runCritical(async (tx) => {
        await this.access.staff(
          { tx, actor: r.account!, requestId: r.requestId!, operationId: r.requestId! },
          true,
        );
        const task = await tx.crmTask.findUnique({ where: { id } }),
          p = task?.decision as DisputeProposal | null;
        if (
          !task ||
          task.type !== 'ATTENDANCE_DISPUTE' ||
          !task.student_id ||
          !task.lesson_id ||
          p?.kind !== 'DISPUTE' ||
          p.decision !== 'ACCEPT'
        )
          return unwrap({ ok: false, error: domainError('TASK_NOT_FOUND', 404) });
        const source = unwrap(
          await this.disputes.source(
            tx,
            task.student_id,
            task.lesson_id,
            task.created_at,
            task.original_consumption_id,
          ),
        );
        return {
          taskId: task.id,
          studentId: task.student_id,
          lessonId: task.lesson_id,
          version: task.version,
          status: task.status,
          mode: p.mode,
          reason: redactMeet(p.reason) as string,
          requestedAmount: p.requestedAmount,
          requestedLessons: p.requestedLessons,
          fullAmount: source.amount,
          fullLessons: source.quantity,
          currency: source.currency,
        };
      }),
    );
  }
  @Post(':taskId/approve')
  @ApiOperation({
    operationId: 'approveCrmDisputeResolution',
    description:
      'Director executes the exact full-reversal proposal and resolves the CRM task atomically. Partial/manual requests cannot be executed by this command.',
  })
  @ApiOkResponse({ type: CrmDisputeResolutionDto })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiHeader({ name: 'X-CSRF-Token', required: true })
  @CriticalCommand({
    type: 'finance.crm-dispute.approve',
    resourceType: 'CrmTask',
    resultIdField: 'taskId',
    topic: 'finance.crm-dispute.approved.v1',
    conflictOnPayloadMismatch: true,
  })
  async approve(
    @Param('taskId') id: string,
    @Body() body: ApproveCrmDisputeDto,
    @CurrentTransaction() c: CriticalContext,
  ): Promise<CrmDisputeResolutionDto> {
    if (!UUID.test(id)) return unwrap({ ok: false, error: domainError('TASK_NOT_FOUND', 404) });
    return unwrap(await this.disputes.approve(c, id, body.version));
  }
}
