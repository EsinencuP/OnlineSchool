import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeVercelRequest } from '../../apps/api/dist/vercel-request.js';
test('Vercel rewrite metadata does not enter strict API query DTOs', () => {
  const req = {
    url: '/api/v1/student/homework?page=2&pageSize=20',
    query: { page: '2', pageSize: '20', __vercel_api_path: 'v1/student/homework' },
  };
  normalizeVercelRequest(req);
  assert.deepEqual({ ...req.query }, { page: '2', pageSize: '20' });
});
test('embedded internal capture is removed only when it matches the routed path', () => {
  const req = { url: '/api/v1/student/homework?__vercel_api_path=v1%2Fstudent%2Fhomework&page=2' };
  normalizeVercelRequest(req);
  assert.deepEqual({ ...req.query }, { page: '2' });
  const invalid = {
    url: '/api/v1/student/homework?__vercel_api_path=other&unexpected=x&page=1&page=2',
  };
  normalizeVercelRequest(invalid);
  assert.deepEqual(
    { ...invalid.query },
    { __vercel_api_path: 'other', unexpected: 'x', page: ['1', '2'] },
  );
});
test('ordinary unknown client query parameters remain visible to validators', () => {
  const req = { url: '/api/v1/student/skills?path=untrusted&subjectId=123' };
  normalizeVercelRequest(req);
  assert.deepEqual({ ...req.query }, { path: 'untrusted', subjectId: '123' });
});
