import type { HttpRequest } from '../../../core/http.js';

export interface TeacherContext {
  readonly accountId: string;
  readonly teacherId: string;
  readonly sessionId: string;
  readonly requestId: string;
}
export interface TeacherRequest extends HttpRequest {
  teacherCtx?: TeacherContext;
}
