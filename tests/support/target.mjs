import assert from 'node:assert/strict';
export function testDatabase(value) {
  assert.equal(
    process.env.FND_ALLOW_EPHEMERAL_DATABASES,
    '1',
    'Ephemeral test databases need the explicit owner exception',
  );
  assert.notEqual(process.env.APP_ENV, 'production');
  assert.ok(value, 'Explicit isolated test database URL required');
  const url = new URL(value);
  assert.ok(['postgres:', 'postgresql:'].includes(url.protocol));
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname));
  assert.match(url.pathname, /^\/online_school_test[a-z0-9_]*$/);
  assert.equal(url.searchParams.has('host'), false);
  assert.equal(url.searchParams.has('hostaddr'), false);
  return url;
}
