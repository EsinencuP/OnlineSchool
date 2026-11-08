// Rebuild the initial UI from the pre-edit snapshot without changing the working tree.
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const snapshot = new URL('./', import.meta.url);
const repo = fileURLToPath(new URL('../../../', snapshot));
const app = resolve(repo, 'apps/student-cabinet');
const require = createRequire(resolve(app, 'package.json'));
const { build } = await import(pathToFileURL(require.resolve('vite')));
const basis = JSON.parse(await readFile(new URL('before.json', snapshot), 'utf8'));
const sources = new Map();
for (const { path, sha256 } of basis.paths) {
  if (!/\.(tsx?|css)$/.test(path)) continue;
  const file = await readFile(new URL('before/' + path, snapshot));
  if (createHash('sha256').update(file).digest('hex') !== sha256)
    throw new Error('Baseline file digest differs: ' + path);
  sources.set(resolve(repo, path), file.toString('utf8'));
}
await build({
  root: app,
  envDir: false,
  publicDir: false,
  logLevel: 'error',
  plugins: [{
    name: 'task-025-original-sources',
    enforce: 'pre',
    load(id) { return sources.get(resolve(id.split('?')[0])); },
  }],
  build: {
    emptyOutDir: false,
    outDir: fileURLToPath(new URL('baseline-dist/', snapshot)),
  },
});
