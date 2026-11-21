import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const guard = path.join(path.dirname(fileURLToPath(import.meta.url)), 'qa-write-guard.mjs');
const root = path.resolve(path.dirname(guard), '..', '..');
const run = (mode, tool_input, cwd = root) => {
  const r = spawnSync(process.execPath, [guard, mode], { input: JSON.stringify({ tool_input, cwd }), encoding: 'utf8' });
  const out = r.stdout.trim();
  return { status: r.status, denied: out ? JSON.parse(out).hookSpecificOutput.permissionDecision === 'deny' : false };
};

test('write inside qa/ is not denied', () => {
  assert.equal(run('write', { file_path: path.join(root, 'qa', 'cycles', 'x', 'R.md') }).denied, false);
  assert.equal(run('write', { file_path: 'qa/cycles/x/R.md' }).denied, false);
  assert.equal(run('write', { file_path: 'qa\\cycles\\x\\R.md' }).denied, false);
});
test('write to product source is denied', () => {
  assert.equal(run('write', { file_path: path.join(root, 'apps', 'api', 'src', 'x.ts') }).denied, true);
  assert.equal(run('write', { file_path: 'apps/platform/src/a.tsx' }).denied, true);
  assert.equal(run('write', { file_path: 'package.json' }).denied, true);
});
test('write outside the repository or via traversal is denied', () => {
  assert.equal(run('write', { file_path: path.join(root, '..', 'elsewhere.txt') }).denied, true);
  assert.equal(run('write', { file_path: 'qa/../apps/x.ts' }).denied, true);
  assert.equal(run('write', { file_path: 'C:\\Windows\\temp\\x' }).denied, true);
});
test('undeterminable path is denied', () => {
  assert.equal(run('write', {}).denied, true);
  assert.equal(run('write', { file_path: '' }).denied, true);
});
test('qa/private is owner-only', () => {
  assert.equal(run('write', { file_path: 'qa/private/student.storage.json' }).denied, true);
});
test('bash read-only heuristic', () => {
  assert.equal(run('bash-ro', { command: 'git log --oneline -5' }).denied, false);
  assert.equal(run('bash-ro', { command: 'git rev-parse HEAD' }).denied, false);
  assert.equal(run('bash-ro', { command: 'rm -rf apps' }).denied, true);
  assert.equal(run('bash-ro', { command: 'echo x > apps/a.ts' }).denied, true);
  assert.equal(run('bash-ro', { command: 'git commit -am x' }).denied, true);
});
test('unknown mode and invalid JSON fail closed', () => {
  assert.equal(run('nope', { file_path: 'qa/x' }).denied, true);
  const r = spawnSync(process.execPath, [guard, 'write'], { input: 'not json', encoding: 'utf8' });
  assert.equal(JSON.parse(r.stdout).hookSpecificOutput.permissionDecision, 'deny');
});
