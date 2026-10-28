import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { err, ok } from '@online-school/shared';
import type { Result } from '@online-school/shared';
import type { DomainError } from '../../core/errors/domain-error.js';
import { domainError } from '../../core/errors/domain-error.js';

const parameters = { N: 131072, r: 8, p: 1, maxmem: 192 * 1024 * 1024 };
const prefix = '$scrypt$v=1$N=131072,r=8,p=1$';
const derive = (password: string, salt: Buffer): Promise<Buffer> =>
  new Promise((resolve, reject) =>
    scrypt(password, salt, 64, parameters, (error, key) => (error ? reject(error) : resolve(key))),
  );
@Injectable()
export class Passwords {
  async hash(
    password: string,
    policy: 'standard' | 'student' = 'standard',
  ): Promise<Result<string, DomainError>> {
    if (
      password.length < (policy === 'student' ? 8 : 12) ||
      password.length > (policy === 'student' ? 128 : 256) ||
      (policy === 'student' && !/^(?=.*[A-Za-z])(?=.*\d).+$/.test(password))
    )
      return err(domainError('PASSWORD_LENGTH_INVALID', 400));
    try {
      const salt = randomBytes(16);
      const key = await derive(password, salt);
      return ok(`${prefix}${salt.toString('base64url')}$${key.toString('base64url')}`);
    } catch {
      return err(domainError('PASSWORD_SERVICE_UNAVAILABLE', 503));
    }
  }
  async verify(password: string, stored: string | null): Promise<boolean> {
    const parts = stored?.startsWith(prefix) ? stored.slice(prefix.length).split('$') : [];
    const valid =
      parts.length === 2 &&
      /^[A-Za-z0-9_-]{22}$/.test(parts[0] ?? '') &&
      /^[A-Za-z0-9_-]{86}$/.test(parts[1] ?? '');
    const salt = valid ? Buffer.from(parts[0]!, 'base64url') : Buffer.alloc(16);
    const expected = valid ? Buffer.from(parts[1]!, 'base64url') : Buffer.alloc(64);
    // Unknown account and malformed stored hashes still perform the same expensive KDF.
    const actual = await derive(password, salt);
    return timingSafeEqual(actual, expected) && valid;
  }
}
