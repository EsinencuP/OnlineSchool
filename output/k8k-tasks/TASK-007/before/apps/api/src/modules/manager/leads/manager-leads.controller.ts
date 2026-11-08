import {
  applyDecorators,
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTooManyRequestsResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import {
  CriticalCommand,
  CurrentTransaction,
} from '../../../core/idempotency/idempotency.module.js';
import type { CriticalContext } from '../../../core/http.js';
import { unwrap } from '../../../core/errors/domain-error.js';
import { ApiError } from '../../../openapi/dtos.js';
import { ManagerRoute } from '../guards/manager-route.decorator.js';
import type { ManagerRequest } from '../context/manager-context.js';
import {
  CreateLeadDto,
  UpdateLeadDto,
  ListLeadsQueryDto,
  LeadDto,
  LeadPageDto,
  LeadSummaryDto,
  LeadVersionDto,
  ScheduleTrialDto,
  TransitionLeadDto,
  LoseLeadDto,
} from '../dto/manager-lead.dto.js';
import { ManagerLeadsService } from './manager-leads.service.js';
import { ManagerLeadsGuard } from './manager-leads.guard.js';
const command = (type: string, status: 200 | 201 = 200) =>
  applyDecorators(
    Header('Cache-Control', 'private, no-store'),
    ApiHeader({
      name: 'Idempotency-Key',
      required: true,
      schema: { type: 'string', format: 'uuid' },
    }),
    ApiHeader({ name: 'X-CSRF-Token', required: true }),
    CriticalCommand({
      type: `manager.lead.${type}`,
      resourceType: 'Lead',
      resultIdField: 'leadId',
      topic: `manager.lead.command-${type}.v1`,
      successStatus: status,
      conflictOnPayloadMismatch: true,
      errorCodeMap: { CALENDAR_CONFLICT: 'SLOT_CONFLICT' },
    }),
  );
const durable = (v: LeadDto): LeadDto => ({
  ...v,
  trial: v.trial ? { ...v.trial, meetLink: null, feedbackSummary: null } : null,
});
@UseGuards(ManagerLeadsGuard)
@ManagerRoute()
@ApiBadRequestResponse({ type: ApiError })
@ApiNotFoundResponse({ type: ApiError, description: 'LEAD_NOT_FOUND, SUBJECT_NOT_FOUND' })
@ApiConflictResponse({
  type: ApiError,
  description:
    'LEAD_DUPLICATE_SUSPECTED, LEAD_VERSION_CONFLICT, INVALID_STAGE_TRANSITION, TRIAL_ALREADY_SCHEDULED, TRIAL_OUTCOME_REQUIRED, LEAD_TERMINAL, SLOT_CONFLICT',
})
@ApiUnprocessableEntityResponse({ type: ApiError })
@ApiServiceUnavailableResponse({ type: ApiError })
@ApiTooManyRequestsResponse({ type: ApiError, description: 'LEAD_RATE_LIMITED' })
@Controller('api/v1/manager/leads')
export class ManagerLeadsController {
  constructor(private readonly leads: ManagerLeadsService) {}
  @Get()
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({ operationId: 'listManagerLeads' })
  @ApiOkResponse({ type: LeadPageDto })
  async list(@Req() r: ManagerRequest, @Query() q: ListLeadsQueryDto) {
    return unwrap(await this.leads.list(r.managerCtx!, q));
  }
  @Get('summary')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({ operationId: 'getManagerLeadSummary' })
  @ApiOkResponse({ type: LeadSummaryDto })
  async summary(@Req() r: ManagerRequest) {
    return unwrap(await this.leads.summary(r.managerCtx!));
  }
  @Get(':leadId')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({ operationId: 'getManagerLead' })
  @ApiOkResponse({ type: LeadDto })
  async get(@Req() r: ManagerRequest, @Param('leadId') id: string) {
    return unwrap(await this.leads.get(r.managerCtx!, id));
  }
  @Post()
  @ApiOperation({ operationId: 'createManagerLead' })
  @ApiCreatedResponse({ type: LeadDto })
  @command('create', 201)
  async create(
    @Req() r: ManagerRequest,
    @Body() dto: CreateLeadDto,
    @CurrentTransaction() c: CriticalContext,
  ) {
    return durable(unwrap(await this.leads.create(r.managerCtx!, dto, r.idempotencyKey!, c)));
  }
  @Patch(':leadId')
  @ApiOperation({ operationId: 'updateManagerLead' })
  @ApiOkResponse({ type: LeadDto })
  @command('update')
  async update(
    @Req() r: ManagerRequest,
    @Param('leadId') id: string,
    @Body() dto: UpdateLeadDto,
    @CurrentTransaction() c: CriticalContext,
  ) {
    return durable(unwrap(await this.leads.update(r.managerCtx!, id, dto, c)));
  }
  @Post(':leadId/claim')
  @ApiOperation({ operationId: 'claimManagerLead' })
  @ApiOkResponse({ type: LeadDto })
  @command('claim')
  async claim(
    @Req() r: ManagerRequest,
    @Param('leadId') id: string,
    @Body() dto: LeadVersionDto,
    @CurrentTransaction() c: CriticalContext,
  ) {
    return durable(unwrap(await this.leads.claim(r.managerCtx!, id, dto.version, c)));
  }
  @Post(':leadId/trial')
  @ApiOperation({ operationId: 'scheduleManagerTrial' })
  @ApiOkResponse({ type: LeadDto })
  @command('trial')
  async trial(
    @Req() r: ManagerRequest,
    @Param('leadId') id: string,
    @Body() dto: ScheduleTrialDto,
    @CurrentTransaction() c: CriticalContext,
  ) {
    return durable(
      unwrap(await this.leads.scheduleTrial(r.managerCtx!, id, dto, r.idempotencyKey!, c)),
    );
  }
  @Post(':leadId/transition')
  @ApiOperation({ operationId: 'transitionManagerLead' })
  @ApiOkResponse({ type: LeadDto })
  @command('transition')
  async transition(
    @Req() r: ManagerRequest,
    @Param('leadId') id: string,
    @Body() dto: TransitionLeadDto,
    @CurrentTransaction() c: CriticalContext,
  ) {
    return durable(unwrap(await this.leads.transition(r.managerCtx!, id, dto, c)));
  }
  @Post(':leadId/lose')
  @ApiOperation({ operationId: 'loseManagerLead' })
  @ApiOkResponse({ type: LeadDto })
  @command('lose')
  async lose(
    @Req() r: ManagerRequest,
    @Param('leadId') id: string,
    @Body() dto: LoseLeadDto,
    @CurrentTransaction() c: CriticalContext,
  ) {
    return durable(unwrap(await this.leads.lose(r.managerCtx!, id, dto, c)));
  }
  @Post(':leadId/reopen')
  @ApiOperation({ operationId: 'reopenManagerLead' })
  @ApiOkResponse({ type: LeadDto })
  @command('reopen')
  async reopen(
    @Req() r: ManagerRequest,
    @Param('leadId') id: string,
    @Body() dto: LeadVersionDto,
    @CurrentTransaction() c: CriticalContext,
  ) {
    return durable(unwrap(await this.leads.reopen(r.managerCtx!, id, dto.version, c)));
  }
}
