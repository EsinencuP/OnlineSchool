import { Inject, Injectable } from '@nestjs/common';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CACHE_MANAGER, CacheInterceptor } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { lastValueFrom, of } from 'rxjs';
import type { Observable } from 'rxjs';
import { domainError, fail } from '../../core/errors/domain-error.js';
import { MEET_LATE_MS } from '../lessons/meet-access.js';
import type { IStudentContext, StudentRequest } from '../student-context.interface.js';
import type { DashboardResponseDto } from './dashboard.dto.js';
import { DashboardService } from './dashboard.service.js';

type Summary = Omit<DashboardResponseDto, 'nextLesson'>;
interface Entry {
  revision: string;
  value: Summary;
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
    const key = `dashboard:summary:${student.studentProfileId}`;
    const revision = await this.version(student.studentProfileId);
    const entry = await this.store.get<Entry>(key).catch(() => undefined);
    if (entry && entry.revision === revision && entry.expiresAt > Date.now())
      return of(await this.withFreshLesson(entry.value, student, revision));
    if (entry) await this.store.del(key).catch(() => undefined);

    const pendingKey = `${key}:${revision}`;
    const running = this.pending.get(pendingKey);
    if (running) {
      // A concurrent request shares the summary only, never the other request's capability.
      return of(await this.withFreshLesson(this.summary(await running), student, revision));
    }
    const pending = this.load(next, key, student.studentProfileId, revision);
    this.pending.set(pendingKey, pending);
    try {
      return of(this.beforeResponse(await pending));
    } finally {
      if (this.pending.get(pendingKey) === pending) this.pending.delete(pendingKey);
    }
  }

  private summary({
    homework,
    subscription,
    skillProgress,
    generatedAt,
  }: DashboardResponseDto): Summary {
    return { homework, subscription, skillProgress, generatedAt };
  }

  private async version(studentId: string): Promise<string> {
    try {
      return await this.dashboard.revision(studentId);
    } catch {
      return fail(domainError('DASHBOARD_UNAVAILABLE', 503));
    }
  }

  private async verifyRevision(studentId: string, revision: string) {
    if ((await this.version(studentId)) !== revision)
      return fail(domainError('DASHBOARD_REFRESH_REQUIRED', 503));
  }

  private beforeResponse(value: DashboardResponseDto): DashboardResponseDto {
    const lesson = value.nextLesson;
    const expired = lesson && Date.now() > Date.parse(lesson.scheduledAt) + MEET_LATE_MS;
    return structuredClone(expired ? { ...value, nextLesson: null } : value);
  }

  private async withFreshLesson(summary: Summary, student: IStudentContext, revision: string) {
    const nextLesson = await this.dashboard
      .currentLesson(student)
      .catch(() => fail(domainError('DASHBOARD_UNAVAILABLE', 503)));
    await this.verifyRevision(student.studentProfileId, revision);
    return this.beforeResponse({ ...summary, nextLesson });
  }

  private async load(next: CallHandler, key: string, studentId: string, revision: string) {
    const value = await lastValueFrom<DashboardResponseDto>(next.handle());
    await this.verifyRevision(studentId, revision);
    const ttl = 30_000;
    await this.store
      .set(key, { revision, value: this.summary(value), expiresAt: Date.now() + ttl }, ttl)
      .catch(() => undefined);
    return value;
  }
}
