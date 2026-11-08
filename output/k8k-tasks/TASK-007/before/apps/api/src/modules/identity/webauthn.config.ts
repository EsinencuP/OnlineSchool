import { Injectable } from '@nestjs/common';
import { err, ok } from '@online-school/shared';
import type { Result } from '@online-school/shared';
import { domainError, unwrap } from '../../core/errors/domain-error.js';
import type { DomainError } from '../../core/errors/domain-error.js';

export type WebAuthnSettings = { rpId: string; origin: string; rpName: string };
export function webAuthnSettings(
  env: NodeJS.ProcessEnv = process.env,
): Result<WebAuthnSettings, DomainError> {
  try {
    const rpId = env.WEBAUTHN_RP_ID ?? '';
    const raw = env.WEBAUTHN_ALLOWED_ORIGIN ?? '';
    const origin = new URL(raw);
    if (
      !/^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(rpId) ||
      raw !== origin.origin ||
      origin.protocol !== 'https:' ||
      origin.username ||
      origin.password ||
      origin.port ||
      origin.hostname !== rpId ||
      rpId === 'vercel.app'
    )
      return err(domainError('WEBAUTHN_CONFIGURATION_INVALID', 503));
    return ok({ rpId, origin: origin.origin, rpName: 'OnlineSchool' });
  } catch {
    return err(domainError('WEBAUTHN_CONFIGURATION_INVALID', 503));
  }
}
@Injectable()
export class WebAuthnConfig {
  get settings(): WebAuthnSettings {
    return unwrap(webAuthnSettings());
  }
}
