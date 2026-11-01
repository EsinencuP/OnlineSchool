import assert from 'node:assert/strict';
import test from 'node:test';
import { ESLint } from 'eslint';
import { readFile } from 'node:fs/promises';

const eslint = new ESLint();
const violations = [
  [
    'apps/api/src/core/policy/probe.ts',
    "import '../../modules/finance/index.js';",
    'repository/boundaries',
  ],
  [
    'apps/api/src/modules/schedule/probe.ts',
    "import '../finance/payments.service.js';",
    'repository/boundaries',
  ],
  [
    'apps/api/src/modules/schedule/probe.ts',
    "export * from '../finance/payments.service.js';",
    'repository/boundaries',
  ],
  [
    'apps/api/src/modules/schedule/probe.ts',
    "export const load = () => import('../finance/payments.service.js');",
    'repository/boundaries',
  ],
  ['apps/api/src/core/probe.ts', "import '../openapi/dtos.js';", 'repository/boundaries'],
  [
    'apps/worker/src/probe.ts',
    "import '@online-school/api/finance-expiry';",
    'repository/boundaries',
  ],
  [
    'packages/shared/src/probe.ts',
    "import '../../../apps/api/src/core/http.js';",
    'repository/boundaries',
  ],
  ['apps/api/src/probe.ts', "export * from './service';", 'repository/esm-relative-imports'],
  [
    'apps/api/src/probe.ts',
    'export type Receipt = { amount: number };',
    'repository/decimal-money',
  ],
  [
    'apps/api/src/probe.ts',
    'export const bad = (amount: string) => parseFloat(amount);',
    'repository/decimal-money',
  ],
  ['apps/api/src/probe.ts', "throw new Error('bad');", 'no-restricted-syntax'],
];
for (const [filePath, code, rule] of violations) {
  test(`reject ${rule}: ${filePath}: ${code}`, async () => {
    const [result] = await eslint.lintText(code, { filePath });
    assert.ok(
      result.messages.some((message) => message.ruleId === rule),
      JSON.stringify(result.messages),
    );
  });
}
test('public modules, precise strings and lower packages remain permitted', async () => {
  for (const [filePath, code] of [
    [
      'apps/api/src/modules/schedule/probe.ts',
      "import '../finance/index.js'; export type Money = { amount: string; count: number };",
    ],
    ['apps/worker/src/probe.ts', "import '@online-school/jobs';"],
    ['packages/jobs/src/probe.ts', "import '@online-school/server-kernel';"],
  ]) {
    const [result] = await eslint.lintText(code, { filePath });
    assert.equal(result.errorCount, 0, JSON.stringify(result.messages));
  }
});
test('worker has no API dependency or API project reference', async () => {
  const manifest = JSON.parse(
    await readFile(new URL('../apps/worker/package.json', import.meta.url)),
  );
  const config = JSON.parse(
    await readFile(new URL('../apps/worker/tsconfig.json', import.meta.url)),
  );
  assert.equal(manifest.dependencies['@online-school/api'], undefined);
  assert.ok(config.references.every((entry) => entry.path !== '../api'));
});
