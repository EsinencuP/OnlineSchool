import type { HttpRequest } from '../../../core/http.js';

export interface DirectorContext {
  readonly accountId: string;
  readonly staffId: string;
  readonly sessionId: string;
  readonly requestId: string;
}
export interface DirectorRequest extends HttpRequest {
  directorCtx?: DirectorContext;
}
