import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiUnprocessableEntityResponse,
  ApiServiceUnavailableResponse,
} from '@nestjs/swagger';
import {
  CriticalCommand,
  CurrentTransaction,
} from '../../../core/idempotency/idempotency.module.js';
import type { CriticalContext } from '../../../core/http.js';
import { unwrap } from '../../../core/errors/domain-error.js';
import { ApiError } from '../../../openapi/dtos.js';
import type { ManagerRequest } from '../context/manager-context.js';
import { ManagerRoute } from '../guards/manager-route.decorator.js';
import {
  CreateStudentDto,
  ListStudentsQueryDto,
  StudentCardDto,
  StudentListPageDto,
  UpdateStudentContactsDto,
} from '../dto/student-crm.dto.js';
import { ManagerStudentsService } from './manager-students.service.js';
import { ManagerCreateReplayGuard } from './manager-create.guard.js';

@ManagerRoute()
@ApiNotFoundResponse({ type: ApiError, description: 'STUDENT_NOT_FOUND' })
@ApiUnprocessableEntityResponse({ type: ApiError, description: 'INVALID_INPUT or INVALID_CURSOR' })
@ApiServiceUnavailableResponse({
  type: ApiError,
  description: 'Database, audit, outbox or configuration unavailable',
})
@Controller('api/v1/manager/students')
export class ManagerStudentsController {
  constructor(private readonly students: ManagerStudentsService) {}
  @Get()
  @ApiOperation({ operationId: 'listManagerStudents' })
  @ApiOkResponse({ type: StudentListPageDto })
  async list(
    @Req() req: ManagerRequest,
    @Query() query: ListStudentsQueryDto,
  ): Promise<StudentListPageDto> {
    return unwrap(await this.students.list(req.managerCtx!, query));
  }
  @Get(':studentId')
  @ApiOperation({ operationId: 'getManagerStudentCard' })
  @ApiOkResponse({ type: StudentCardDto })
  async card(
    @Req() req: ManagerRequest,
    @Param('studentId') studentId: string,
  ): Promise<StudentCardDto> {
    return unwrap(await this.students.getCard(req.managerCtx!, studentId));
  }
  @Post()
  @UseGuards(ManagerCreateReplayGuard)
  @ApiOperation({ operationId: 'createManagerStudent' })
  @ApiCreatedResponse({ type: StudentCardDto })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiHeader({ name: 'X-CSRF-Token', required: true })
  @ApiConflictResponse({ type: ApiError, description: 'IDEMPOTENCY_KEY_REUSED' })
  @ApiBadRequestResponse({ type: ApiError, description: 'IDEMPOTENCY_KEY_REQUIRED (core guard)' })
  @CriticalCommand({
    type: 'manager.student.create',
    resourceType: 'Student',
    topic: 'manager.student.created.v1',
    resultIdField: 'studentId',
    successStatus: 201,
    conflictOnPayloadMismatch: true,
  })
  async create(
    @Req() req: ManagerRequest,
    @Body() dto: CreateStudentDto,
    @CurrentTransaction() command: CriticalContext,
  ): Promise<StudentCardDto> {
    return unwrap(await this.students.create(req.managerCtx!, dto, req.idempotencyKey!, command));
  }
  @Patch(':studentId/contacts')
  @ApiOperation({ operationId: 'updateManagerStudentContacts' })
  @ApiOkResponse({ type: StudentCardDto })
  @ApiHeader({ name: 'X-CSRF-Token', required: true })
  @ApiConflictResponse({ type: ApiError, description: 'VERSION_CONFLICT' })
  async update(
    @Req() req: ManagerRequest,
    @Param('studentId') studentId: string,
    @Body() dto: UpdateStudentContactsDto,
  ): Promise<StudentCardDto> {
    return unwrap(await this.students.updateContacts(req.managerCtx!, studentId, dto));
  }
}
