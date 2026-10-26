import * as ApiDto from './openapi/dtos.js';
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Controller, Get, Module } from '@nestjs/common';
import type { HealthResponse } from '@online-school/api-contracts';
import { ok, SERVICE_NAMES } from '@online-school/shared';
import { FinanceModule } from './modules/finance/finance.module.js';
import { IdentityModule } from './modules/identity/identity.module.js';
import { CrmModule } from './modules/crm/crm.module.js';
import { ScheduleModule } from './modules/schedule/schedule.module.js';
import { EducationModule } from './modules/education/education.module.js';
import { StorageModule } from './modules/storage/storage.module.js';
import { IntegrationsModule } from './modules/integrations/integrations.module.js';
import { CoreModule } from './core/core.module.js';
import { Public } from './core/rbac/decorators.js';
import { QaModule } from './modules/qa/qa.module.js';

@Controller('health')
export class HealthController {
  @ApiOperation({
    operationId: 'getHealth',
    summary: 'Get health',
    description: 'Process liveness only; does not verify database or release readiness.',
  })
  @ApiResponse({
    status: 200,
    type: ApiDto.HealthResponse,
    description: 'Successful response',
    headers: { 'X-Request-ID': { schema: { type: 'string', format: 'uuid' } } },
  })
  @ApiResponse({ status: 400, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 401, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 403, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 409, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 422, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiResponse({ status: 503, type: ApiDto.ApiError, description: 'Unified domain/security error' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    schema: { type: 'string', format: 'uuid' },
    description: 'Required for critical business commands; reuse only for identical payload',
  })
  @ApiHeader({ name: 'X-Request-ID', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiTags('Foundation')
  @Get()
  @Public()
  getHealth(): HealthResponse {
    const health = ok<HealthResponse>({ status: 'ok', service: SERVICE_NAMES.api });
    return health.value;
  }
}

@Module({
  imports: [
    CoreModule,
    IdentityModule,
    CrmModule,
    ScheduleModule,
    FinanceModule,
    EducationModule,
    StorageModule,
    IntegrationsModule,
    QaModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
