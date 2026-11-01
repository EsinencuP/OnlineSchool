import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));
const slash = (value) => value.replaceAll('\\', '/');
const listed = execFileSync(
  'git',
  ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
  { cwd: root, encoding: 'utf8' },
);
const files = [
  ...new Set(
    listed
      .split('\0')
      .filter(
        (path) =>
          (/^(apps|packages)\/[^/]+\/(src|api)\/.*\.(ts|tsx)$/.test(path) ||
            /^api\/.*\.ts$/.test(path)) &&
          !path.includes('/generated/'),
      ),
  ),
];
if (!files.length) throw new Error('Cycle analysis must process real source files.');

const aliases = {};
for (const parent of ['apps', 'packages']) {
  for (const entry of readdirSync(resolve(root, parent), { withFileTypes: true })) {
    const directory = `${parent}/${entry.name}`;
    if (!entry.isDirectory() || !existsSync(resolve(root, directory, 'package.json'))) continue;
    const manifest = JSON.parse(readFileSync(resolve(root, directory, 'package.json'), 'utf8'));
    for (const [key, output] of Object.entries(manifest.exports ?? {})) {
      if (!output.import) continue;
      const source = output.import.replace(/^\.\/dist\//, 'src/').replace(/\.js$/, '.ts');
      aliases[manifest.name + (key === '.' ? '' : key.slice(1))] = `${directory}/${source}`;
    }
  }
}
const canonical = (filename) => slash(relative(root, filename));
const known = new Set(files);
const graph = Object.fromEntries(files.map((file) => [file, []]));
const unresolved = [];
for (const file of files) {
  const text = readFileSync(resolve(root, file), 'utf8');
  for (const entry of ts.preProcessFile(text, true, true).importedFiles) {
    const specifier = entry.fileName;
    let target = aliases[specifier];
    if (!target && specifier.startsWith('.')) {
      const resolved = ts.resolveModuleName(
        specifier,
        resolve(root, file),
        {
          module: ts.ModuleKind.NodeNext,
          moduleResolution: ts.ModuleResolutionKind.NodeNext,
          jsx: ts.JsxEmit.ReactJSX,
        },
        ts.sys,
      ).resolvedModule?.resolvedFileName;
      if (resolved) target = canonical(resolved);
      if (target?.includes('/dist/'))
        target = target.replace('/dist/', '/src/').replace(/\.d\.ts$/, '.ts');
      if (!target && /\.(js|ts|tsx)$/.test(specifier)) unresolved.push({ file, specifier });
    }
    if (target && known.has(target)) graph[file].push(target);
  }
  graph[file] = [...new Set(graph[file])].sort();
}
if (unresolved.length) throw new Error(`Unresolved local imports: ${JSON.stringify(unresolved)}`);

// Explicit stdin graph avoids Madge skipping an entire worktree under an ignored .codex directory.
// It includes type imports/re-exports and every first-party source, including unreferenced files.
const command = ['dlx', 'madge@8.0.0', '--stdin', '--circular', '--json', '--no-spinner'];
const result = spawnSync('pnpm', command, {
  cwd: root,
  shell: process.platform === 'win32',
  input: JSON.stringify(graph),
  encoding: 'utf8',
  maxBuffer: 10 * 1024 * 1024,
});
const output = result.stdout ?? '';
const begin = output.indexOf('['),
  end = output.lastIndexOf(']');
if (result.error || begin < 0 || end < begin)
  throw new Error('Madge did not return a cycle result.');
const cycles = JSON.parse(output.slice(begin, end + 1));
const report = {
  files: files.length,
  edges: Object.values(graph).reduce((n, edges) => n + edges.length, 0),
  cycles,
  madge: '8.0.0',
  command: `pnpm ${command.join(' ')}`,
  unresolvedLocalImports: unresolved,
};
console.log(JSON.stringify(report, null, 2));
if (result.status !== 0 || cycles.length) process.exitCode = 1;
