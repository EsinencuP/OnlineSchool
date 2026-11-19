import { err, ok } from '@online-school/shared';
import type { Result } from '@online-school/shared';
import { MEET_LINK_REGEX } from '../meet-link.js';

export const GOOGLE_MEET_CREATED_SCOPE = 'https://www.googleapis.com/auth/meetings.space.created';
const api = 'https://meet.googleapis.com/v2';
const resourcePattern = /^spaces\/[A-Za-z0-9_-]{1,121}$/;
const codePattern = /^[a-z]{3}-[a-z]{4}-[a-z]{3}$/;

export type GoogleMeetSpace = {
  name: string;
  meetingUri: string;
  meetingCode: string;
  privacySettings: 'DISABLED' | 'ENABLED' | 'UNVERIFIED';
};

export type GoogleMeetError = {
  code:
    | 'AUTHORIZATION_REQUIRED'
    | 'PERMISSION_DENIED'
    | 'RATE_LIMITED'
    | 'RESOURCE_NOT_FOUND'
    | 'REFERENCE_UNVERIFIED'
    | 'INVALID_REFERENCE'
    | 'PROVIDER_REJECTED'
    | 'PROVIDER_UNAVAILABLE'
    | 'UNEXPECTED_RESPONSE'
    | 'CREATE_OUTCOME_UNKNOWN';
  httpStatus?: number;
  retryAfterMs?: number;
};

type Reply = Result<GoogleMeetSpace, GoogleMeetError>;

const createSpaceConfig = {
  accessType: 'RESTRICTED',
  attendanceReportGenerationType: 'DO_NOT_GENERATE',
  artifactConfig: {
    recordingConfig: { autoRecordingGeneration: 'OFF' },
    transcriptionConfig: { autoTranscriptionGeneration: 'OFF' },
    smartNotesConfig: { autoSmartNotesGeneration: 'OFF' },
  },
} as const;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function isGoogleMeetResourceName(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    resourcePattern.test(value) &&
    !codePattern.test(value.slice(7).toLowerCase())
  );
}

export function isGoogleAccessToken(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 4096 && /^[a-zA-Z0-9._~+/-]+=*$/.test(value);
}

function parseSpace(value: unknown): GoogleMeetSpace | null {
  const { name, meetingUri, meetingCode, config } = record(value);
  if (
    !isGoogleMeetResourceName(name) ||
    typeof meetingUri !== 'string' ||
    !MEET_LINK_REGEX.test(meetingUri) ||
    typeof meetingCode !== 'string' ||
    meetingUri !== `https://meet.google.com/${meetingCode}`
  )
    return null;
  const { accessType, attendanceReportGenerationType, artifactConfig } = record(config);
  const { recordingConfig, transcriptionConfig, smartNotesConfig } = record(artifactConfig);
  const artifacts = [
    record(recordingConfig).autoRecordingGeneration,
    record(transcriptionConfig).autoTranscriptionGeneration,
    record(smartNotesConfig).autoSmartNotesGeneration,
  ];
  const privacySettings =
    (typeof accessType === 'string' && ['OPEN', 'TRUSTED'].includes(accessType)) ||
    attendanceReportGenerationType === 'GENERATE_REPORT' ||
    artifacts.includes('ON')
      ? 'ENABLED'
      : accessType === 'RESTRICTED' &&
          attendanceReportGenerationType === 'DO_NOT_GENERATE' &&
          artifacts.every((setting) => setting === 'OFF')
        ? 'DISABLED'
        : 'UNVERIFIED';
  return { name, meetingUri, meetingCode, privacySettings };
}

function retryAfterMs(value: string | null): number | undefined {
  if (!value || value.length > 64) return undefined;
  const milliseconds = /^\d+$/.test(value) ? Number(value) * 1000 : Date.parse(value) - Date.now();
  return Number.isFinite(milliseconds) && milliseconds >= 0 ? milliseconds : undefined;
}

function providerError(
  response: Response,
  method: 'GET' | 'POST',
  alias: boolean,
): GoogleMeetError {
  const httpStatus = response.status;
  if (httpStatus === 401) return { code: 'AUTHORIZATION_REQUIRED', httpStatus };
  if (httpStatus === 403) return { code: 'PERMISSION_DENIED', httpStatus };
  if (httpStatus === 429) {
    const delay = retryAfterMs(response.headers.get('Retry-After'));
    return {
      code: 'RATE_LIMITED',
      httpStatus,
      ...(delay === undefined ? {} : { retryAfterMs: delay }),
    };
  }
  if (httpStatus === 404 && method === 'GET')
    return { code: alias ? 'REFERENCE_UNVERIFIED' : 'RESOURCE_NOT_FOUND', httpStatus };
  if (method === 'POST' && ![400, 404, 405, 412, 422].includes(httpStatus))
    return { code: 'CREATE_OUTCOME_UNKNOWN', httpStatus };
  if (httpStatus === 408 || httpStatus >= 500) return { code: 'PROVIDER_UNAVAILABLE', httpStatus };
  return { code: 'PROVIDER_REJECTED', httpStatus };
}

/** One HTTP attempt. Only a caller with the durable operation state can decide whether to retry. */
export class GoogleMeetClient {
  constructor(private readonly fetcher: typeof fetch = fetch) {}

  createSpace(token: string): Promise<Reply> {
    return this.request('POST', 'spaces', token);
  }

  async getSpace(token: string, name: string): Promise<Reply> {
    if (!isGoogleMeetResourceName(name)) return err({ code: 'INVALID_REFERENCE' });
    return this.request('GET', name, token);
  }

  async checkMeetingCode(token: string, code: string): Promise<Reply> {
    if (!codePattern.test(code)) return err({ code: 'INVALID_REFERENCE' });
    return this.request('GET', `spaces/${code}`, token, true);
  }

  private async request(
    method: 'GET' | 'POST',
    resource: string,
    token: string,
    alias = false,
  ): Promise<Reply> {
    if (!isGoogleAccessToken(token)) return err({ code: 'AUTHORIZATION_REQUIRED' });
    const create = method === 'POST';
    const unknown = (): GoogleMeetError => ({
      code: create ? 'CREATE_OUTCOME_UNKNOWN' : 'UNEXPECTED_RESPONSE',
    });
    try {
      const response = await this.fetcher(
        `${api}/${resource}?fields=name,meetingUri,meetingCode,config`,
        {
          method,
          redirect: 'error',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            ...(create ? { 'Content-Type': 'application/json' } : {}),
          },
          ...(create ? { body: JSON.stringify({ config: createSpaceConfig }) } : {}),
          signal: AbortSignal.timeout(5000),
        },
      );
      if (!response.ok) {
        const failure = providerError(response, method, alias);
        if (response.body) await response.body.cancel().catch(() => {});
        return err(failure);
      }
      const reply = await response.json().catch(() => null);
      const space = parseSpace(reply);
      if (
        !space ||
        (!create && (alias ? `spaces/${space.meetingCode}` !== resource : space.name !== resource))
      )
        return err(unknown());
      return ok(space);
    } catch {
      return err(create ? unknown() : { code: 'PROVIDER_UNAVAILABLE' });
    }
  }
}
