import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

const folder = 'output/k8k-tasks/TASK-034/';
const before = JSON.parse(readFileSync(folder + 'before.json'));
const sha = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const snapshots = before.paths.map(({ path, sha256 }) => ({
  path,
  snapshotValid: sha(folder + 'before/' + path) === sha256,
  changedInTask: sha(path) !== sha256,
}));
assert(snapshots.every((item) => item.snapshotValid));
const migrations = before.migrations.map(({ path, sha256 }) => ({
  path, sha256, current: sha(path), preserved: sha(path) === sha256,
}));
assert(migrations.every((item) => item.preserved));
const migrationPaths = execFileSync('rg', ['--files', 'packages/db/prisma/migrations', '-g', 'migration.sql'], { encoding: 'utf8' }).trim().split(/\r?\n/).map(path => path.replaceAll('\\','/')).sort();
assert.deepEqual(migrationPaths, before.migrations.map(({path}) => path).sort());
const decodeGitPath = (text) => text.replace(/^"|"$/g, '').replace(/(?:\\[0-7]{3})+/g,
  (run) => Buffer.from([...run.matchAll(/\\([0-7]{3})/g)].map((match) => parseInt(match[1], 8))).toString('utf8'));
const initialPaths = readFileSync(folder + 'status-before.txt', 'utf8').trimEnd().split(/\r?\n/).map((line) => decodeGitPath(line.slice(3)));
const missingInitialPaths = initialPaths.filter((path) => !existsSync(path));
assert.deepEqual(missingInitialPaths, []);
const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const branch = execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim();
assert.equal(head, before.head);
assert.equal(branch, before.branch);
writeFileSync(folder + 'preservation.json', JSON.stringify({status:'PASS', head, branch,
  initialRecords:before.statusEntries, dirtyDigest:before.dirtyDigest, snapshots, migrations,
  missingInitialPaths, dotenvRead:false, productionAccess:false, migrationsExecuted:false}, null, 2) + '\n');
console.log({status:'PASS', snapshots:snapshots.length,migrations:migrations.length,missing:0});
