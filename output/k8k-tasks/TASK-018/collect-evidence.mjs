// Scoped provenance only. No environment files, providers or database access.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, cp } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const root = new URL('../../../', import.meta.url), out = new URL('./', import.meta.url);
const sha = (value) => createHash('sha256').update(value).digest('hex');
const read = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const write = async (path, data) => writeFile(new URL(path, out), JSON.stringify(data, null, 2) + '\n');
const git = (...args) => execFileSync('git', ['--no-optional-locks', '-c', 'core.safecrlf=false', ...args], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
const previous = await read('output/k8k-tasks/TASK-017/basis.json');
const scopes = ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'tsconfig.base.json', 'tsconfig.json',
 'eslint.config.mjs', 'stylelint.config.mjs', 'apps/api', 'apps/student-cabinet', 'apps/manager-web', 'apps/platform',
 'packages/ui', 'packages/account-ui', 'packages/api-contracts', 'packages/shared', 'packages/db',
 'tests/unit/manager-http.test.mjs', 'tests/unit/manager-scope.test.mjs', 'scripts/k8k-route-budget-core.mjs',
 'scripts/k8k-route-budget.mjs', 'scripts/k8k-foundation-budget.mjs', 'scripts/generate-manager-errors.mjs'];
const paths = [...new Set(git('ls-files', '-co', '--exclude-standard', '--', ...scopes).toString().trim().split('\n'))]
 .filter(p => /\.(?:tsx?|mjs|css|json|html|yaml|woff2|sql|prisma)$/.test(p) && !p.includes('/dist/')).sort();
const sourceManifest = await Promise.all(paths.map(async path => ({ path, sha256: sha(await readFile(new URL(path, root))) })));
const changes = previous.sourceManifest.filter(entry => sourceManifest.find(e => e.path === entry.path)?.sha256 !== entry.sha256).map(e => e.path);
const allowed = ['package.json', 'apps/platform/package.json', 'apps/platform/src/App.tsx', 'apps/manager-web/src/test/fixtures.ts',
 'packages/api-contracts/openapi/openapi.json', 'packages/api-contracts/src/generated/client.ts',
 'packages/api-contracts/src/generated/openapi.ts', 'packages/api-contracts/src/generated/manager-error-codes.ts'];
assert(changes.every(path => allowed.includes(path)), `Unexpected foundation input changes: ${changes}`);
assert.equal(sourceManifest.find(e => e.path === 'pnpm-lock.yaml').sha256, previous.sourceManifest.find(e => e.path === 'pnpm-lock.yaml').sha256);
const ownerPath = 'apps/api/src/student/dashboard/dashboard.service.ts';
assert.equal(sha(await readFile(new URL(ownerPath, root))), sha(await readFile(new URL('output/k8k-tasks/TASK-005/before/'+ownerPath, root))), 'Owner dirty dashboard changed');
git('diff', '--exit-code', 'HEAD', '--', 'packages/db/prisma');
const before = await read('output/k8k-tasks/TASK-018/before.json');
const head = git('rev-parse', 'HEAD').toString().trim(), branch = git('branch', '--show-current').toString().trim();
assert.equal(head, before.head); assert.equal(branch, before.branch);
const patchSha256 = sha(git('diff', '--binary', '--full-index', 'HEAD', '--', '.', ':(exclude)docs/ui-stack.md', ':(exclude)output/**'));
const basis = { head, branch, dirtyDigest: sha(JSON.stringify({ patchSha256, sourceManifest })), patchSha256, sourceManifest,
 definition: 'SHA256(JSON.stringify({patchSha256,sourceManifest})); tracked HEAD diff excludes output/** and mutable docs/ui-stack.md; sorted scoped tracked+untracked source hashes. Env/dist/archives excluded.',
 prerequisiteDigest: previous.dirtyDigest, changedTask017Inputs: changes, preservedTask017Inputs: previous.sourceManifest.length - changes.length,
 ownerDirtyDashboardSha256: sha(await readFile(new URL(ownerPath, root))), lockfileUnchanged: true, prismaFilesGitUnchanged: true };
