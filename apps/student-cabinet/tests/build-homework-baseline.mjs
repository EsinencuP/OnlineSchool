import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const root = new URL('../', import.meta.url);
const original = new URL(
  '../../../output/k8k-tasks/TASK-030/before/apps/student-cabinet/src/pages/Homework.tsx',
  import.meta.url,
);
const target = fileURLToPath(new URL('src/pages/Homework.tsx', root)).replaceAll('\\', '/');
const tests = new URL('../../../output/k8k-tasks/TASK-030/baseline-tests/', import.meta.url);
await mkdir(tests, { recursive: true });
const savedTest = await readFile(
  new URL(
    '../../../output/k8k-tasks/TASK-030/before/apps/student-cabinet/tests/student.spec.mjs',
    import.meta.url,
  ),
  'utf8',
);
await writeFile(
  new URL('student.spec.mjs', tests),
  savedTest.replace(
    "'./fixture-server.mjs'",
    JSON.stringify(new URL('fixture-server.mjs', import.meta.url).href),
  ),
);
await build({
  root: fileURLToPath(root),
  envDir: false,
  publicDir: false,
  logLevel: 'error',
  plugins: [
    {
      name: 'task-030-saved-editor-source',
      enforce: 'pre',
      load(id) {
        if (id.replaceAll('\\', '/') === target) return readFile(original, 'utf8');
      },
    },
  ],
  build: { outDir: '../../output/k8k-tasks/TASK-030/baseline-dist', emptyOutDir: false },
});
