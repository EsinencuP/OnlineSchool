import { test, expect } from '@jest/globals';
import { ESLint } from 'eslint';
import { readFile } from 'node:fs/promises';
const eslint = new ESLint();
test.each([
  'export const unsafe = (amount: string) => Number(amount);',
  'export const unsafe = (amount: string) => parseFloat(amount);',
  'export const unsafe = (amount: string) => Number.parseFloat(amount);',
  'export const unsafe = (amount: {toNumber():number}) => amount.toNumber();',
  'export const unsafe = () => fetch("/api/v1/manager/me");',
  'export const unsafe = () => <p dangerouslySetInnerHTML={{__html:"untrusted"}} />;',
])('manager frontend lint rejects unsafe conversion/transport/rendering: %s', async (source) => {
  const [result] = await eslint.lintText(source, { filePath: 'apps/manager-web/src/probe.tsx' });
  expect(result.messages.some((m) => m.ruleId === 'no-restricted-syntax')).toBe(true);
});
test('deployment mounts manager SPA before the root shell without embedding mocks', async () => {
  const config = JSON.parse(await readFile('vercel.json', 'utf8'));
  expect(config.rewrites.findIndex((r) => r.source === '/manager/:path*')).toBeLessThan(
    config.rewrites.findIndex((r) => r.source === '/:path*'),
  );
  expect(config.headers.find((h) => h.source === '/manager/:path*').headers).toContainEqual({
    key: 'Cache-Control',
    value: 'no-store',
  });
  expect(await readFile('infra/vercel/build.mjs', 'utf8')).toContain(
    "cpSync('apps/manager-web/dist', 'apps/qa-shell/dist/manager'",
  );
});
