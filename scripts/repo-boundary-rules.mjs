import { readFileSync, readdirSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const slash = (value) => value.replaceAll('\\', '/');
const location = (value) => slash(relative(root, value));
const workspaces = new Map();
for (const parent of ['apps', 'packages']) {
  for (const entry of readdirSync(resolve(root, parent), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    try {
      const path = `${parent}/${entry.name}`;
      const manifest = JSON.parse(readFileSync(resolve(root, path, 'package.json'), 'utf8'));
      workspaces.set(manifest.name, { path, manifest });
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
}

// Existing OpenAPI composition dependencies: frozen after the DTO move was rolled back.
// No domain-module dependency is permitted by these exceptions.
const legacyCoreComposition = new Set([
  'apps/api/src/core/core.module.ts>apps/api/src/openapi/dto-validation.pipe.js',
  'apps/api/src/core/csrf/csrf.module.ts>apps/api/src/openapi/dtos.js',
  'apps/api/src/core/errors/domain-error.ts>apps/api/src/openapi/dtos.js',
]);

function target(source, filename) {
  if (source.startsWith('.')) return location(resolve(dirname(filename), source));
  const match = source.match(/^(@online-school\/[^/]+)(.*)$/);
  const workspace = match && workspaces.get(match[1]);
  if (!workspace) return undefined;
  const key = match[2] ? `.${match[2]}` : '.';
  const entry = workspace.manifest.exports?.[key]?.import;
  return entry
    ? `${workspace.path}/${entry.replace(/^\.\//, '').replace(/^dist\//, 'src/')}`
    : `${workspace.path}/<private-entrypoint>`;
}

const importVisitors = (check) => ({
  ImportDeclaration: (node) => check(node.source),
  ExportNamedDeclaration: (node) => node.source && check(node.source),
  ExportAllDeclaration: (node) => check(node.source),
  ImportExpression: (node) => check(node.source),
  CallExpression: (node) => {
    if (node.callee.type === 'Identifier' && node.callee.name === 'require')
      check(node.arguments[0]);
  },
});

export const repositoryRules = {
  boundaries: {
    meta: { type: 'problem', schema: [], messages: { forbidden: '{{reason}}' } },
    create(context) {
      const filename = context.filename;
      const from = location(filename);
      return importVisitors((node) => {
        if (typeof node?.value !== 'string') return;
        const to = target(node.value, filename);
        if (!to) return;
        let reason;
        if (from.startsWith('packages/') && to.startsWith('apps/'))
          reason = 'Packages must not depend on applications.';
        const app = from.match(/^apps\/(api|worker)\//)?.[1];
        if (app && to.startsWith(`apps/${app === 'api' ? 'worker' : 'api'}/`))
          reason = 'API and worker share implementations only through packages/*.';
        if (from.startsWith('apps/api/src/core/') && to.startsWith('apps/api/src/')) {
          if (!to.startsWith('apps/api/src/core/') && !legacyCoreComposition.has(`${from}>${to}`))
            reason = 'Core cannot depend on domain modules or application composition.';
        }
        const ownModule = from.match(/^apps\/api\/src\/modules\/([^/]+)\//)?.[1];
        const otherModule = to.match(/^apps\/api\/src\/modules\/([^/]+)\/(.*)$/);
        if (ownModule && otherModule && ownModule !== otherModule[1]) {
          if (otherModule[2] !== 'index.js' && !otherModule[2].startsWith('ports/'))
            reason = 'Cross-module imports must use the public index.js or ports/.';
        }
        if (reason) context.report({ node, messageId: 'forbidden', data: { reason } });
      });
    },
  },
  'esm-relative-imports': {
    meta: {
      type: 'problem',
      schema: [],
      messages: { extension: 'Relative server imports require .js.' },
    },
    create(context) {
      return importVisitors((node) => {
        if (
          typeof node?.value === 'string' &&
          node.value.startsWith('.') &&
          !node.value.endsWith('.js')
        )
          context.report({ node, messageId: 'extension' });
      });
    },
  },
  'decimal-money': {
    meta: {
      type: 'problem',
      schema: [],
      messages: { number: 'Money uses decimal strings or Decimal, never number/float conversion.' },
    },
    create(context) {
      const money = (name) =>
        /^(amount|balance|price|rate|debit|credit|fullPrice|unitPrice|exceptionAmount)$/i.test(
          name ?? '',
        );
      const name = (node) =>
        node?.type === 'Identifier'
          ? node.name
          : node?.type === 'MemberExpression'
            ? node.property.name
            : undefined;
      return {
        TSNumberKeyword(node) {
          const field = node.parent?.parent;
          if (
            ['PropertyDefinition', 'TSPropertySignature'].includes(field?.type) &&
            money(field.key?.name)
          )
            context.report({ node, messageId: 'number' });
        },
        CallExpression(node) {
          const unsafe = ['Number', 'parseFloat'].includes(name(node.callee));
          if (unsafe && money(name(node.arguments[0])))
            context.report({ node, messageId: 'number' });
          if (
            node.callee.type === 'MemberExpression' &&
            node.callee.property.name === 'toNumber' &&
            money(name(node.callee.object))
          )
            context.report({ node, messageId: 'number' });
        },
      };
    },
  },
};
