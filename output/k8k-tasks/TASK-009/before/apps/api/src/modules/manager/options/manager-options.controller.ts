import { Controller, Get, Query, Req } from '@nestjs/common';
import {
  ApiOperation,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiUnprocessableEntityResponse,
  ApiServiceUnavailableResponse,
} from '@nestjs/swagger';
import { ApiError } from '../../../openapi/dtos.js';
import { unwrap } from '../../../core/errors/domain-error.js';
import type { ManagerRequest } from '../context/manager-context.js';
import { ManagerRoute } from '../guards/manager-route.decorator.js';
import { ManagerOptionsDto, ManagerOptionsQueryDto } from './manager-options.dto.js';
import { ManagerOptionsService } from './manager-options.service.js';

@ManagerRoute()
@Controller('api/v1/manager/options')
export class ManagerOptionsController {
  constructor(private readonly options: ManagerOptionsService) {}
  @Get()
  @ApiOperation({
    operationId: 'getManagerOptions',
    summary: 'Named form options; student-specific values are portfolio-scoped',
  })
  @ApiOkResponse({ type: ManagerOptionsDto })
  @ApiNotFoundResponse({ type: ApiError })
  @ApiUnprocessableEntityResponse({ type: ApiError })
  @ApiServiceUnavailableResponse({ type: ApiError })
  async get(
    @Req() req: ManagerRequest,
    @Query() query: ManagerOptionsQueryDto,
  ): Promise<ManagerOptionsDto> {
    return unwrap(await this.options.get(req.managerCtx!, query.studentId));
  }
}
