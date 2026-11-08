import type { StudentRequest } from './student-context.interface.js';
export function studentBootstrapRoute(
  req: Pick<StudentRequest, 'method' | 'originalUrl'>,
): boolean {
  const path = (req.originalUrl.split('?')[0] ?? '').toLowerCase().replace(/\/+$/, '');
  return (
    (req.method === 'GET' && path === '/api/v1/student/me') ||
    (['POST', 'PATCH'].includes(req.method ?? '') &&
      path === '/api/v1/student/security/change-password')
  );
}
