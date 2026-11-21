#!/usr/bin/env node
// Prints the non-secret build context that black-box agents cannot read themselves (they have no file access).
// Used via !`` injection in the role skills. Never prints credentials or storage-state contents.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
let b;
try { b = JSON.parse(fs.readFileSync(path.join(root, 'qa/fixtures/build.json'), 'utf8')); } catch { b = null; }
if (!b) { console.log('BUILD CONTEXT: qa/fixtures/build.json is missing or invalid -> report BLOCKED.'); process.exit(0); }
const roles = ['student', 'teacher', 'manager', 'director'];
console.log(['BUILD CONTEXT (from owner-approved build.json):',
  '- origin: ' + b.origin, '- commit: ' + b.commit, '- version: ' + b.version, '- migration: ' + b.migration,
  '- environment: ' + b.environment + ', synthetic: ' + b.synthetic + ', externalEffects: ' + b.externalEffects + ', writes: ' + b.writes,
  '- note: ' + (b.changes || []).join('; '),
  '- saved role sessions (existence only): ' + roles.map((r) => r + '=' + (fs.existsSync(path.join(root, 'qa/private', r + '.storage.json')) ? 'yes' : 'no')).join(', ')].join(String.fromCharCode(10)));
