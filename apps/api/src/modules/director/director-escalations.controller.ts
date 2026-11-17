import { Body, Controller, Get, Header, Param, Post, Query } from '@nestjs/common';
import {
  ApiBody,
  ApiConflictResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { CriticalContext } from '../../core/http.js';
import { CriticalCommand, CurrentTransaction } from '../../core/idempotency/idempotency.module.js';
import { unwrap } from '../../core/errors/domain-error.js';
import { ApiError } from '../../openapi/dtos.js';
import { DirectorEscalationsService } from './director-escalations.service.js';
import { DirectorEmptyCommandDto } from './dto/director-commands.dto.js';
import {
  EscalationDto,
  EscalationPageDto,
  EscalationsQueryDto,
  ManagerAvailabilityListDto,
} from './dto/director-escalations.dto.js';
import { DirectorRoute } from './guards/director-route.decorator.js';

@DirectorRoute()
@Controller('api/v1/director')
export class DirectorEscalationsController {
  constructor(private readonly escalations: DirectorEscalationsService) {}

  @Get('escalations')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    operationId: 'listDirectorEscalations',
    summary: 'Urgent tasks routed to the director (OPS-01/B), oldest first',
  })
  @ApiOkResponse({ type: EscalationPageDto })
  @ApiUnprocessableEntityResponse({
    type: ApiError,
    description: 'INVALID_INPUT or INVALID_CURSOR',
  })
  async list(@Query() query: EscalationsQueryDto): Promise<EscalationPageDto> {
    return unwrap(await this.escalations.list(query));
  }

  @Get('escalations/:id')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    operationId: 'getDirectorEscalation',
    summary: 'One escalation with its source task',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ type: EscalationDto })
  @ApiNotFoundResponse({ type: ApiError, description: 'ESCALATION_NOT_FOUND' })
  async detail(@Param('id') id: string): Promise<EscalationDto> {
    return unwrap(await this.escalations.detail(id));
  }

  @Post('escalations/:id/accept')
  @Header('Cache-Control', 'private, no-store')
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiHeader({ name: 'X-CSRF-Token', required: true, schema: { type: 'string' } })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @CriticalCommand({
    type: 'director.escalation.accept',
    resourceType: 'TaskEscalation',
    topic: 'director.escalation.accepted.v1',
  })
  @ApiBody({ type: DirectorEmptyCommandDto, required: false })
  @ApiOperation({
    operationId: 'acceptDirectorEscalation',
    summary:
      'Take responsibility for an escalated task; the task stays open, the client keeps their manager',
  })
  @ApiOkResponse({ type: EscalationDto })
  @ApiNotFoundResponse({ type: ApiError, description: 'ESCALATION_NOT_FOUND' })
  @ApiConflictResponse({
    type: ApiError,
    description: 'ESCALATION_ALREADY_ACCEPTED, ESCALATION_CLOSED',
  })
  async accept(
    @CurrentTransaction() ctx: CriticalContext,
    @Param('id') id: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    @Body() _body: DirectorEmptyCommandDto,
  ): Promise<EscalationDto> {
    return unwrap(await this.escalations.accept(ctx, id));
  }

  @Get('managers/availability')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    operationId: 'listDirectorManagerAvailability',
    summary: 'Working status of every active manager',
  })
  @ApiOkResponse({ type: ManagerAvailabilityListDto })
  async managers(): Promise<ManagerAvailabilityListDto> {
    return unwrap(await this.escalations.managers());
  }
}
