import {
  applyDecorators,
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { CriticalContext } from '../../../core/http.js';
import {
  CriticalCommand,
  CurrentTransaction,
} from '../../../core/idempotency/idempotency.module.js';
import { unwrap } from '../../../core/errors/domain-error.js';
import { ApiError } from '../../../openapi/dtos.js';
import type { ManagerRequest } from '../context/manager-context.js';
import { ManagerRoute } from '../guards/manager-route.decorator.js';
import {
  AssignTeacherCommandDto,
  RevokeAssignmentCommandDto,
  TeacherAssignmentDto,
  TeacherCandidatesDto,
  TeacherCandidatesQueryDto,
  TeacherDirectoryDto,
  TeacherDirectoryQueryDto,
  TeacherWindowsDto,
  TeacherWindowsQueryDto,
} from './manager-teachers.dto.js';
import { ManagerTeachersService } from './manager-teachers.service.js';

const command = (type: string, status: 200 | 201 = 200) =>
  applyDecorators(
    Header('Cache-Control', 'private, no-store'),
    ApiHeader({
      name: 'Idempotency-Key',
      required: true,
      schema: { type: 'string', format: 'uuid' },
    }),
    ApiHeader({ name: 'X-CSRF-Token', required: true }),
    ApiNotFoundResponse({ type: ApiError, description: 'STUDENT_NOT_FOUND, ASSIGNMENT_NOT_FOUND' }),
    ApiConflictResponse({ type: ApiError, description: 'TEACHER_ALREADY_ASSIGNED' }),
    ApiUnprocessableEntityResponse({
      type: ApiError,
      description: 'TEACHER_INACTIVE, SUBJECT_INACTIVE',
    }),
    CriticalCommand({
      type: `manager.teacher.${type}`,
      resourceType: 'TeachingAssignment',
      resultIdField: 'assignmentId',
      topic: `manager.teacher.command-${type}.v1`,
      successStatus: status,
      conflictOnPayloadMismatch: true,
    }),
  );

@ManagerRoute()
@ApiNotFoundResponse({ type: ApiError, description: 'TEACHER_NOT_FOUND, LEAD_NOT_FOUND' })
@Controller('api/v1/manager')
export class ManagerTeachersController {
  constructor(private readonly teachers: ManagerTeachersService) {}

  @Get('teachers')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    operationId: 'listManagerTeachers',
    summary: 'Teacher directory: subjects, load and free time for the next 7 days',
  })
  @ApiOkResponse({ type: TeacherDirectoryDto })
  async directory(@Req() r: ManagerRequest, @Query() q: TeacherDirectoryQueryDto) {
    return unwrap(await this.teachers.directory(r.managerCtx!, q));
  }

  @Get('teachers/:teacherId/availability')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    operationId: 'getManagerTeacherAvailability',
    summary: 'Availability windows with booked and free intervals (range up to 31 days)',
  })
  @ApiOkResponse({ type: TeacherWindowsDto })
  @ApiUnprocessableEntityResponse({ type: ApiError, description: 'INVALID_RANGE, RANGE_TOO_LARGE' })
  async windows(
    @Req() r: ManagerRequest,
    @Param('teacherId') teacherId: string,
    @Query() q: TeacherWindowsQueryDto,
  ) {
    return unwrap(await this.teachers.windows(r.managerCtx!, teacherId, q.from, q.to));
  }

  @Get('leads/:leadId/teacher-candidates')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    operationId: 'listManagerLeadTeacherCandidates',
    summary:
      'Teachers with free trial slots for the lead; schedule the trial with scheduleManagerTrial',
  })
  @ApiOkResponse({ type: TeacherCandidatesDto })
  async candidates(
    @Req() r: ManagerRequest,
    @Param('leadId') leadId: string,
    @Query() q: TeacherCandidatesQueryDto,
  ) {
    return unwrap(await this.teachers.candidates(r.managerCtx!, leadId, q.days ?? 7));
  }

  @Post('students/:studentId/teaching-assignments')
  @ApiOperation({
    operationId: 'assignManagerTeacher',
    summary: 'Assign a teacher to the student for a subject (creates the enrollment when missing)',
  })
  @ApiCreatedResponse({ type: TeacherAssignmentDto })
  @command('assign', 201)
  async assign(
    @Req() r: ManagerRequest,
    @Param('studentId') studentId: string,
    @Body() dto: AssignTeacherCommandDto,
    @CurrentTransaction() c: CriticalContext,
  ) {
    return unwrap(await this.teachers.assign(r.managerCtx!, studentId, dto, c));
  }

  @Post('teaching-assignments/:assignmentId/revoke')
  @ApiOperation({
    operationId: 'revokeManagerTeacher',
    summary: 'End a current assignment; future held lessons get a follow-up task',
  })
  @ApiOkResponse({ type: TeacherAssignmentDto })
  @command('revoke')
  async revoke(
    @Req() r: ManagerRequest,
    @Param('assignmentId') assignmentId: string,
    @Body() dto: RevokeAssignmentCommandDto,
    @CurrentTransaction() c: CriticalContext,
  ) {
    return unwrap(await this.teachers.revoke(r.managerCtx!, assignmentId, dto.reason, c));
  }
}
