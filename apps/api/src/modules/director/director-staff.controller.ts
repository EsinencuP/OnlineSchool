import { applyDecorators, Body, Controller, Get, Header, Param, Post, Query } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { CriticalContext } from '../../core/http.js';
import { CriticalCommand, CurrentTransaction } from '../../core/idempotency/idempotency.module.js';
import { unwrap } from '../../core/errors/domain-error.js';
import { ApiError } from '../../openapi/dtos.js';
import { DirectorStaffService } from './director-staff.service.js';
import {
  HandoverCommandDto,
  HandoverDto,
  HandoverListDto,
  HandoversQueryDto,
  StaffCardDto,
  StaffItemDto,
  StaffListDto,
  StaffQueryDto,
  StaffStatusCommandDto,
  STAFF_KINDS,
} from './dto/director-staff.dto.js';
import { DirectorRoute } from './guards/director-route.decorator.js';

const command = (type: string, resourceType: string) =>
  applyDecorators(
    Header('Cache-Control', 'private, no-store'),
    ApiHeader({
      name: 'Idempotency-Key',
      required: true,
      schema: { type: 'string', format: 'uuid' },
    }),
    ApiHeader({ name: 'X-CSRF-Token', required: true, schema: { type: 'string' } }),
    CriticalCommand({
      type: `director.${type}`,
      resourceType,
      topic: `director.${type}.v1`,
      conflictOnPayloadMismatch: true,
    }),
  );

@DirectorRoute()
@Controller('api/v1/director')
export class DirectorStaffController {
  constructor(private readonly staff: DirectorStaffService) {}

  @Get('staff')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    operationId: 'listDirectorStaff',
    summary: 'Managers and teachers with their load; deactivated people included on request',
  })
  @ApiOkResponse({ type: StaffListDto })
  async list(@Query() q: StaffQueryDto) {
    return unwrap(await this.staff.list(q));
  }

  @Get('staff/:kind/:id')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    operationId: 'getDirectorStaffCard',
    summary: 'One manager or teacher: load, status history and (managers) hand-overs',
  })
  @ApiParam({ name: 'kind', enum: STAFF_KINDS })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ type: StaffCardDto })
  @ApiNotFoundResponse({ type: ApiError, description: 'STAFF_NOT_FOUND' })
  async card(@Param('kind') kind: string, @Param('id') id: string) {
    return unwrap(await this.staff.card(kind, id));
  }

  @Get('handovers')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    operationId: 'listDirectorHandovers',
    summary: 'Manager hand-over journal, newest first; filter by student or lead',
  })
  @ApiOkResponse({ type: HandoverListDto })
  async handovers(@Query() q: HandoversQueryDto) {
    return unwrap(await this.staff.handovers(q));
  }

  @Post('students/:studentId/manager')
  @command('student.reassign', 'AssignedManager')
  @ApiOperation({
    operationId: 'reassignStudentManager',
    summary:
      'Hand the student over to another active manager. Open tasks of the client move with them; history keeps the old executor',
  })
  @ApiOkResponse({ type: HandoverDto })
  @ApiNotFoundResponse({ type: ApiError, description: 'STUDENT_NOT_FOUND' })
  @ApiConflictResponse({ type: ApiError, description: 'SAME_MANAGER' })
  @ApiUnprocessableEntityResponse({ type: ApiError, description: 'MANAGER_NOT_FOUND' })
  async reassignStudent(
    @CurrentTransaction() ctx: CriticalContext,
    @Param('studentId') studentId: string,
    @Body() dto: HandoverCommandDto,
  ) {
    return unwrap(
      await this.staff.reassign(
        ctx,
        { kind: 'STUDENT', id: studentId },
        dto.managerId,
        dto.comment,
      ),
    );
  }

  @Post('leads/:leadId/manager')
  @command('lead.reassign', 'AssignedManager')
  @ApiOperation({
    operationId: 'reassignLeadManager',
    summary: 'Hand the lead over to another active manager; open tasks move with it',
  })
  @ApiOkResponse({ type: HandoverDto })
  @ApiNotFoundResponse({ type: ApiError, description: 'LEAD_NOT_FOUND' })
  @ApiConflictResponse({ type: ApiError, description: 'SAME_MANAGER' })
  @ApiUnprocessableEntityResponse({ type: ApiError, description: 'MANAGER_NOT_FOUND' })
  async reassignLead(
    @CurrentTransaction() ctx: CriticalContext,
    @Param('leadId') leadId: string,
    @Body() dto: HandoverCommandDto,
  ) {
    return unwrap(
      await this.staff.reassign(ctx, { kind: 'LEAD', id: leadId }, dto.managerId, dto.comment),
    );
  }

  @Post('staff/:kind/:id/deactivate')
  @command('staff.deactivate', 'StaffStatus')
  @ApiOperation({
    operationId: 'deactivateDirectorStaff',
    summary:
      'Stop a manager or teacher from working. A manager must hand over every client and task first; a teacher must have no future lessons',
  })
  @ApiParam({ name: 'kind', enum: STAFF_KINDS })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ type: StaffItemDto })
  @ApiNotFoundResponse({ type: ApiError, description: 'STAFF_NOT_FOUND' })
  @ApiConflictResponse({
    type: ApiError,
    description: 'MANAGER_HAS_PORTFOLIO, TEACHER_HAS_FUTURE_LESSONS, STAFF_ALREADY_INACTIVE',
  })
  async deactivate(
    @CurrentTransaction() ctx: CriticalContext,
    @Param('kind') kind: string,
    @Param('id') id: string,
    @Body() dto: StaffStatusCommandDto,
  ) {
    return unwrap(await this.staff.setStatus(ctx, kind, id, 'DEACTIVATED', dto.reason));
  }

  @Post('staff/:kind/:id/reactivate')
  @command('staff.reactivate', 'StaffStatus')
  @ApiOperation({
    operationId: 'reactivateDirectorStaff',
    summary: 'Let a deactivated person work again',
  })
  @ApiParam({ name: 'kind', enum: STAFF_KINDS })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ type: StaffItemDto })
  @ApiNotFoundResponse({ type: ApiError, description: 'STAFF_NOT_FOUND' })
  @ApiConflictResponse({ type: ApiError, description: 'STAFF_ALREADY_ACTIVE' })
  async reactivate(
    @CurrentTransaction() ctx: CriticalContext,
    @Param('kind') kind: string,
    @Param('id') id: string,
    @Body() dto: StaffStatusCommandDto,
  ) {
    return unwrap(await this.staff.setStatus(ctx, kind, id, 'REACTIVATED', dto.reason));
  }
}
