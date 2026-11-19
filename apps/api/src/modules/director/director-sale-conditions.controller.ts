import { applyDecorators, Body, Controller, Get, Header, Param, Post, Query } from '@nestjs/common';
import { ApiHeader, ApiOkResponse, ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { AccountContext, CriticalContext } from '../../core/http.js';
import { CriticalCommand, CurrentTransaction } from '../../core/idempotency/idempotency.module.js';
import { CurrentAccount, RequireVerifiedMfa } from '../../core/rbac/decorators.js';
import { ApiError } from '../../openapi/dtos.js';
import { DirectorSaleConditionsService } from './director-sale-conditions.service.js';
import {
  PublishSaleConditionDto,
  RetireSaleConditionDto,
  SaleConditionVersionDto,
  SaleConditionVersionsDto,
  SaleConditionsQueryDto,
} from './dto/director-sale-conditions.dto.js';
import { DirectorRoute } from './guards/director-route.decorator.js';

const saleCommand = (action: 'publish' | 'retire') =>
  applyDecorators(
    Header('Cache-Control', 'private, no-store'),
    ApiHeader({
      name: 'Idempotency-Key',
      required: true,
      schema: { type: 'string', format: 'uuid' },
    }),
    ApiHeader({ name: 'X-CSRF-Token', required: true }),
    ApiResponse({ status: 404, type: ApiError }),
    ApiResponse({ status: 409, type: ApiError }),
    ApiResponse({ status: 422, type: ApiError }),
    CriticalCommand({
      type: `director.sale-condition.${action}`,
      resourceType: 'SaleCondition',
      topic: `director.sale-condition.${action}.v1`,
      conflictOnPayloadMismatch: true,
    }),
  );

@DirectorRoute()
@RequireVerifiedMfa()
@Controller('api/v1/director/sale-conditions')
export class DirectorSaleConditionsController {
  constructor(private readonly conditions: DirectorSaleConditionsService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    operationId: 'listDirectorSaleConditions',
    summary: 'List current and historical sale condition versions',
  })
  @ApiOkResponse({ type: SaleConditionVersionsDto })
  list(@CurrentAccount() actor: AccountContext, @Query() query: SaleConditionsQueryDto) {
    return this.conditions.list(actor, query);
  }

  @Post('publish')
  @saleCommand('publish')
  @ApiOperation({
    operationId: 'publishDirectorSaleCondition',
    summary: 'Publish a new sale condition version for future purchases',
  })
  @ApiOkResponse({ type: SaleConditionVersionDto })
  publish(@CurrentTransaction() ctx: CriticalContext, @Body() body: PublishSaleConditionDto) {
    return this.conditions.publish(ctx, body);
  }

  @Post(':id/retire')
  @saleCommand('retire')
  @ApiOperation({
    operationId: 'retireDirectorSaleCondition',
    summary: 'Close a sale condition for new purchases',
  })
  @ApiOkResponse({ type: SaleConditionVersionDto })
  retire(
    @CurrentTransaction() ctx: CriticalContext,
    @Param('id') id: string,
    @Body() body: RetireSaleConditionDto,
  ) {
    return this.conditions.retire(ctx, id, body.basis);
  }
}
