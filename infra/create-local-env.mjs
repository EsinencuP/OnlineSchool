import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

const hex = () => randomBytes(32).toString('hex');
try {
  await writeFile(
    new URL('../.env', import.meta.url),
    [
      'PG_USER=school_bootstrap',
      `PG_PASSWORD=${hex()}`,
      `APP_RUNTIME_PASSWORD=${hex()}`,
      `APP_MIGRATE_PASSWORD=${hex()}`,
      `CSRF_SIGNING_SECRET=${randomBytes(48).toString('base64url')}`,
      'WEBAUTHN_RP_ID=',
      'WEBAUTHN_ALLOWED_ORIGIN=',
      'API_PORT=3000',
      'HTTP_PORT=80',
      'WORKER_MAX_ATTEMPTS=10',
      'WORKER_RECOVERY_MAX_ATTEMPTS=10',
      '',
    ].join('\n'),
    { flag: 'wx', mode: 0o600 },
  );
  console.log(
    'Created private .env with local-only credentials. Set the HTTPS RP ID/origin before browser authentication.',
  );
} catch (error) {
  console.error(
    error.code === 'EEXIST'
      ? '.env already exists; preserved without changes.'
      : 'LOCAL_ENV_CREATION_FAILED',
  );
  process.exitCode = 1;
}
