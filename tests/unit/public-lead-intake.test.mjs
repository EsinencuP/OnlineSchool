import '../../apps/api/node_modules/reflect-metadata/Reflect.js';
import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { ManagerLeadsService } from '../../apps/api/dist/modules/manager/leads/manager-leads.service.js';
import {
  PublicLeadController,
  PublicLeadSubmissionDto,
} from '../../apps/api/dist/modules/crm/public-lead.controller.js';
import { DtoValidationPipe } from '../../apps/api/dist/openapi/dto-validation.pipe.js';

const origin = 'https://school.example';
const notice = 'form-v1-ro';
const managerId = randomUUID();
const leadId = randomUUID();
const input = {
  audience: 'ADULT',
  contactName: 'Test Applicant',
  subjectId: randomUUID(),
  phone: '+373 60000000',
  privacyNoticeAcknowledged: true,
  privacyNoticeVersion: notice,
};
const keys = ['PUBLIC_LEAD_ORIGIN', 'PUBLIC_LEAD_MANAGER_ID', 'PUBLIC_LEAD_PRIVACY_NOTICE_VERSION'];
let previous;
beforeEach(() => {
  previous = keys.map((key) => process.env[key]);
  process.env.PUBLIC_LEAD_ORIGIN = origin;
  process.env.PUBLIC_LEAD_MANAGER_ID = managerId;
  process.env.PUBLIC_LEAD_PRIVACY_NOTICE_VERSION = notice;
});
afterEach(() => {
  keys.forEach((key, index) => {
    if (previous[index] === undefined) delete process.env[key];
    else process.env[key] = previous[index];
  });
});

test('the public DTO rejects manager fields, absent contact, or unacknowledged notice', () => {
  const pipe = new DtoValidationPipe();
  const validate = (body) =>
    pipe.transform(body, { type: 'body', metatype: PublicLeadSubmissionDto });
  expect(validate(input)).toMatchObject(input);
  expect(() => validate({ ...input, source: 'PHONE', forceCreate: true })).toThrow();
  expect(() => validate({ ...input, phone: undefined })).toThrow();
  expect(() => validate({ ...input, audience: 'CHILD' })).toThrow();
  expect(() => validate({ ...input, privacyNoticeAcknowledged: 'true' })).toThrow();
});

test('the public route requires the configured origin and returns a PII-free acknowledgement after saving', async () => {
  const leads = { intake: jest.fn(async () => ({ ok: true, value: { leadId } })) };
  const rate = { limit: jest.fn() };
  const controller = new PublicLeadController(leads, rate);
  const key = randomUUID();
  const req = {
    headers: { origin: 'https://untrusted.example', 'idempotency-key': key },
    requestId: randomUUID(),
  };
  await expect(controller.submit(req, input)).rejects.toMatchObject({
    domain: { code: 'PUBLIC_ORIGIN_DENIED' },
  });
  expect(leads.intake).not.toHaveBeenCalled();
  req.headers.origin = origin;
  await expect(controller.submit(req, input)).resolves.toEqual({ status: 'ACCEPTED' });
  expect(rate.limit).toHaveBeenCalledWith(req, 'public.leads');
  expect(leads.intake).toHaveBeenCalledWith(
    managerId,
    {
      audience: 'ADULT',
      contactName: input.contactName,
      subjectId: input.subjectId,
      phone: input.phone,
      source: 'SITE',
    },
    'SITE',
    expect.objectContaining({
      id: key,
      hash: expect.stringMatching(/^[a-f0-9]{64}$/),
      notice,
      requestId: req.requestId,
    }),
  );
  leads.intake.mockResolvedValueOnce({ ok: false, error: { code: 'DATABASE_ERROR', status: 503 } });
  await expect(controller.submit(req, input)).rejects.toMatchObject({
    domain: { code: 'DATABASE_ERROR' },
  });
});

test('a retry of an accepted form returns its existing receipt without writing a second lead', async () => {
  const hash = 'a'.repeat(64);
  const tx = {
    lead: { findUnique: jest.fn(async () => ({ id: leadId, public_submission_hash: hash })) },
    staffAccount: { findFirst: jest.fn() },
  };
  const service = new ManagerLeadsService({ runResult: (fn) => fn(tx) }, {}, {}, {}, {});
  const dto = {
    contactName: input.contactName,
    subjectId: input.subjectId,
    phone: input.phone,
    audience: input.audience,
    source: 'SITE',
  };
  const submission = { id: randomUUID(), hash, notice, requestId: randomUUID() };
  await expect(service.intake(managerId, dto, 'SITE', submission)).resolves.toMatchObject({
    ok: true,
    value: { leadId },
  });
  await expect(
    service.intake(managerId, dto, 'SITE', { ...submission, hash: 'b'.repeat(64) }),
  ).resolves.toMatchObject({
    ok: false,
    error: { code: 'LEAD_SUBMISSION_CONFLICT' },
  });
  expect(tx.staffAccount.findFirst).not.toHaveBeenCalled();
});
