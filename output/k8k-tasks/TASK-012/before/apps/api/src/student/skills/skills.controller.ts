import { Controller, Get, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RequireRole } from '../../core/rbac/decorators.js';
import { ProblemDetails } from '../../core/errors/error-mapper.js';
import { StudentCtx } from '../student-context.decorator.js';
import type { IStudentContext } from '../student-context.interface.js';
import { HistoryQueryDto, HistoryQueryPipe } from '../history/history.dto.js';
import type { HistoryPage } from '../history/history.dto.js';
import {
  SkillAuditQueryDto,
  SkillAuditQueryPipe,
  SkillAuditResponseDto,
  SkillMapQueryDto,
  SkillMapQueryPipe,
  SkillSnapshotResponseDto,
  SubjectSkillMapDto,
} from './skills.dto.js';
import type { SkillAuditQuery } from './skills.dto.js';
import { StudentSkillsService } from './skills.service.js';

@ApiTags('Student')
@ApiCookieAuth('sessionCookie')
@RequireRole('STUDENT')
@ApiResponse({ status: 400, type: ProblemDetails })
@ApiResponse({ status: 401, type: ProblemDetails })
@ApiResponse({ status: 402, type: ProblemDetails })
@ApiResponse({ status: 403, type: ProblemDetails })
@ApiResponse({ status: 503, type: ProblemDetails })
@Controller('api/v1/student/skills')
export class StudentSkillsController {
  constructor(private readonly skills: StudentSkillsService) {}
  @Get()
  @ApiOperation({
    operationId: 'getStudentSkillMaps',
    summary: 'Read subject skill maps',
    description:
      'Returns an array for all owned subjects; optional subjectId filters to one. Four qualitative statuses, no ratings. Counts confirmed conducted lessons across enrollments; no reset on subscription or teacher change.',
  })
  @ApiResponse({ status: 200, type: [SubjectSkillMapDto] })
  maps(@StudentCtx() student: IStudentContext, @Query(SkillMapQueryPipe) query: SkillMapQueryDto) {
    return this.skills.maps(student, query);
  }
  @Get('audit')
  @ApiOperation({
    operationId: 'getStudentSkillAudit',
    summary: 'Read own skill changes',
    description:
      'Newest first, public comments only. Foreign and nonexistent skills produce the same 403. No internal pedagogical basis is exposed.',
  })
  @ApiResponse({ status: 200, type: SkillAuditResponseDto })
  audit(
    @StudentCtx() student: IStudentContext,
    @Query(SkillAuditQueryPipe) query: SkillAuditQueryDto,
  ) {
    return this.skills.audit(student, query as SkillAuditQuery);
  }
  @Get('snapshots')
  @ApiOperation({
    operationId: 'getStudentSkillSnapshots',
    summary: 'Read confirmed immutable skill snapshots',
    description:
      'Paginated items/total/page/pageSize. Newest first; only teacher-confirmed four-lesson reviews, never drafts or a reconstruction of today’s map.',
  })
  @ApiResponse({ status: 200, type: SkillSnapshotResponseDto })
  snapshots(
    @StudentCtx() student: IStudentContext,
    @Query(HistoryQueryPipe) query: HistoryQueryDto,
  ) {
    return this.skills.snapshots(student, query as HistoryPage);
  }
}
