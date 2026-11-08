import { Controller, Get, Req } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiServiceUnavailableResponse } from '@nestjs/swagger';
import { unwrap } from '../../../core/errors/domain-error.js';
import { ApiError } from '../../../openapi/dtos.js';
import type { ManagerRequest } from '../context/manager-context.js';
import { ManagerMeResponseDto } from '../dto/manager-me.response.dto.js';
import { ManagerRoute } from '../guards/manager-route.decorator.js';
import { ManagerMeService } from './manager-me.service.js';

@ManagerRoute()
@Controller('api/v1/manager/me')
export class ManagerMeController {
  constructor(private readonly me: ManagerMeService) {}
  @Get()
  @ApiOperation({
    operationId: 'getManagerMe',
    summary: 'Get the current manager profile and portfolio size',
  })
  @ApiOkResponse({ type: ManagerMeResponseDto })
  @ApiServiceUnavailableResponse({
    type: ApiError,
    description: 'Data store or configuration unavailable',
  })
  async get(@Req() req: ManagerRequest): Promise<ManagerMeResponseDto> {
    return unwrap(await this.me.get(req.managerCtx!, req.account!));
  }
}
