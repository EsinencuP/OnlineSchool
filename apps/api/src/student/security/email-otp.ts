import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { domainError, fail } from '../../core/errors/domain-error.js';
import { email } from '../../modules/identity/input.js';
export const EMAIL_OTP_TTL_MS = 600000;
export const EMAIL_OTP_MAX_ATTEMPTS = 5;
@Injectable()
export class EmailOtp {
  private secret(): Buffer {
    const value = process.env.STUDENT_EMAIL_OTP_SECRET;
    if (!value || !/^[A-Za-z0-9+/]{43}=$/.test(value))
      return fail(domainError('EMAIL_NOT_CONFIGURED', 503));
    const key = Buffer.from(value, 'base64');
    if (key.length !== 32) return fail(domainError('EMAIL_NOT_CONFIGURED', 503));
    return key;
  }
  configured(): void {
    this.secret();
  }
  generate(): string {
    return String(randomInt(0, 1000000)).padStart(6, '0');
  }
  digest(id: string, account: string, address: string, code: string): string {
    return createHmac('sha256', this.secret())
      .update(JSON.stringify(['student-email-v1', id, account, address, code]))
      .digest('hex');
  }
  matches(id: string, account: string, address: string, code: string, stored: string): boolean {
    const actual = Buffer.from(this.digest(id, account, address, code), 'hex');
    const expected = /^[a-f0-9]{64}$/.test(stored) ? Buffer.from(stored, 'hex') : Buffer.alloc(32);
    return timingSafeEqual(actual, expected);
  }
}
@Injectable()
export class EmailOtpMailer {
  configured(): { key: string; from: string } {
    const key = process.env.RESEND_API_KEY,
      from = process.env.STUDENT_EMAIL_FROM;
    if (!key || /[\r\n\s]/.test(key) || !from)
      return fail(domainError('EMAIL_NOT_CONFIGURED', 503));
    try {
      return { key, from: email(from) };
    } catch {
      return fail(domainError('EMAIL_NOT_CONFIGURED', 503));
    }
  }
  async send(id: string, address: string, code: string): Promise<void> {
    const config = this.configured();
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        redirect: 'error',
        headers: {
          Authorization: `Bearer ${config.key}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `student-email/${id}`,
        },
        body: JSON.stringify({
          from: config.from,
          to: [address],
          subject: 'Подтвердите новый email Online Academy',
          text: `Код подтверждения: ${code}\nКод действителен 10 минут. Если вы не меняли email, не сообщайте этот код никому.`,
        }),
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) return fail(domainError('EMAIL_DELIVERY_UNAVAILABLE', 503));
      const body = (await response.json()) as { id?: unknown };
      if (typeof body.id !== 'string' || !body.id.length)
        return fail(domainError('EMAIL_DELIVERY_UNAVAILABLE', 503));
    } catch {
      return fail(domainError('EMAIL_DELIVERY_UNAVAILABLE', 503));
    }
  }
}
