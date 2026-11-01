import { readFile, unlink } from 'node:fs/promises';
import { writeGenerated } from '../../../scripts/write-generated.mjs';
const staged = new URL('../src/generated/client.next.ts', import.meta.url);
await writeGenerated(
  new URL('../src/generated/client.ts', import.meta.url),
  await readFile(staged, 'utf8'),
);
await unlink(staged);
