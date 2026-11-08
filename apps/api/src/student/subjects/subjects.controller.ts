import { Controller, Get, Header, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ProblemDetails } from '../../core/errors/error-mapper.js';
import { RequireRole } from '../../core/rbac/decorators.js';
import { object } from '../../modules/identity/input.js';
import { StudentCtx } from '../student-context.decorator.js';
import type { IStudentContext } from '../student-context.interface.js';
import { StudentSubjectsResponseDto } from './subjects.dto.js';
import { StudentSubjectsService } from './subjects.service.js';

@ApiTags('Student')
@ApiCookieAuth('sessionCookie')
@RequireRole('STUDENT')
@ApiResponse({ status: 400, type: ProblemDetails })
@ApiResponse({ status: 401, type: ProblemDetails })
@ApiResponse({ status: 402, type: ProblemDetails })
@ApiResponse({ status: 403, type: ProblemDetails })
@ApiResponse({ status: 503, type: ProblemDetails })
@Controller('api/v1/student/subjects')
export class StudentSubjectsController {
  constructor(private readonly subjects: StudentSubjectsService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    operationId: 'getStudentSubjects',
    summary: 'Read owned subject access and subscription summaries',
    description:
      'One read snapshot from the student session. Subjects are ordered by ID and the preferred subscription comes first. No query parameters, money or mutations. Meet eligibility remains per lesson.',
  })
  @ApiResponse({ status: 200, type: StudentSubjectsResponseDto })
  list(@StudentCtx() student: IStudentContext, @Query() query: unknown) {
    object(query, []);
    return this.subjects.list(student);
  }
}
