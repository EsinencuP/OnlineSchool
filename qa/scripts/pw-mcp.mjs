#!/usr/bin/env node
// Per-role Playwright MCP launcher for the Claude Code QA agents.
//   node qa/scripts/pw-mcp.mjs <qa|student|teacher|manager|director>
// - one isolated browser per process (--isolated); never shared between roles
// - origin restricted to qa/fixtures/build.json "origin" when that file exists
// - qa/private/<role>.storage.json is loaded only when present (owner-provided, git-ignored)
// - screenshots/snapshots go to qa/evidence/<role>/<current-cycle>/
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const role = process.argv[2];
if (!['qa', 'student', 'teacher', 'manager', 'director'].includes(role)) {
  console.error('usage: pw-mcp.mjs <qa|student|teacher|manager|director>');
  process.exit(2);
}
const readJson = (p) => {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
};
const build = readJson(path.join(root, 'qa/fixtures/build.json'));
let cycle = 'adhoc';
try { cycle = fs.readFileSync(path.join(root, 'qa/evidence/CURRENT_CYCLE'), 'utf8').trim().replace(/[^\w.-]/g, '') || 'adhoc'; } catch {}
const outDir = path.join(root, 'qa/evidence', role, cycle);
fs.mkdirSync(outDir, { recursive: true });

const args = ['-y', '@playwright/mcp@0.0.83', '--isolated', '--headless', '--output-dir', outDir];
if (build?.origin) args.push('--allowed-origins', new URL(build.origin).origin);
const storage = path.join(root, 'qa/private', `${role}.storage.json`);
if (fs.existsSync(storage)) args.push('--storage-state', storage);

const child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', args, { stdio: 'inherit', cwd: root, shell: process.platform === 'win32' });
child.on('exit', (code) => process.exit(code ?? 0));
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => child.kill());
