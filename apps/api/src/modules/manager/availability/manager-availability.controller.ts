import { Body, Controller, Get, Header, Put, Req } from '@nestjs/common';
import { ApiHeader, ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import type { CriticalContext } from '../../../core/http.js';
import {
  CriticalCommand,
  CurrentTransaction,
} from '../../../core/idempotency/idempotency.module.js';
import { unwrap } from '../../../core/errors/domain-error.js';
import type { ManagerRequest } from '../context/manager-context.js';
import { ManagerRoute } from '../guards/manager-route.decorator.js';
import { ManagerAvailabilityDto, SetManagerAvailabilityDto } from './manager-availability.dto.js';
import { ManagerAvailabilityService } from './manager-availability.service.js';

@ManagerRoute()
@Controller('api/v1/manager/availability')
export class ManagerAvailabilityController {
  constructor(private readonly availability: ManagerAvailabilityService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    operationId: 'getManagerAvailability',
    summary: 'Working status that decides how urgent tasks are routed (OPS-01/B)',
  })
  @ApiOkResponse({ type: ManagerAvailabilityDto })
  async get(@Req() r: ManagerRequest) {
    return unwrap(await this.availability.get(r.managerCtx!));
  }

  @Put()
  @Header('Cache-Control', 'private, no-store')
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiHeader({ name: 'X-CSRF-Token', required: true })
  @CriticalCommand({
    type: 'manager.availability.set',
    resourceType: 'StaffAccount',
    topic: 'manager.availability.changed.v1',
    conflictOnPayloadMismatch: true,
  })
  @ApiOperation({
    operationId: 'setManagerAvailability',
    summary: 'Set the working status; UNAVAILABLE / OFF_SHIFT send urgent tasks to the director',
  })
  @ApiOkResponse({ type: ManagerAvailabilityDto })
  async set(
    @Req() r: ManagerRequest,
    @Body() dto: SetManagerAvailabilityDto,
    @CurrentTransaction() c: CriticalContext,
  ) {
    return unwrap(await this.availability.set(r.managerCtx!, dto.status, c));
  }
}
