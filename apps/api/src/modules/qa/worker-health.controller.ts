import { Controller, Get, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../../core/rbac/decorators.js';
import { DatabaseService } from '../../core/database/database.module.js';
import type { HttpResponse } from '../../core/http.js';

@ApiTags('Foundation')
@Controller('api/health/worker')
export class WorkerHealthController {
  constructor(private readonly database: DatabaseService) {}

  @Public()
  @Get()
  @ApiOperation({
    operationId: 'getWorkerHealth',
    summary: 'Check worker heartbeat',
    description:
      'Public liveness only. Returns 503 when no worker heartbeat is fresh; no queue or personal data is exposed.',
  })
  @ApiResponse({ status: 200, description: 'Fresh worker heartbeat in PostgreSQL' })
  @ApiResponse({ status: 503, description: 'Worker or database unavailable' })
  async health(@Res({ passthrough: true }) res: HttpResponse) {
    res.setHeader('Cache-Control', 'no-store');
    try {
      const [row] = await this.database.client.$queryRaw<{ live: boolean }[]>`
        SELECT EXISTS(SELECT 1 FROM runtime_heartbeats
          WHERE component='worker' AND stopped_at IS NULL
          AND last_seen_at > clock_timestamp() - interval '30 seconds') AS live`;
      res.status(row?.live ? 200 : 503);
      return { status: row?.live ? 'ok' : 'unavailable', service: 'worker' };
    } catch {
      res.status(503);
      return { status: 'unavailable', service: 'worker' };
    }
  }
}

@ApiTags('Foundation')
@Controller('api/health')
export class ApiHealthController {
  @Public()
  @Get()
  @ApiOperation({ operationId: 'getApiHealth', summary: 'Check API process liveness' })
  @ApiResponse({
    status: 200,
    description: 'API process is running; database and worker checked separately',
  })
  health(@Res({ passthrough: true }) res: HttpResponse) {
    res.setHeader('Cache-Control', 'no-store');
    return { status: 'ok', service: 'api' };
  }
}
