import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@online-school/db';

export class WorkerHeartbeat {
  private readonly id = `worker:${randomUUID()}`;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private pending: Promise<void> | undefined;
  private stopped = false;
  private stopping: Promise<void> | undefined;
  constructor(
    private readonly db: PrismaClient,
    private readonly onError: () => void,
  ) {}
  async start(): Promise<void> {
    await this.beat();
    const tick = () => {
      if (this.stopped) return;
      this.pending = this.beat()
        .catch(this.onError)
        .finally(() => {
          this.pending = undefined;
          if (!this.stopped) this.timer = setTimeout(tick, 5000);
        });
    };
    this.timer = setTimeout(tick, 5000);
  }
  private async beat(): Promise<void> {
    await this.db.$executeRaw`INSERT INTO runtime_heartbeats(instance_id,component,last_seen_at)
      VALUES (${this.id},'worker',clock_timestamp()) ON CONFLICT(instance_id)
      DO UPDATE SET last_seen_at=clock_timestamp(),stopped_at=NULL`;
  }
  stop(): Promise<void> {
    this.stopping ??= this.finish();
    return this.stopping;
  }
  private async finish(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    await this.pending;
    await this.db
      .$executeRaw`UPDATE runtime_heartbeats SET stopped_at=clock_timestamp() WHERE instance_id=${this.id}`;
  }
}
