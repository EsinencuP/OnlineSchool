// Production Vite graph only. Builds in memory with no .env loading or app server.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const results = [];
for (const app of ['student-cabinet', 'manager-web', 'platform']) {
  const root = fileURLToPath(new URL(`../../../apps/${app}/`, import.meta.url));
  let chunks = [];
  await build({
    root,
    envDir: false,
    logLevel: 'error',
    build: { write: false },
    plugins: [
      {
        name: 'catalog-exclusion-check',
        generateBundle(_options, bundle) {
          chunks = Object.values(bundle).filter((file) => file.type === 'chunk');
          for (const chunk of chunks) {
            for (const id of Object.keys(chunk.modules)) {
              assert.doesNotMatch(
                id.replaceAll('\\', '/'),
                /(?:\/storybook(?:\/|@)|\/@storybook\/|\/packages\/ui\/(?:\.storybook|stories)\/)/u,
                `${app}: ${chunk.fileName} includes catalog module`,
              );
            }
          }
        },
      },
    ],
  });
  assert(chunks.length > 0, `Missing production chunks for ${app}`);
  results.push({ app, chunks: chunks.length, storybookModules: 0 });
}
const evidence = new URL('../dist/storybook-evidence/app-chunks.json', import.meta.url);
await mkdir(new URL('.', evidence), { recursive: true });
await writeFile(evidence, JSON.stringify(results, null, 2) + '\n');
console.log(results);
