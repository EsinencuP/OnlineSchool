import { expect, test } from '@jest/globals';
import { readFile } from 'node:fs/promises';
import { parseSchema, renderErd } from '../support/schema-contract.mjs';
test('reviewed ERD and column/FK contract match the current Prisma schema', async () => {
  const models = parseSchema(
    await readFile(new URL('../../packages/db/prisma/schema.prisma', import.meta.url), 'utf8'),
  );
  const recorded = JSON.parse(
    await readFile(new URL('../../packages/db/schema.contract.json', import.meta.url), 'utf8'),
  );
  expect(recorded).toEqual(models);
  expect(await readFile(new URL('../../packages/db/ERD.md', import.meta.url), 'utf8')).toBe(
    renderErd(models),
  );
});
