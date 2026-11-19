import { createHash } from 'node:crypto';
import { Body, Controller, Header, HttpCode, Post, Req, SetMetadata } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiProperty, ApiResponse, PickType } from '@nestjs/swagger';
import { Equals, Matches } from 'class-validator';
import { domainError, fail, unwrap } from '../../core/errors/domain-error.js';
import { header, UUID } from '../../core/http.js';
import type { HttpRequest } from '../../core/http.js';
import { Public } from '../../core/rbac/decorators.js';
import { STRICT_INPUT_DTO } from '../../openapi/dto-validation.pipe.js';
import { ApiError } from '../../openapi/dtos.js';
import { AuthRateLimitService } from '../identity/auth-rate-limit.service.js';
import type { CreateLeadDto as LeadInput } from '../manager/dto/manager-lead.dto.js';
import { CreateLeadDto } from '../manager/dto/manager-lead.dto.js';
import { ManagerLeadsService } from '../manager/leads/manager-leads.service.js';

const noticeVersion = /^[A-Za-z0-9._-]{1,60}$/;

@SetMetadata(STRICT_INPUT_DTO, true)
export class PublicLeadSubmissionDto extends PickType(CreateLeadDto, [
  'audience',
  'contactName',
  'guardianName',
  'phone',
  'email',
  'subjectId',
] as const) {
  @ApiProperty()
  @Matches(noticeVersion)
  privacyNoticeVersion!: string;

  @ApiProperty({ enum: [true] })
  @Equals(true)
  privacyNoticeAcknowledged!: true;
}

class PublicLeadReceiptDto {
  @ApiProperty({ enum: ['ACCEPTED'] }) status!: 'ACCEPTED';
}

function configuration() {
  const managerId = process.env.PUBLIC_LEAD_MANAGER_ID ?? '';
  const origin = process.env.PUBLIC_LEAD_ORIGIN ?? '';
  const notice = process.env.PUBLIC_LEAD_PRIVACY_NOTICE_VERSION ?? '';
  const parsed = URL.canParse(origin) ? new URL(origin) : null;
  if (
    !UUID.test(managerId) ||
    !parsed ||
    parsed.origin !== origin ||
    parsed.protocol !== 'https:' ||
    !noticeVersion.test(notice)
  )
    return fail(domainError('PUBLIC_LEAD_UNAVAILABLE', 503));
  return { managerId: managerId.toLowerCase(), origin, notice };
}

@Public()
@Controller('api/v1/public/leads')
export class PublicLeadController {
  constructor(
    private readonly leads: ManagerLeadsService,
    private readonly rate: AuthRateLimitService,
  ) {}

  @Post()
  @HttpCode(202)
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    operationId: 'submitPublicLead',
    summary: 'Submit a public enquiry into the existing CRM and acknowledge the saved request',
  })
  @ApiHeader({
    name: 'X-CSRF-Token',
    required: true,
    description: 'Same-origin anonymous CSRF token',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiResponse({ status: 202, type: PublicLeadReceiptDto })
  @ApiResponse({ status: 409, type: ApiError })
  @ApiResponse({ status: 422, type: ApiError })
  @ApiResponse({ status: 429, type: ApiError })
  @ApiResponse({ status: 503, type: ApiError })
  async submit(
    @Req() req: HttpRequest,
    @Body() body: PublicLeadSubmissionDto,
  ): Promise<PublicLeadReceiptDto> {
    const { managerId, origin, notice } = configuration();
    if (header(req, 'origin') !== origin) return fail(domainError('PUBLIC_ORIGIN_DENIED', 403));
    await this.rate.limit(req, 'public.leads');
    const key = header(req, 'idempotency-key') ?? '';
    if (!UUID.test(key)) return fail(domainError('INVALID_IDEMPOTENCY_KEY', 422));
    if (body.privacyNoticeVersion !== notice)
      return fail(domainError('PRIVACY_NOTICE_CHANGED', 409));
    const phone = body.phone?.replace(/[^0-9]/g, '');
    if (phone !== undefined && !/^\d{6,15}$/.test(phone))
      return fail(domainError('INVALID_CONTACT', 422));
    const input: LeadInput = {
      source: 'SITE',
      audience: body.audience,
      contactName: body.contactName.trim(),
      subjectId: body.subjectId.toLowerCase(),
      ...(body.guardianName ? { guardianName: body.guardianName.trim() } : {}),
      ...(body.phone ? { phone: body.phone.trim() } : {}),
      ...(body.email ? { email: body.email.trim().toLowerCase() } : {}),
    };
    const hash = createHash('sha256')
      .update(JSON.stringify({ input: { ...input, phone }, notice }))
      .digest('hex');
    const result = await this.leads.intake(managerId, input, 'SITE', {
      id: key.toLowerCase(),
      hash,
      notice,
      requestId: req.requestId!,
    });
    if (!result.ok && result.error.code === 'MANAGER_PROFILE_NOT_FOUND')
      return fail(domainError('PUBLIC_LEAD_UNAVAILABLE', 503));
    if (!result.ok && result.error.code === 'SUBJECT_NOT_FOUND')
      return fail(domainError('INVALID_SUBJECT', 422));
    unwrap(result);
    return { status: 'ACCEPTED' };
  }
}
