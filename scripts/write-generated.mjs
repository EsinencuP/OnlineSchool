import { readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
/** Avoid truncating a file mapped by an editor on Windows; unchanged generation is a no-op. */
export async function writeGenerated(target, content) {
  try {
    if ((await readFile(target, 'utf8')) === content) return false;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const temporary =
    target instanceof URL
      ? new URL(`${target.href}.${randomUUID()}.tmp`)
      : `${target}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, content, 'utf8');
    await rename(temporary, target);
    return true;
  } finally {
    await unlink(temporary).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    });
  }
}
