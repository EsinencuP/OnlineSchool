import { Body, Controller, Get, Header, Post, Query, Req } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { CriticalContext } from '../../../core/http.js';
import {
  CriticalCommand,
  CurrentTransaction,
} from '../../../core/idempotency/idempotency.module.js';
import { unwrap } from '../../../core/errors/domain-error.js';
import { ApiError } from '../../../openapi/dtos.js';
import type { ManagerRequest } from '../context/manager-context.js';
import { ManagerRoute } from '../guards/manager-route.decorator.js';
import {
  ContactDto,
  ContactPageDto,
  ListContactsQueryDto,
  PendingContactsDto,
  RecordContactDto,
} from './manager-contacts.dto.js';
import { ManagerContactsService } from './manager-contacts.service.js';

@ManagerRoute()
@Controller('api/v1/manager/contacts')
export class ManagerContactsController {
  constructor(private readonly contacts: ManagerContactsService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    operationId: 'listManagerContacts',
    summary: 'Contact history of one lead, student or own-portfolio teacher, newest first',
  })
  @ApiOkResponse({ type: ContactPageDto })
  @ApiNotFoundResponse({ type: ApiError, description: 'CONTACT_SUBJECT_NOT_FOUND' })
  @ApiUnprocessableEntityResponse({
    type: ApiError,
    description: 'CONTACT_SUBJECT_REQUIRED, INVALID_CURSOR',
  })
  async list(@Req() r: ManagerRequest, @Query() q: ListContactsQueryDto) {
    return unwrap(await this.contacts.list(r.managerCtx!, q));
  }

  @Get('pending')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    operationId: 'listManagerPendingContacts',
    summary: 'Open contact obligations from tasks with the latest recorded result (MGR-04)',
  })
  @ApiOkResponse({ type: PendingContactsDto })
  async pending(@Req() r: ManagerRequest) {
    return unwrap(await this.contacts.pending(r.managerCtx!));
  }

  @Post()
  @Header('Cache-Control', 'private, no-store')
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiHeader({ name: 'X-CSRF-Token', required: true })
  @CriticalCommand({
    type: 'manager.contact.record',
    resourceType: 'ContactLog',
    resultIdField: 'contactId',
    topic: 'manager.contact.recorded.v1',
    successStatus: 201,
    conflictOnPayloadMismatch: true,
  })
  @ApiOperation({
    operationId: 'recordManagerContact',
    summary:
      'Record a manual contact attempt or conversation. Append-only: fix mistakes with correctsId. Sends nothing to the family.',
  })
  @ApiCreatedResponse({ type: ContactDto })
  @ApiNotFoundResponse({
    type: ApiError,
    description:
      'CONTACT_SUBJECT_NOT_FOUND, CONTACT_NOT_FOUND, REPRESENTATIVE_NOT_FOUND, TASK_NOT_FOUND',
  })
  @ApiConflictResponse({ type: ApiError, description: 'CONTACT_ALREADY_CORRECTED' })
  @ApiUnprocessableEntityResponse({
    type: ApiError,
    description: 'CONTACT_SUBJECT_REQUIRED, CONTACT_SUBJECT_MISMATCH, CONTACT_IN_FUTURE',
  })
  async record(
    @Req() r: ManagerRequest,
    @Body() dto: RecordContactDto,
    @CurrentTransaction() c: CriticalContext,
  ) {
    return unwrap(await this.contacts.record(r.managerCtx!, dto, c));
  }
}
