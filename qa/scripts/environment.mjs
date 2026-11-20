import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { join } from 'node:path';
import { json, readJson, requireValue, roles } from './records.mjs';

export const marker = '/.well-known/k8k-qa-build.json';
const loopback = new Set(['localhost', '127.0.0.1', '[::1]']);
const identities = [roles[1], roles[2], roles[3], roles[4]];

export function validateBuild(build) {
  const origin = new URL(build.origin);
  requireValue(origin.origin === build.origin && loopback.has(origin.hostname) &&
    ['http:', 'https:'].includes(origin.protocol), 'Use a canonical loopback QA origin');
  requireValue(['qa', 'self-test'].includes(build.environment) && build.synthetic === true &&
    build.externalEffects === 'disabled' && ['blocked', 'synthetic-only'].includes(build.writes),
  'QA target must attest synthetic data, write policy and disabled external effects');
  requireValue(/^[a-f0-9]{40}$/.test(build.commit), 'Build requires a full Git commit');
  for (const key of ['version', 'migration', 'database']) {
    requireValue(typeof build[key] === 'string' && /^[\w./:-]{1,140}$/.test(build[key]) &&
      !/^REPLACE_WITH_|^UNKNOWN$/i.test(build[key]), `Build requires a known ${key}`);
  }
  requireValue(Array.isArray(build.changes) && build.changes.length &&
    build.changes.every((item) => typeof item === 'string' && item.trim() && !item.startsWith('REPLACE_WITH_')),
  'Build requires a change list');
  const { environment, commit, version, migration, database, synthetic, externalEffects, writes, changes } = build;
  return { environment, origin: origin.origin, commit, version, migration, database, synthetic, externalEffects, writes, changes };
}

export async function assertBuild(expected) {
  const response = await fetch(expected.origin + marker, {
    redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(4000),
  });
  requireValue(response.ok && response.headers.get('content-type')?.includes('application/json'), 'QA build marker is unavailable');
  const actual = validateBuild(await response.json());
  requireValue(JSON.stringify(actual) === JSON.stringify(expected), 'Build changed or its live marker does not match');
}

export async function loadBuild(file) {
  const input = await readJson(file).catch((error) => {
    if (error.code === 'ENOENT') throw new Error('QA build manifest is missing. See qa/README.md.');
    throw error;
  });
  const build = validateBuild(input);
  requireValue(build.environment === 'qa', 'Use --self-test for fixture runs');
  await assertBuild(build);
  return build;
}

export async function credentials(file) {
  const values = parseEnv(await readFile(file, 'utf8'));
  requireValue(Object.keys(values).length === 2 && values.QA_LOGIN?.trim() && values.QA_PASSWORD?.length >= 16 &&
    values.QA_PASSWORD !== 'replace-with-unique-local-test-password', 'Invalid or missing synthetic QA credentials');
  return values;
}

export async function selfTestServer(commit, directory) {
  let build;
  const html = `<!doctype html><html lang="ru"><title>K8K QA fixture</title>
    <h1>K8K QA fixture</h1><p role="status" id="state"></p>
    <form><label>Login <input name="login" required></label>
    <label>Password <input name="password" type="password" required></label><button>Sign in</button></form>
    <script>
      const state = document.querySelector('#state');
      const form = document.querySelector('form');
      const current = localStorage.getItem('fixture-role');
      state.textContent = current ? 'Signed in as ' + current : 'Signed out';
      if (current) form.hidden = true;
      form.onsubmit = (event) => {
        event.preventDefault();
        const name = form.elements.login.value;
        if (!${JSON.stringify(identities)}.includes(name) || form.elements.password.value !== 'fixture-only-password') {
          state.textContent = 'Invalid fixture credentials';
          return;
        }
        localStorage.setItem('fixture-role', name);
        state.textContent = 'Signed in as ' + name;
        form.reset();
        form.hidden = true;
      };
    </script></html>`;
  const server = createServer((request, response) => {
    if (request.url === marker) {
      response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      response.end(JSON.stringify(build));
    } else if (request.url === '/') {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end(html);
    } else {
      response.writeHead(404).end();
    }
  });
  await new Promise((accept, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', accept);
  });
  build = validateBuild({
    environment: 'self-test', origin: `http://127.0.0.1:${server.address().port}`, commit,
    version: 'qa-fixture', migration: 'NONE', database: 'NONE', synthetic: true,
    externalEffects: 'disabled', writes: 'synthetic-only', changes: ['QA infrastructure exercise'],
  });
  await json(join(directory, 'fixture.json'), build);
  return { build, close: () => server.close() };
}
