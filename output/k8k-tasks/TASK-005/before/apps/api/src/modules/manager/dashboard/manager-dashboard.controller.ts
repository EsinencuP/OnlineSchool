import { Controller, Get, Header, Query, Req } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ManagerRoute } from '../guards/manager-route.decorator.js';
import type { ManagerRequest } from '../context/manager-context.js';
import { unwrap } from '../../../core/errors/domain-error.js';
import { ApiError } from '../../../openapi/dtos.js';
import { DashboardQueryDto, ManagerDashboardDto } from '../dto/manager-dashboard.dto.js';
import { ManagerDashboardService } from './manager-dashboard.service.js';
@ManagerRoute()
@ApiExtraModels(DashboardQueryDto)
@Controller('api/v1/manager/dashboard')
@ApiResponse({ status: 422, type: ApiError })
@ApiResponse({ status: 503, type: ApiError })
export class ManagerDashboardController {
  constructor(private readonly dashboard: ManagerDashboardService) {}
  @Get()
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    operationId: 'getManagerDashboard',
    description:
      'One READ ONLY snapshot; no cache. Pending receipts include unpublished unallocated remainder under the owner decision; mixed-portfolio households are excluded from financial aggregates.',
  })
  @ApiOkResponse({ type: ManagerDashboardDto })
  async get(@Req() r: ManagerRequest, @Query() q: DashboardQueryDto): Promise<ManagerDashboardDto> {
    return unwrap(await this.dashboard.get(r.managerCtx!, q));
  }
}
