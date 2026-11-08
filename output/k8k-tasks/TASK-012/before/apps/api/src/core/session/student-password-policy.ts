import type { HttpRequest } from '../http.js';
export function studentPasswordChangeRoute(
  req: Pick<HttpRequest, 'method' | 'originalUrl'>,
): boolean {
  const path = (req.originalUrl.split('?')[0] ?? '').toLowerCase().replace(/\/+$/, '');
  return (
    ['POST', 'PATCH'].includes(req.method ?? '') &&
    path === '/api/v1/student/security/change-password'
  );
}
export function studentLogoutRoute(req: Pick<HttpRequest, 'method' | 'originalUrl'>): boolean {
  const path = (req.originalUrl.split('?')[0] ?? '').toLowerCase().replace(/\/+$/, '');
  return req.method === 'DELETE' && path === '/api/v1/auth/session';
}
