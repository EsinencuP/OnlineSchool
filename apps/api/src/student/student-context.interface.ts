import type { HttpRequest } from '../core/http.js';
import type { StudentMeResponseDto } from './me/me.dto.js';

export interface IStudentContext {
  timeZone?: string;
  userId: string;
  /** Stable registry Student.id; StudentAccount is the login/activation link, not another person. */
  studentProfileId: string;
  hasActiveAccess: boolean;
  mustChangePassword: boolean;
  subjectIds: string[];
}
export interface StudentRequest extends HttpRequest {
  studentCtx?: IStudentContext;
  studentMe?: StudentMeResponseDto;
}
export const StudentErrors = {
  PROFILE_NOT_FOUND: 'STUDENT_PROFILE_NOT_FOUND',
  ACCESS_SUSPENDED: 'ACCESS_SUSPENDED',
  MUST_CHANGE_PASSWORD: 'MUST_CHANGE_PASSWORD',
} as const;
export function isStudentRequest(req: HttpRequest): boolean {
  return /^\/api\/v1\/student(?:\/|$)/i.test(req.originalUrl.split('?')[0] ?? '');
}
