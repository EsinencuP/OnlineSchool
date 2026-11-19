import { Inject, Injectable, Logger, Module } from '@nestjs/common';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ok, SERVICE_NAMES } from '@online-school/shared';
import { ScheduleDeadlineModule, ScheduleDeadlines } from '@online-school/api/schedule-deadlines';
import { FinanceExpiryModule, TemporaryAccessExpiry } from '@online-school/api/finance-expiry';
import { HomeworkDraftExpiryModule, HomeworkDraftExpiry } from '@online-school/api/homework-drafts';
import {
  ManagerSubscriptionLifecycleModule,
  ManagerSubscriptionExpiry,
} from '@online-school/api/manager-subscription-lifecycle';
import {
  ManagerTaskEscalationModule,
  ManagerTaskEscalation,
} from '@online-school/api/manager-task-escalation';
import { createPoolClient } from '@online-school/db';
import type { PrismaClient } from '@online-school/db';
import { readOptions, rollback } from './contracts.js';
import { OutboxWorker } from './outbox.js';
import { ExpiredUploadCleanup, expiredUploadHandler } from './expired-upload-cleanup.js';
import { createHandlers } from './handlers.js';
import { RecoveryWorker } from './recovery.js';
import type { RecoveryProvider } from './recovery.js';
import { WorkerHeartbeat } from './heartbeat.js';
import { NotificationService } from '@online-school/api/notifications';
import { StudentNotificationProjector } from './notifications.js';
import {
  PdfExportWorker,
  EducationExportSupportModule,
  MeService,
  PrivateUploads,
} from './pdf-exports.js';

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
  private uploadCleanup: ExpiredUploadCleanup | undefined;
  private recovery: RecoveryWorker | undefined;
  private heartbeat: WorkerHeartbeat | undefined;
  private pdf: PdfExportWorker | undefined;
  private pdfRunning: Promise<void> | undefined;
  private notifications: StudentNotificationProjector | undefined;
  private notificationsRunning: Promise<void> | undefined;
  constructor(
    private readonly expiry: TemporaryAccessExpiry,
    private readonly schedule: ScheduleDeadlines,
    private readonly drafts: HomeworkDraftExpiry,
    private readonly me: MeService,
    private readonly pdfStorage: PrivateUploads,
    @Inject(RECOVERY_PROVIDERS) private readonly providers: ReadonlyMap<string, RecoveryProvider>,
    private readonly subscriptions: ManagerSubscriptionExpiry,
    private readonly escalation: ManagerTaskEscalation,
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
      const cleanupEnabled = process.env.S3_UPLOAD_CLEANUP_ENABLED === 'true';
      const cleanupHandler = cleanupEnabled ? expiredUploadHandler(this.pdfStorage) : undefined;
      if (cleanupEnabled)
        this.uploadCleanup = new ExpiredUploadCleanup(this.client, this.pdfStorage);
      this.outbox = new OutboxWorker(this.client, options.value, createHandlers(cleanupHandler));
      this.recovery = new RecoveryWorker(this.client, options.value, this.providers);
      this.pdf = new PdfExportWorker(this.client, this.me, this.pdfStorage);
      this.notifications = new StudentNotificationProjector(this.client, new NotificationService());
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
    const stages = [
      ['ACCESS_EXPIRY_POLL_FAILED', () => this.expiry.enabled()],
      ['SCHEDULE_DEADLINE_POLL_FAILED', () => this.schedule.enabled()],
      ['HOMEWORK_DRAFT_EXPIRY_POLL_FAILED', () => this.drafts.enabled()],
      ['SUBSCRIPTION_EXPIRY_POLL_FAILED', () => this.subscriptions.enabled()],
      ['TASK_ESCALATION_POLL_FAILED', () => this.escalation.enabled()],
      [
        'UPLOAD_CLEANUP_POLL_FAILED',
        async () => {
          await this.uploadCleanup?.enqueueDue();
        },
      ],
      [
        'OUTBOX_POLL_FAILED',
        async () => {
          await this.outbox?.processDue();
        },
      ],
      [
        'RECOVERY_POLL_FAILED',
        async () => {
          await this.recovery?.processDue();
        },
      ],
    ] as const;
    for (const [code, poll] of stages) {
      if (this.stopped) return;
      try {
        const result = await poll();
        if (result && !result.ok) this.logger.error(result.error.code);
      } catch {
        this.logger.error(code);
      }
    }
    if (!this.stopped && this.notifications && !this.notificationsRunning) {
      this.notificationsRunning = this.notifications
        .processDue()
        .then(
          () => {},
          () => this.logger.error('NOTIFICATION_POLL_FAILED'),
        )
        .finally(() => {
          this.notificationsRunning = undefined;
        });
    }
    // PDF work yields while rendering and must not postpone finance/schedule
    // polling. Only one PDF attempt may run in this process at a time.
    if (!this.stopped && this.pdf && !this.pdfRunning) {
      this.pdfRunning = this.pdf
        .processDue()
        .then(
          () => {},
          () => this.logger.error('PDF_EXPORT_POLL_FAILED'),
        )
        .finally(() => {
          this.pdfRunning = undefined;
        });
    }
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
    this.pdf?.stop();
    this.notifications?.stop();
    await this.running;
    await this.pdfRunning;
    await this.notificationsRunning;
    await this.heartbeat?.stop();
    await this.client?.$disconnect();
  }
}

@Module({
  imports: [
    FinanceExpiryModule,
    ManagerSubscriptionLifecycleModule,
    ManagerTaskEscalationModule,
    ScheduleDeadlineModule,
    HomeworkDraftExpiryModule,
    EducationExportSupportModule,
  ],
  providers: [
    { provide: RECOVERY_PROVIDERS, useValue: new Map<string, RecoveryProvider>() },
    WorkerLifecycle,
  ],
})
export class WorkerModule {}
