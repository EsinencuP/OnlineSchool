import {
  applyDecorators,
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { AccountContext, CriticalContext } from '../../../core/http.js';
import {
  CriticalCommand,
  CurrentTransaction,
} from '../../../core/idempotency/idempotency.module.js';
import {
  CurrentAccount,
  RequireMfa,
  RequirePermission,
  RequireRole,
  RequireVerifiedMfa,
} from '../../../core/rbac/decorators.js';
import { ApiError } from '../../../openapi/dtos.js';
import { FinanceScopeGuard } from '../finance-scope.guard.js';
import {
  AllocationCorrectionDto,
  AllocationCorrectionQueueDto,
  AllocationCorrectionSummaryDto,
  ProposeAllocationCorrectionDto,
  ReviewAllocationCorrectionDto,
} from './allocation-corrections.dto.js';
import { AllocationCorrectionsService } from './allocation-corrections.service.js';

const correctionCommand = (type: string, successStatus: 200 | 201) =>
  applyDecorators(
    Header('Cache-Control', 'private, no-store'),
    ApiHeader({
      name: 'Idempotency-Key',
      required: true,
      schema: { type: 'string', format: 'uuid' },
    }),
    ApiHeader({ name: 'X-CSRF-Token', required: true }),
    ApiResponse({ status: 409, type: ApiError }),
    ApiResponse({ status: 422, type: ApiError }),
    CriticalCommand({
      type,
      resourceType: 'PaymentAllocationCorrection',
      topic: `${type}.v1`,
      successStatus,
      conflictOnPayloadMismatch: true,
    }),
  );

@Controller('api/v1')
@UseGuards(FinanceScopeGuard)
@RequireRole('MANAGER', 'DIRECTOR')
@RequireMfa()
@ApiTags('Finance')
@ApiCookieAuth('sessionCookie')
@ApiResponse({ status: 403, type: ApiError })
@ApiResponse({ status: 404, type: ApiError })
export class AllocationCorrectionsController {
  constructor(private readonly corrections: AllocationCorrectionsService) {}

  @Post('distributions/:id/correction-proposals')
  @RequireRole('MANAGER')
  @RequirePermission('payment:distribute')
  @correctionCommand('finance.allocation-correction.proposed', 201)
  @ApiOperation({
    operationId: 'proposeAllocationCorrection',
    summary: 'Record an erroneous allocation and its proposed correction',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiCreatedResponse({ type: AllocationCorrectionDto })
  proposeCorrection(
    @CurrentTransaction() ctx: CriticalContext,
    @Param('id') id: string,
    @Body() dto: ProposeAllocationCorrectionDto,
  ) {
    return this.corrections.propose(ctx, id, dto);
  }

  @Get('distribution-corrections/:id')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    operationId: 'getAllocationCorrection',
    summary: 'Review the proposed allocation correction and current financial facts',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: AllocationCorrectionDto })
  correction(@CurrentAccount() actor: AccountContext, @Param('id') id: string) {
    return this.corrections.view(actor, id);
  }

  @Get('director/distribution-corrections')
  @Header('Cache-Control', 'private, no-store')
  @RequireRole('DIRECTOR')
  @RequirePermission('distribution:approve')
  @RequireVerifiedMfa()
  @ApiOperation({
    operationId: 'listDirectorAllocationCorrections',
    summary: 'List open allocation corrections',
  })
  @ApiQuery({ name: 'after', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: AllocationCorrectionQueueDto })
  queue(@CurrentAccount() actor: AccountContext, @Query('after') after?: string) {
    return this.corrections.queue(actor, after);
  }

  @Post('director/distribution-corrections/:id/review')
  @HttpCode(200)
  @RequireRole('DIRECTOR')
  @RequirePermission('distribution:approve')
  @RequireVerifiedMfa()
  @correctionCommand('finance.allocation-correction.reviewed', 200)
  @ApiOperation({
    operationId: 'reviewAllocationCorrection',
    summary: 'Decline a proposal or refer it for manual financial settlement',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: AllocationCorrectionSummaryDto })
  reviewCorrection(
    @CurrentTransaction() ctx: CriticalContext,
    @Param('id') id: string,
    @Body() dto: ReviewAllocationCorrectionDto,
  ) {
    return this.corrections.review(ctx, id, dto);
  }
}
