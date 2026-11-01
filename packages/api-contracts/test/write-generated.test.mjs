import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';
import { writeGenerated } from '../../../scripts/write-generated.mjs';

test('unchanged generation preserves bytes and modification time; changed output is replaced', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'online-school-codegen-'));
  try {
    const file = join(directory, 'output.ts');
    assert.equal(await writeGenerated(file, 'export type Value = string;\n'), true);
    const before = await stat(file, { bigint: true });
    assert.equal(await writeGenerated(file, 'export type Value = string;\n'), false);
    assert.equal((await stat(file, { bigint: true })).mtimeNs, before.mtimeNs);
    assert.equal(await readFile(file, 'utf8'), 'export type Value = string;\n');
    assert.equal(await writeGenerated(file, 'export type Value = number;\n'), true);
    assert.equal(await readFile(file, 'utf8'), 'export type Value = number;\n');
    assert.deepEqual(await readdir(directory), ['output.ts']);
  } finally {
    await rm(directory, { recursive: true });
  }
});

test('generation supports file URLs containing spaces and propagates filesystem failures', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'online-school-codegen-'));
  try {
    const file = pathToFileURL(join(directory, 'output with spaces.ts'));
    assert.equal(await writeGenerated(file, 'content'), true);
    assert.equal(await writeGenerated(file, 'content'), false);
    await assert.rejects(writeGenerated(pathToFileURL(directory), 'content'), { code: 'EISDIR' });
    assert.deepEqual(await readdir(directory), ['output with spaces.ts']);
  } finally {
    await rm(directory, { recursive: true });
  }
});
