import { ApiProperty } from '@nestjs/swagger';

export class HealthProbeResponse {
  @ApiProperty({ enum: ['ok', 'unavailable'] }) status!: 'ok' | 'unavailable';
  @ApiProperty({ enum: ['api', 'worker'] }) service!: 'api' | 'worker';
}

export class ComponentStatusResponse {
  @ApiProperty({ enum: ['ok'] }) api!: 'ok';
  @ApiProperty({ enum: ['ok', 'unavailable'] }) db!: 'ok' | 'unavailable';
  @ApiProperty({ enum: ['ok', 'stale', 'stopped', 'unknown'] }) worker!:
    'ok' | 'stale' | 'stopped' | 'unknown';
  @ApiProperty({ type: String, nullable: true }) workerLastSeenAt!: string | null;
  @ApiProperty({ type: String, nullable: true }) migrationVersion!: string | null;
  @ApiProperty({ format: 'date-time' }) checkedAt!: string;
}

export class OutboxHealthCounts {
  @ApiProperty({ type: 'integer', minimum: 0 }) pending!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) ready!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) waitingRetry!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) inFlight!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) expiredLeases!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) dead!: number;
  @ApiProperty({ type: 'integer', minimum: 0, nullable: true }) oldestReadySeconds!: number | null;
}

export class JobHealthCounts {
  @ApiProperty({ type: 'integer', minimum: 0 }) waiting!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) ready!: number;
  @ApiProperty({ type: 'integer', minimum: 0, nullable: true }) oldestReadySeconds!: number | null;
  @ApiProperty({ type: 'integer', minimum: 0 }) running!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) expiredLeases!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) failed!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) reconciliationRequired!: number;
}

export class RecoveryHealthCounts {
  @ApiProperty({ type: 'integer', minimum: 0 }) waiting!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) needsManual!: number;
}

export class DeadOutboxStatus {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() topic!: string;
  @ApiProperty({ type: 'integer', minimum: 0 }) attempts!: number;
  @ApiProperty({ type: String, nullable: true }) lastErrorCode!: string | null;
  @ApiProperty({ format: 'date-time' }) failedAt!: string;
  @ApiProperty({ enum: ['PENDING', 'DELIVERED'], nullable: true })
  replayStatus!: 'PENDING' | 'DELIVERED' | null;
}

export class QueueHealthResponse {
  @ApiProperty({ format: 'date-time' }) checkedAt!: string;
  @ApiProperty({ type: OutboxHealthCounts }) outbox!: OutboxHealthCounts;
  @ApiProperty({ type: JobHealthCounts }) jobs!: JobHealthCounts;
  @ApiProperty({ type: RecoveryHealthCounts }) recovery!: RecoveryHealthCounts;
  @ApiProperty({ type: [DeadOutboxStatus], maxItems: 20 }) latestDead!: DeadOutboxStatus[];
}

export class OutboxReplayResponse {
  @ApiProperty({ format: 'uuid' }) eventId!: string;
  @ApiProperty({ enum: ['QUEUED'] }) status!: 'QUEUED';
}

export class FileAccessResponse {
  @ApiProperty({ format: 'uuid' }) objectId!: string;
  @ApiProperty({ enum: [true] }) accessible!: true;
  @ApiProperty() canDownload!: boolean;
}
