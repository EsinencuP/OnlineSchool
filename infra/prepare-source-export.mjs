// Prepare a reviewable source-only export. Does not commit, push, or rewrite local Git history.
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parseEnv } from 'node:util';

const root = new URL('../', import.meta.url);
const files = [
  'README.md',
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'turbo.json',
  'tsconfig.base.json',
  'tsconfig.json',
  'eslint.config.mjs',
  '.npmrc',
  '.nvmrc',
  '.gitignore',
  '.dockerignore',
  '.env.example',
  '.prettierrc.json',
  '.prettierignore',
  '.editorconfig',
  'PHASE0_CHECKS.md',
  'docker-compose.yml',
  'docker-compose.vps.yml',
  'nginx.conf',
];
async function walk(rel) {
  for (const entry of await readdir(new URL(rel + '/', root), { withFileTypes: true })) {
    const path = `${rel}/${entry.name}`;
    if (entry.isDirectory()) {
      if (
        ['node_modules', 'dist', 'dist-tools', '.turbo', '.vercel', 'coverage'].includes(
          entry.name,
        ) ||
        path === 'packages/db/src/generated'
      )
        continue;
      await walk(path);
    } else if (
      entry.isFile() &&
      (entry.name === 'Dockerfile' ||
        entry.name === '.env.example' ||
        /\.(ts|tsx|js|mjs|cjs|json|yaml|yml|sql|toml|md|css|html|prisma|conf|template|sh)$/.test(
          entry.name,
        )) &&
      !entry.name.startsWith('.env') &&
      !entry.name.endsWith('.tsbuildinfo')
    )
      files.push(path);
    else if (entry.name === '.env.example') files.push(path);
  }
}
for (const rel of ['apps', 'packages', 'infra', '.github']) await walk(rel);
for (const file of await readdir(new URL('scripts/', root)))
  if (file.endsWith('.mjs')) files.push('scripts/' + file);
const secrets = [];
let unreadablePrivateFiles = 0;
function collect(text, json) {
  const values = json ? JSON.parse(text) : parseEnv(text);
  for (const [key, value] of Object.entries(values)) {
    if (
      typeof value !== 'string' ||
      value.length < 20 ||
      !/password|secret|database_url|direct_url/i.test(key)
    )
      continue;
    secrets.push(value);
    if (value.startsWith('postgres')) secrets.push(decodeURIComponent(new URL(value).password));
  }
}
collect(await readFile(new URL('.env', root), 'utf8'), false);
for (const file of await readdir(new URL('.identity-ops/', root))) {
  if (file.endsWith('.json') || file.endsWith('.env.local')) {
    try {
      collect(
        await readFile(new URL('.identity-ops/' + file, root), 'utf8'),
        file.endsWith('.json'),
      );
    } catch (error) {
      if (!['EPERM', 'EACCES'].includes(error.code)) throw error;
      // Excluded from the allow-list; do not widen private Windows ACLs for an export.
      unreadablePrivateFiles++;
    }
  }
}
const entries = [];
for (const path of [...new Set(files)].sort()) {
  const content = await readFile(new URL(path, root), 'utf8');
  if (
    secrets.filter(Boolean).some((secret) => content.includes(secret)) ||
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(content) ||
    /postgres(?:ql)?:\/\/[^\s'"<>]+@[^\s'"<>]+\.neon\.tech/.test(content)
  )
    throw new Error(`Private material detected in ${path}`);
  entries.push({ path, mode: '100644', type: 'blob', content });
}
await mkdir(new URL('.codex/', root), { recursive: true });
await writeFile(new URL('.codex/task13-source-export.json', root), JSON.stringify(entries));
const bytes = entries.reduce((sum, entry) => sum + Buffer.byteLength(entry.content), 0);
const sha256 = createHash('sha256').update(JSON.stringify(entries)).digest('hex');
console.log(
  JSON.stringify({
    files: entries.length,
    bytes,
    sha256,
    privateMaterial: 'none',
    unreadablePrivateFilesExcluded: unreadablePrivateFiles,
    excludes:
      'Git history, corpus/media, private ops/env files, generated runtime and local outputs',
  }),
);
