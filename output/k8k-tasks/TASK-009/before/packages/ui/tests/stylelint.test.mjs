import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import stylelint from 'stylelint';
import config from '../../../stylelint.config.mjs';
import { compareBaseline } from '../../../scripts/k8k-stylelint.mjs';
import { tokenFile } from '../../../scripts/stylelint-k8k.mjs';
const root = fileURLToPath(new URL('../../../', import.meta.url));
async function check(code, codeFilename = `${root}packages/ui/src/probe.css`) {
  return stylelint.lint({ code, codeFilename, config, ignoreDisables: true });
}
for (const value of [
  '#0392bc',
  'red',
  'rgb(3 146 188 / 50%)',
  'oklch(60% .1 200)',
  'var(--missing, #fff)',
])
  test(`rejects raw color ${value}`, async () =>
    assert.equal((await check(`.new{color:${value}}`)).errored, true));
for (const declaration of [
  'font-size:14px',
  'font-size:clamp(12px,2vw,18px)',
  'font-size:small',
  'font-size:var(--local-font-size)',
  'font-size:var(--k8k-space-4)',
  'font:14px sans-serif',
  'font:var(--local-font-shorthand)',
  'box-shadow:0 1px 3px #0001',
  'background:linear-gradient(#fff,transparent)',
  '--new-color:#fff',
  'color:var(--k8k-accent)',
  'background:var(--k8k-accent)',
  'color:var(--brand-text,#fff)',
])
  test(`rejects ${declaration}`, async () =>
    assert.equal((await check(`.new{${declaration}}`)).errored, true));
test('tokens file is the only literal boundary, not any file named tokens.css', async () => {
  assert.equal((await check(':root[data-k8k]{--probe:#fff}', tokenFile)).errored, false);
  assert.equal(
    (await check(':root{--probe:#fff}', `${root}apps/platform/src/tokens.css`)).errored,
    true,
  );
});
test('tokenized shadows/alpha and contextual colors need no broad exception', async () => {
  const result = await check(
    '.new{box-shadow:var(--k8k-shadow);background:var(--k8k-nav-hover);border:1px solid currentColor;font-size:var(--k8k-font-body);color:inherit;font-weight:700;z-index:100;min-height:44px}.next{background:transparent;content:"red #fff";mask:url("/red.svg")}',
  );
  assert.equal(result.errored, false, JSON.stringify(result.results[0].warnings));
});
test('stylelint disable comments cannot bypass the scoped checker', async () => {
  assert.equal((await check('/* stylelint-disable */ .new{color:#fff}')).errored, true);
});
test('tokenized font shorthand and numeric line height are not raw font sizes', async () => {
  assert.equal((await check('.new{font:var(--k8k-font-body)/1.5 var(--k8k-font)}')).errored, false);
});
test('precise legacy baseline fails new, changed, duplicate or stale declarations', () => {
  const old = {
    file: 'apps/platform/src/style.css',
    rule: 'k8k/token-values',
    text: 'exact source identity',
    removeInTask: 'TASK-064',
  };
  assert.deepEqual(compareBaseline([old], [old]), { unexpected: [], stale: [] });
  assert.equal(compareBaseline([{ ...old, text: 'new value' }], [old]).unexpected.length, 1);
  assert.equal(compareBaseline([old, old], [old]).unexpected.length, 1);
  assert.equal(compareBaseline([], [old]).stale.length, 1);
  assert.throws(
    () => compareBaseline([], [{ ...old, file: 'packages/ui/src/style.css' }]),
    /cannot/,
  );
  assert.throws(() => compareBaseline([], [{ ...old, removeInTask: '' }]), /removal/);
});
test('actual Stylelint CLI returns nonzero for a new raw hex declaration', () => {
  const cli = fileURLToPath(
    new URL('../../../node_modules/stylelint/bin/stylelint.mjs', import.meta.url),
  );
  const result = spawnSync(
    process.execPath,
    [
      cli,
      '--config',
      'stylelint.config.mjs',
      '--stdin',
      '--stdin-filename',
      'packages/ui/src/new.css',
    ],
    { cwd: root, input: '.new{color:#fff}', encoding: 'utf8' },
  );
  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stdout + result.stderr, /raw-color/);
});
