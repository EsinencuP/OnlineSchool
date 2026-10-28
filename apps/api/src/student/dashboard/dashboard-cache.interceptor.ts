import { Inject, Injectable } from '@nestjs/common';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CACHE_MANAGER, CacheInterceptor } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { lastValueFrom, of } from 'rxjs';
import type { Observable } from 'rxjs';
import { domainError, fail } from '../../core/errors/domain-error.js';
import type { StudentRequest } from '../student-context.interface.js';
import type { DashboardResponseDto } from './dashboard.dto.js';
import { DashboardService } from './dashboard.service.js';

interface Entry {
  revision: string;
  value: DashboardResponseDto;
  expiresAt: number;
}

@Injectable()
export class DashboardCacheInterceptor extends CacheInterceptor {
  private readonly pending = new Map<string, Promise<DashboardResponseDto>>();
  constructor(
    @Inject(CACHE_MANAGER) private readonly store: Cache,
    reflector: Reflector,
    private readonly dashboard: DashboardService,
  ) {
    super(store, reflector);
  }

  override async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<DashboardResponseDto>> {
    const student = context.switchToHttp().getRequest<StudentRequest>().studentCtx;
    if (!student) return fail(domainError('STUDENT_PROFILE_NOT_FOUND', 403));
    const key = `dashboard:${student.studentProfileId}`;
    const revision = await this.version(student.studentProfileId);
    const entry = await this.store.get<Entry>(key).catch(() => undefined);
    if (entry && entry.revision === revision && entry.expiresAt > Date.now())
      return of(structuredClone(entry.value));
    if (entry) await this.store.del(key).catch(() => undefined);
    const pendingKey = `${key}:${revision}`;
    let pending = this.pending.get(pendingKey);
    if (!pending) {
      pending = this.load(next, key, student.studentProfileId, revision);
      this.pending.set(pendingKey, pending);
    }
    try {
      return of(structuredClone(await pending));
    } finally {
      if (this.pending.get(pendingKey) === pending) this.pending.delete(pendingKey);
    }
  }

  private async version(studentId: string): Promise<string> {
    try {
      return await this.dashboard.revision(studentId);
    } catch {
      return fail(domainError('DASHBOARD_UNAVAILABLE', 503));
    }
  }

  private async load(next: CallHandler, key: string, studentId: string, revision: string) {
    const value = await lastValueFrom<DashboardResponseDto>(next.handle());
    // A commit during aggregation must not publish a mixed/stale snapshot into the cache.
    if ((await this.version(studentId)) !== revision)
      return fail(domainError('DASHBOARD_REFRESH_REQUIRED', 503));
    const now = Date.now();
    let ttl = 30000;
    if (value.nextLesson) {
      const start = Date.parse(value.nextLesson.scheduledAt);
      if (start <= now) return { ...value, nextLesson: null };
      const windowOpens = start - 10 * 60000;
      const generated = Date.parse(value.generatedAt);
      ttl = Math.min(ttl, (windowOpens > generated ? windowOpens : start) - now);
    }
    // Never pass TTL=0: cache-manager treats it as an entry that does not expire.
    if (ttl > 0)
      await this.store
        .set(key, { revision, value, expiresAt: now + ttl }, ttl)
        .catch(() => undefined);
    return value;
  }
}
