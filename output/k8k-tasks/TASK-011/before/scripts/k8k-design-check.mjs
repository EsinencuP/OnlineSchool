// Scoped local-only design checks; no application builds or environment access.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
for (const args of [
  ['--test', 'packages/ui/tests/contrast.test.mjs', 'packages/ui/tests/stylelint.test.mjs'],
  ['scripts/k8k-stylelint.mjs'],
]) {
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
    break;
  }
}
