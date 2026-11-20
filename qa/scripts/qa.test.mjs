import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { assertBuild, selfTestServer, validateBuild } from './environment.mjs';
import { append, ledger, register, reports, validate } from './records.mjs';
import { browserTools } from './browser-guard.mjs';
import { options, profile } from './codex.mjs';

test('fixture marker pins every field and refuses non-loopback targets', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'k8k-qa-test-'));
  const fixture = await selfTestServer('a'.repeat(40), dir);
  try {
    await assertBuild(fixture.build);
    await assert.rejects(assertBuild({ ...fixture.build, migration: 'another' }), /Build changed/);
    assert.throws(() => validateBuild({ ...fixture.build, origin: 'https://other.example' }), /loopback/);
    assert.throws(() => validateBuild({ ...fixture.build, externalEffects: 'unknown' }), /disabled/);
  } finally {
    fixture.close();
    await rm(dir, { recursive: true });
  }
});

test('journal preserves transitions, accepts a risk, and requires independent retest for verification', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'k8k-qa-test-'));
  const id = 'K8K-QA-20261120T215901396Z-aa37bbdf-001';
  const entry = (to, extra = {}) => ({ id, to, reason: 'fixture evidence', actor: 'fixture', ...extra });
  try {
    await register(dir, [{ id, status: 'OPEN' }]);
    await assert.rejects(append(dir, [entry('VERIFIED')]), /Invalid transition/);
    await append(dir, [entry('TRIAGED'), entry('DEFERRED')]);
    assert.equal((await ledger(dir)).cards[0].accepted_risk, 'fixture evidence');
    const commit = 'b'.repeat(40);
    await append(dir, [entry('TRIAGED'), entry('ACCEPTED'), entry('IN_PROGRESS'), entry('FIXED'),
      entry('READY_FOR_RETEST', { commit, browser_role: 'student_agent' })]);
    await append(dir, [entry('REOPENED'), entry('IN_PROGRESS'), entry('FIXED'),
      entry('READY_FOR_RETEST', { commit }), entry('VERIFIED')]);
    const { cards, history } = await ledger(dir);
    assert.equal(cards[0].status, 'VERIFIED');
    assert.equal(cards[0].fix_commit, commit);
    assert.ok(cards[0].verified_at);
    assert.equal(cards[0].accepted_risk, undefined);
    assert.equal(history.length, 12);
  } finally {
    await rm(dir, { recursive: true });
  }
});

test('reports reject empty fields and extra payloads', () => {
  const report = {
    role: 'student_agent', status: 'BLOCKED', unsafe_to_continue: false, summary: 'Fixture',
    scenarios: [], findings: [],
  };
  validate(reports, report);
  assert.throws(() => validate(reports, { ...report, summary: ' ' }), /Invalid value/);
  assert.throws(() => validate(reports, { ...report, secret: 'unknown' }), /Unexpected fields/);
});

test('project profiles resolve and role sessions configure only restricted browser tools', async () => {
  const root = join(import.meta.dirname, '../..');
  for (const role of ['qa_engineer', 'student_agent', 'teacher_agent', 'manager_agent', 'director_agent']) {
    assert.ok(await profile(root, role));
  }
  const servers = [{ name: 'playwright', transport: { type: 'stdio' } },
    { name: 'unrelated', transport: { type: 'streamable_http' } }];
  const args = options({ servers, instructions: 'Test only', shell: false, browser: 'browser.json' });
  assert.ok(args.includes('features.shell_tool=false'));
  assert.ok(args.includes('mcp_servers.unrelated.enabled=false'));
  assert.ok(args.includes('mcp_servers.playwright.enabled=true'));
  for (const tool of ['browser_evaluate', 'browser_run_code_unsafe', 'browser_file_upload', 'browser_network_request']) {
    assert.ok(!browserTools.includes(tool));
  }
});
