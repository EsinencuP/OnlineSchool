import { Controller, Get, Query, Req } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { unwrap } from '../../core/errors/domain-error.js';
import { RequirePermission } from '../../core/rbac/decorators.js';
import { ApiError } from '../../openapi/dtos.js';
import type { TeacherRequest } from './context/teacher-context.js';
import { TeacherPayrollQueryDto, TeacherPayrollResponseDto } from './dto/teacher-payroll.dto.js';
import { TeacherRoute } from './guards/teacher-route.decorator.js';
import { TeacherPayrollService } from './teacher-payroll.service.js';

@TeacherRoute()
@Controller('api/v1/teacher/payroll')
export class TeacherPayrollController {
  constructor(private readonly payroll: TeacherPayrollService) {}

  @Get()
  @RequirePermission('payroll:read')
  @ApiOperation({
    operationId: 'getTeacherPayrollStatement',
    summary:
      "The teacher's own monthly statement: confirmed lessons, accruals and payouts (read-only)",
  })
  @ApiOkResponse({ type: TeacherPayrollResponseDto })
  @ApiUnprocessableEntityResponse({ type: ApiError, description: 'INVALID_INPUT' })
  @ApiServiceUnavailableResponse({ type: ApiError, description: 'Data store unavailable' })
  async statement(
    @Req() req: TeacherRequest,
    @Query() query: TeacherPayrollQueryDto,
  ): Promise<TeacherPayrollResponseDto> {
    return unwrap(await this.payroll.statement(req.teacherCtx!, req.account!, query.month));
  }
}
