import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../core/database/database.module.js';
import { domainError, fail } from '../../core/errors/domain-error.js';
import { tokenHash } from '../../core/session/session.store.js';
import type { HttpRequest } from '../../core/http.js';

@Injectable()
export class AuthRateLimitService {
  constructor(private readonly db: DatabaseService) {}
  async limit(req: HttpRequest, realm: string, identity?: string): Promise<void> {
    const buckets: [string, number][] = [
      [`ip:${req.socket.remoteAddress ?? 'unknown'}:${realm}`, 100],
    ];
    if (identity)
      buckets.push([
        `identity:${realm}:${identity}`,
        realm === 'auth.password' ? 10 : realm === 'student.email.request' ? 5 : 30,
      ]);
    for (const [key, limit] of buckets) {
      const rows = await this.db.client.$queryRaw<{ attempts: number }[]>`
        INSERT INTO auth_rate_limits(id,bucket_key,attempts,window_started_at,expires_at,created_at,updated_at)
        VALUES(gen_random_uuid(),${tokenHash(key)},1,clock_timestamp(),clock_timestamp()+interval '15 minutes',clock_timestamp(),clock_timestamp())
        ON CONFLICT(bucket_key) DO UPDATE SET
          attempts=CASE WHEN auth_rate_limits.expires_at<=clock_timestamp() THEN 1 ELSE auth_rate_limits.attempts+1 END,
          window_started_at=CASE WHEN auth_rate_limits.expires_at<=clock_timestamp() THEN clock_timestamp() ELSE auth_rate_limits.window_started_at END,
          expires_at=CASE WHEN auth_rate_limits.expires_at<=clock_timestamp() THEN clock_timestamp()+interval '15 minutes' ELSE auth_rate_limits.expires_at END,
          updated_at=clock_timestamp() RETURNING attempts
      `;
      if ((rows[0]?.attempts ?? limit + 1) > limit)
        return fail(domainError('AUTH_RATE_LIMITED', 429));
    }
  }
}
