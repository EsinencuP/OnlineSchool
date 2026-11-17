import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiServiceUnavailableResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { unwrap } from '../../core/errors/domain-error.js';
import { ApiError } from '../../openapi/dtos.js';
import type { DirectorRequest } from './context/director-context.js';
import { DirectorDecisionsService } from './director-decisions.service.js';
import {
  DECISION_KINDS,
  DecisionCountsDto,
  DecisionDetailDto,
  DecisionPageDto,
  DecisionsQueryDto,
  DirectorMeDto,
} from './dto/director.dto.js';
import { DirectorRoute } from './guards/director-route.decorator.js';
import { DirectorService } from './director.service.js';

@DirectorRoute()
@Controller('api/v1/director')
export class DirectorController {
  constructor(
    private readonly director: DirectorService,
    private readonly decisions: DirectorDecisionsService,
  ) {}

  @Get('me')
  @ApiOperation({
    operationId: 'getDirectorMe',
    summary: 'Director profile with pending decision counters',
  })
  @ApiOkResponse({ type: DirectorMeDto })
  @ApiServiceUnavailableResponse({ type: ApiError, description: 'Data store unavailable' })
  async me(@Req() req: DirectorRequest): Promise<DirectorMeDto> {
    return unwrap(await this.director.me(req.directorCtx!, req.account!));
  }

  @Get('decisions')
  @ApiOperation({
    operationId: 'getDirectorDecisions',
    summary: 'Everything that waits for a director decision, oldest first',
  })
  @ApiOkResponse({ type: DecisionPageDto })
  @ApiUnprocessableEntityResponse({
    type: ApiError,
    description: 'INVALID_INPUT or INVALID_CURSOR',
  })
  async list(@Query() query: DecisionsQueryDto): Promise<DecisionPageDto> {
    return unwrap(await this.decisions.list(query));
  }

  @Get('decisions/summary')
  @ApiOperation({
    operationId: 'getDirectorDecisionSummary',
    summary: 'Pending decisions per kind',
  })
  @ApiOkResponse({ type: DecisionCountsDto })
  async summary(): Promise<DecisionCountsDto> {
    return unwrap(await this.decisions.summary());
  }

  @Get('decisions/:kind/:id')
  @ApiOperation({
    operationId: 'getDirectorDecision',
    summary: 'Facts of one pending decision and the existing commands that decide it',
  })
  @ApiParam({ name: 'kind', enum: DECISION_KINDS })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ type: DecisionDetailDto })
  @ApiNotFoundResponse({ type: ApiError, description: 'Not pending (anymore) or unknown' })
  async detail(@Param('kind') kind: string, @Param('id') id: string): Promise<DecisionDetailDto> {
    return unwrap(await this.decisions.detail(kind, id));
  }
}
