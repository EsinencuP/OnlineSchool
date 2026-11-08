import { Controller, Get, UseInterceptors } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RequireRole } from '../../core/rbac/decorators.js';
import { unwrap } from '../../core/errors/domain-error.js';
import { ProblemDetails } from '../../core/errors/error-mapper.js';
import { StudentCtx } from '../student-context.decorator.js';
import type { IStudentContext } from '../student-context.interface.js';
import { DashboardService } from './dashboard.service.js';
import { DashboardCacheInterceptor } from './dashboard-cache.interceptor.js';
import { DashboardResponseDto } from './dashboard.dto.js';

@ApiTags('Student')
@ApiCookieAuth('sessionCookie')
@RequireRole('STUDENT')
@Controller('api/v1/student/dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}
  @Get()
  @UseInterceptors(DashboardCacheInterceptor)
  @ApiOperation({
    operationId: 'getStudentDashboard',
    summary: 'Current student dashboard snapshot',
    description:
      'Four parallel confirmed-data projections. Private per-student cache up to 30s, transactionally invalidated after source changes. Meet link only within the join window. Quantity fields are integers; no monetary amounts are exposed.',
  })
  @ApiResponse({ status: 200, type: DashboardResponseDto })
  @ApiResponse({ status: 401, type: ProblemDetails })
  @ApiResponse({ status: 402, type: ProblemDetails })
  @ApiResponse({ status: 403, type: ProblemDetails })
  @ApiResponse({ status: 503, type: ProblemDetails })
  async get(@StudentCtx() student: IStudentContext): Promise<DashboardResponseDto> {
    return unwrap(await this.dashboard.get(student));
  }
}
