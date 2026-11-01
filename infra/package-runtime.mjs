import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';

// Run in the Docker build context. Keep installed package bytes and pnpm peer contexts;
// packaging must never resolve a new dependency version or run lifecycle scripts.
const root = process.cwd();
const output = resolve(process.argv[2]);
const inside = (parent, child) => {
  const path = relative(parent, child);
  return path === '' || (!path.startsWith(`..${sep}`) && path !== '..' && !isAbsolute(path));
};
if (inside(root, output) || inside(output, root) || existsSync(output))
  throw new Error('Runtime output must be a new directory outside the workspace.');
const store = resolve(root, 'node_modules/.pnpm');
const retained = new Set();
const binaries = new Set();
const projects = ['.'];
for (const parent of ['apps', 'packages']) {
  for (const entry of readdirSync(parent, { withFileTypes: true })) {
    const path = `${parent}/${entry.name}`;
    if (entry.isDirectory() && existsSync(`${path}/package.json`)) projects.push(path);
  }
}

function visit(target) {
  const physical = realpathSync(target);
  if (!inside(root, physical)) throw new Error('Dependency resolves outside the build workspace.');
  if (!inside(store, physical)) return; // Workspace source is copied separately.
  const entry = relative(store, physical).split(sep)[0];
  if (entry === 'node_modules') throw new Error('Expected a resolved pnpm package entry.');
  if (retained.has(entry)) return;
  retained.add(entry);
  const directory = resolve(store, entry, 'node_modules');
  for (const child of readdirSync(directory, { withFileTypes: true })) {
    if (child.name.startsWith('.')) continue;
    const path = resolve(directory, child.name);
    if (child.name.startsWith('@')) {
      for (const scoped of readdirSync(path)) visit(resolve(path, scoped));
    } else if (child.isSymbolicLink()) visit(path);
    else {
      const manifest = JSON.parse(readFileSync(resolve(path, 'package.json'), 'utf8'));
      if (typeof manifest.bin === 'string') binaries.add(manifest.name.split('/').at(-1));
      else for (const name of Object.keys(manifest.bin ?? {})) binaries.add(name);
    }
  }
}

for (const project of projects) {
  const manifest = JSON.parse(readFileSync(resolve(project, 'package.json'), 'utf8'));
  const dependencies =
    project === '.'
      ? ['typescript', '@types/node'] // Preserve the documented DB build/seed commands.
      : Object.keys({ ...manifest.dependencies, ...manifest.optionalDependencies });
  // Prisma CLI/config and PG types remain available for maintenance in the API image.
  if (project === 'packages/db') dependencies.push(...Object.keys(manifest.devDependencies ?? {}));
  // The Docker context contains the frontend manifest for frozen workspace installation only.
  if (project === 'apps/qa-shell') continue;
  for (const name of dependencies) {
    const path = resolve(project, 'node_modules', name);
    if (!existsSync(path)) {
      if (manifest.optionalDependencies?.[name]) continue;
      throw new Error(`Missing installed dependency: ${project}/${name}`);
    }
    visit(path);
  }
}

const copy = (from, to, filter) =>
  cpSync(from, to, { recursive: true, dereference: false, verbatimSymlinks: true, filter });
mkdirSync(output, { recursive: true });
for (const entry of readdirSync(root)) {
  if (entry === 'node_modules') continue;
  copy(
    resolve(root, entry),
    resolve(output, entry),
    (path) => !relative(root, path).split(sep).includes('node_modules'),
  );
}
for (const entry of retained)
  copy(resolve(store, entry), resolve(output, 'node_modules/.pnpm', entry));

function copyLinks(from, to) {
  if (!existsSync(from)) return;
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    const path = resolve(from, entry.name),
      destination = resolve(to, entry.name);
    if (entry.name === '.pnpm') continue;
    if (entry.name === '.bin') {
      for (const bin of readdirSync(path))
        if (binaries.has(bin) || binaries.has(bin.replace(/\.(cmd|ps1)$/, ''))) {
          mkdirSync(dirname(resolve(destination, bin)), { recursive: true });
          copy(resolve(path, bin), resolve(destination, bin));
        }
    } else if (entry.name.startsWith('@')) copyLinks(path, destination);
    else if (entry.isSymbolicLink()) {
      const physical = realpathSync(path);
      const keep =
        !inside(store, physical) || retained.has(relative(store, physical).split(sep)[0]);
      if (keep) {
        mkdirSync(dirname(destination), { recursive: true });
        copy(path, destination);
      }
    }
  }
}
for (const project of projects)
  copyLinks(resolve(root, project, 'node_modules'), resolve(output, project, 'node_modules'));
copyLinks(resolve(store, 'node_modules'), resolve(output, 'node_modules/.pnpm/node_modules'));
console.log(
  JSON.stringify({
    retainedStoreEntries: retained.size,
    installedStoreEntries: readdirSync(store).filter(
      (name) => name !== 'node_modules' && existsSync(resolve(store, name, 'node_modules')),
    ).length,
  }),
);
