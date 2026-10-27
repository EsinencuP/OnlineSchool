import { Inject, Injectable, Logger, Module } from '@nestjs/common';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ok, SERVICE_NAMES } from '@online-school/shared';
import { ScheduleDeadlineModule, ScheduleDeadlines } from '@online-school/api/schedule-deadlines';
import { FinanceExpiryModule, TemporaryAccessExpiry } from '@online-school/api/finance-expiry';
import { HomeworkDraftExpiryModule, HomeworkDraftExpiry } from '@online-school/api/homework-drafts';
import { createPoolClient } from '@online-school/db';
import type { PrismaClient } from '@online-school/db';
import { readOptions, rollback } from './contracts.js';
import { OutboxWorker } from './outbox.js';
import { RecoveryWorker } from './recovery.js';
import type { RecoveryProvider } from './recovery.js';
import { WorkerHeartbeat } from './heartbeat.js';

export const RECOVERY_PROVIDERS = Symbol('RECOVERY_PROVIDERS');

@Injectable()
export class WorkerLifecycle implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Worker');
  private timer: ReturnType<typeof setTimeout> | undefined;
  private running: Promise<void> | undefined;
  private stopped = false;
  private stopping: Promise<void> | undefined;
  private client: PrismaClient | undefined;
  private outbox: OutboxWorker | undefined;
  private recovery: RecoveryWorker | undefined;
  private heartbeat: WorkerHeartbeat | undefined;
  constructor(
    private readonly expiry: TemporaryAccessExpiry,
    private readonly schedule: ScheduleDeadlines,
    private readonly drafts: HomeworkDraftExpiry,
    @Inject(RECOVERY_PROVIDERS) private readonly providers: ReadonlyMap<string, RecoveryProvider>,
  ) {}

  async onModuleInit(): Promise<void> {
    const options = readOptions();
    if (!options.ok) return rollback(options.error.code);
    if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL)
      return rollback('DATABASE_URL_MISSING');
    if (process.env.DATABASE_URL) {
      const connection = createPoolClient();
      if (!connection.ok) return rollback(connection.error.code);
      this.client = connection.value;
      this.outbox = new OutboxWorker(this.client, options.value);
      this.recovery = new RecoveryWorker(this.client, options.value, this.providers);
      this.heartbeat = new WorkerHeartbeat(this.client, () =>
        this.logger.error('WORKER_HEARTBEAT_FAILED'),
      );
      await this.heartbeat.start();
    }
    const started = ok({ service: SERVICE_NAMES.worker });
    this.logger.log(
      `${started.value.service} started; PostgreSQL outbox and reconciliation enabled=${!!this.client}`,
    );
    const tick = () => {
      if (this.stopped) return;
      this.running = this.process()
        .catch(() => this.logger.error('WORKER_POLL_FAILED'))
        .finally(() => {
          this.running = undefined;
          if (!this.stopped) this.timer = setTimeout(tick, options.value.pollMs);
        });
    };
    this.timer = setTimeout(tick, 0);
  }

  private async process(): Promise<void> {
    for (const processor of [this.expiry, this.schedule, this.drafts]) {
      if (this.stopped) return;
      const result = await processor.enabled();
      if (!result.ok) this.logger.error(result.error.code);
    }
    if (!this.stopped) await this.outbox?.processDue();
    if (!this.stopped) await this.recovery?.processDue();
  }

  onModuleDestroy(): Promise<void> {
    this.stopping ??= this.shutdown();
    return this.stopping;
  }
  private async shutdown(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.outbox?.stop();
    this.recovery?.stop();
    await this.running;
    await this.heartbeat?.stop();
    await this.client?.$disconnect();
  }
}

@Module({
  imports: [FinanceExpiryModule, ScheduleDeadlineModule, HomeworkDraftExpiryModule],
  providers: [
    { provide: RECOVERY_PROVIDERS, useValue: new Map<string, RecoveryProvider>() },
    WorkerLifecycle,
  ],
})
export class WorkerModule {}
