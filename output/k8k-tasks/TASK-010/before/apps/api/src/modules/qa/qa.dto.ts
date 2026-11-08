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

export class FileAccessResponse {
  @ApiProperty({ format: 'uuid' }) objectId!: string;
  @ApiProperty({ enum: [true] }) accessible!: true;
  @ApiProperty() canDownload!: boolean;
}
