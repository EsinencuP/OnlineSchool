import { createParamDecorator } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { domainError, fail } from '../core/errors/domain-error.js';
import type { IStudentContext, StudentRequest } from './student-context.interface.js';
import { StudentErrors } from './student-context.interface.js';
export const StudentCtx = createParamDecorator(
  (_data: unknown, context: ExecutionContext): IStudentContext => {
    const req = context.switchToHttp().getRequest<StudentRequest>();
    return req.studentCtx ?? fail(domainError(StudentErrors.PROFILE_NOT_FOUND, 403));
  },
);