await write('basis.json', basis);
const cleanPolicyPath = 'apps/api/src/core/policy/policy.service.ts';
assert(!(await readFile(new URL('status-before.txt', out), 'utf8')).split('\n').some(line => line.slice(3).trim() === cleanPolicyPath));
const policyTarget = new URL('before/'+cleanPolicyPath, out); await mkdir(new URL('./',policyTarget),{recursive:true});
await writeFile(policyTarget, git('show', 'HEAD:'+cleanPolicyPath));
await cp(new URL('apps/platform/dist/staff-context-evidence/', root), new URL('browser/', out), { recursive: true });
const clientBefore = await readFile(new URL('before/packages/api-contracts/src/generated/manager-error-codes.ts', out), 'utf8');
const clientNow = await readFile(new URL('packages/api-contracts/src/generated/manager-error-codes.ts', root), 'utf8');
const codes = text => [...text.matchAll(/["']([A-Z][A-Z0-9_]+)["']/g)].map(m=>m[1]);
const addedErrorCodes = codes(clientNow).filter(code => !codes(clientBefore).includes(code));
await write('preservation.json', { task017Inputs: previous.sourceManifest.length, unchanged: basis.preservedTask017Inputs,
 changed: changes, ownerDirtyDashboard: 'byte-identical to preserved pre-foundation TASK-005 snapshot',
 policyBackup: 'HEAD canonical original; file was clean in status-before', prisma: 'tracked schema/migrations unchanged; no migration applied',
 lockfile: 'byte-identical to TASK-017', generatedManagerCodes: { before: codes(clientBefore).length, after: codes(clientNow).length, added: addedErrorCodes } });
const commands = [
 ['pnpm --filter @online-school/api build',0,'api-build-final.log'],
 ['pnpm test:k8k-staff-context',0,'staff-tests-final.log'],
 ['node --experimental-vm-modules node_modules/jest/bin/jest.js --runTestsByPath tests/unit/manager-scope.test.mjs tests/unit/manager-http.test.mjs tests/unit/manager-payments.test.mjs tests/unit/manager-payments-http.test.mjs --roots tests --runInBand',0,'existing-targeted-final.log'],
 ['pnpm --filter @online-school/api export:openapi',0,'openapi-export-final.log'],
 ['pnpm --filter @online-school/api-contracts generate:client',0,'sdk-generate-final.log'],
 ['pnpm --filter @online-school/api-contracts build',0,'contracts-build-final.log'],
 ['pnpm --filter @online-school/student-cabinet --filter @online-school/manager-web --filter @online-school/platform typecheck',0,'consumers-typecheck-final.log'],
 ['pnpm --filter @online-school/platform typecheck',0,'platform-typecheck-final.log'],
 ['pnpm --filter @online-school/platform test:staff-context',0,'browser-final.log'],
 ['pnpm --filter @online-school/platform test:account-chrome',0,'account-regression.log'],
 ['pnpm exec eslint apps/platform/src/App.tsx apps/platform/src/StaffCoverageNote.tsx apps/platform/test/staff-context/smoke.mjs --max-warnings 0',0,'frontend-lint-final.log'],
 ['pnpm exec eslint apps/api/test/staff-context-sdk.test.mjs --max-warnings 0',0,'sdk-test-lint.log'],
 ['pnpm exec eslint apps/api/test/staff-context.test.mjs --max-warnings 0',0,'final-test-lint.log'],
 ['pnpm exec prettier --check apps/api/src/modules/platform/workspace.service.ts package.json',0,'format-check-final.log'],
 ['pnpm exec stylelint apps/platform/src/staff-coverage.css --config stylelint.config.mjs',0,'css-lint.log'],
 ['node output/k8k-tasks/TASK-018/contracts-evidence.mjs',0,'contracts-evidence.log'],
 ];
commands.push(['pnpm exec eslint apps/api/src/core/actor apps/api/src/core/core.module.ts apps/api/src/core/policy/policy.service.ts apps/api/src/modules/platform apps/api/src/modules/manager/me/manager-me.service.ts apps/api/src/modules/manager/context/manager-context.ts apps/api/src/modules/manager/dto/manager-me.response.dto.ts apps/api/src/modules/manager/payments/manager-payments.controller.ts apps/api/src/modules/manager/payments/manager-payments.service.ts apps/api/src/modules/manager/finance/manager-finance.facade.ts apps/api/src/modules/schedule/outcomes.service.ts apps/api/src/modules/schedule/schedule.module.ts apps/api/src/modules/finance/payments.service.ts apps/api/src/modules/finance/finance-ledger.service.ts apps/api/src/modules/finance/manager-payments/workflow.service.ts apps/api/test/staff-context.test.mjs tests/unit/manager-http.test.mjs tests/unit/manager-scope.test.mjs apps/manager-web/src/test/fixtures.ts --max-warnings 0',0,'lint-final.log']);
await write('commands.json',commands.map(([command,exit,artifact])=>({ command,exit,artifact,
 target: command.includes('export:openapi') ? 'standard script with NODE_OPTIONS --import=file:///D:/OnlineSchool/output/k8k-tasks/TASK-018/no-db-export.mjs; DatabaseService.client access throws' : 'local compilation, schemas, mocked HTTP/SDK or intercepted browser; no DB/provider' })));
console.log({dirtyDigest:basis.dirtyDigest, sourceInputs:sourceManifest.length, preservedTask017:basis.preservedTask017Inputs, changed:changes, addedErrorCodes});
