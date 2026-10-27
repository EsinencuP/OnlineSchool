import '../../apps/api/node_modules/reflect-metadata/Reflect.js';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { createDirectClient } from '../../packages/db/dist/index.js';
import { QA, qaId, seedQA } from '../../packages/db/dist-tools/seed.js';
import { AppModule } from '../../apps/api/dist/app.module.js';
import { SessionStore } from '../../apps/api/dist/core/session/session.store.js';
import { testDatabase } from './target.mjs';
import { http } from './http.mjs';
export { QA, qaId };
const requireApi = createRequire(new URL('../../apps/api/package.json', import.meta.url));
const requireDb = createRequire(new URL('../../packages/db/package.json', import.meta.url));
const { NestFactory } = requireApi('@nestjs/core');
const { Pool } = requireDb('pg');

export async function apiFixture() {
  const url = testDatabase(process.env.TEST_DATABASE_URL);
  const db = createDirectClient({ DIRECT_URL: url.toString() }).value;
  const pool = new Pool({ connectionString: url.toString() });
  assert.equal((await seedQA(db)).ok, true);
  await pool.query(
    "DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='fnd_runtime') THEN CREATE ROLE fnd_runtime LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS; END IF; END $$",
  );
  await pool.query('GRANT online_school_runtime TO fnd_runtime');
  const runtime = new URL(url);
  runtime.username = 'fnd_runtime';
  runtime.password = '';
  process.env.DATABASE_URL = runtime.toString();
  process.env.CSRF_SIGNING_SECRET = randomBytes(48).toString('base64url');
  const app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl();
  const store = app.get(SessionStore),
    actors = {};
  for (const [name, label] of [
    ['director', 'seed-director-001'],
    ['manager', 'seed-manager-001'],
    ['other', 'seed-manager-002'],
    ['teacher', 'seed-teacher-002'],
    ['student', 'seed-student-001'],
  ]) {
    const accountId = qaId(`${label}/auth`);
    actors[name] = {
      accountId,
      ...(await db.$transaction((tx) => store.issue(tx, accountId, new Date()))),
    };
  }
  await db.assignedManager.create({
    data: {
      manager_id: QA.managers[0],
      student_id: QA.students[0],
      assigned_at: new Date('2026-10-01Z'),
    },
  });
  async function call(
    path,
    { actor = 'manager', body = {}, method = 'POST', key = randomUUID() } = {},
  ) {
    const session = actors[actor];
    const result = await http(base + '/api/v1/' + path, {
      method,
      headers: {
        'content-type': 'application/json',
        'idempotency-key': key,
        ...(session
          ? {
              'x-csrf-token': session.csrfToken,
              cookie: `__Host-school_session=${session.token}; __Host-school_csrf=${session.csrfToken}`,
            }
          : {}),
      },
      ...(method === 'GET' ? {} : { body: JSON.stringify(body) }),
    });
    return { status: result.status, body: await result.json(), key };
  }
  return {
    db,
    pool,
    app,
    actors,
    call,
    async close() {
      await app.close();
      await db.$disconnect();
      await pool.end();
    },
  };
}
export function good(response) {
  assert.equal(response.status, 200, JSON.stringify(response.body));
  return response.body;
}
