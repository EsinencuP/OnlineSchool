import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import ts from 'typescript';
import { storyNameFromExport, toId } from 'storybook/internal/csf';
import * as ui from '../dist/index.js';

const catalog = new URL('../dist/storybook/index.json', import.meta.url);
const evidence = new URL('../dist/storybook-evidence/coverage.json', import.meta.url);
const { entries } = JSON.parse(await readFile(catalog, 'utf8'));

const nonComponents = {
  activeNavigation: 'Navigation lookup',
  cabinetLabels: 'Role label data',
  calendarDate: 'Date parser',
  describeError: 'Safe error display policy',
  errorText: 'Localized error formatter',
  errorMessageKeys: 'Error-code dictionary lookup derived from translations',
  formatDate: 'Instant date formatter',
  formatDateOnly: 'Civil date formatter',
  formatDateTime: 'Instant date and time formatter',
  formatMoneyAmount: 'Exact decimal string formatter',
  formatRelativeTime: 'Relative time formatter',
  formatTime: 'Instant time formatter',
  FreshnessTimeZone: 'React context consumed by FreshnessLabel',
  initializeK8KTheme: 'Browser theme initializer',
  initializeLocale: 'Browser locale initializer',
  intlLocaleFor: 'Intl locale mapping',
  isEditing: 'Refresh policy predicate',
  isPlainMessageKey: 'Plain dictionary key guard',
  k8kEnabled: 'Presentation flag',
  operationalQueryInterval: 'Refresh policy lookup',
  queryBoundaryState: 'Query state adapter',
  refreshPolicies: 'Refresh policy data',
  roleNavigation: 'Navigation data rendered by AppShell',
  setLocale: 'Locale store setter',
  translate: 'Typed message lookup',
  useContextRefresh: 'Refresh hook',
  useDataAge: 'Freshness hook',
  useLocale: 'Locale hook',
  useFieldError: 'Form validation context hook',
};
const aliases = { AlertDialog: 'ConfirmDialog' };
const sources = new Map();
const covered = new Map();
const stories = Object.values(entries).filter((entry) => entry.type === 'story');

function parse(file, contents) {
  const source = ts.createSourceFile(
    file,
    contents,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const locals = new Map();
  const imports = new Map();
  for (const statement of source.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name) {
      locals.set(statement.name.text, statement);
    }
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && declaration.initializer) {
          locals.set(declaration.name.text, declaration.initializer);
        }
      }
    }
    if (
      ts.isImportDeclaration(statement) &&
      statement.moduleSpecifier.text === '../src/index.js' &&
      statement.importClause?.namedBindings &&
      ts.isNamedImports(statement.importClause.namedBindings)
    ) {
      for (const binding of statement.importClause.namedBindings.elements) {
        imports.set(binding.name.text, binding.propertyName?.text ?? binding.name.text);
      }
    }
  }
  return { locals, imports };
}

for (const story of stories) {
  const file = new URL(story.importPath, new URL('../', import.meta.url));
  if (!sources.has(file.href)) {
    sources.set(file.href, parse(file.pathname, await readFile(file, 'utf8')));
  }
  const { locals, imports } = sources.get(file.href);
  const exportName = [...locals.keys()].find(
    (name) => toId(story.title, storyNameFromExport(name)) === story.id,
  );
  const declaration = locals.get(exportName);
  assert(
    declaration && ts.isObjectLiteralExpression(declaration),
    `Expected CSF object for ${story.id}`,
  );
  const render = declaration.properties.find(
    (property) => ts.isPropertyAssignment(property) && property.name.getText() === 'render',
  );
  assert(render, `Missing explicit render for ${story.id}`);

  const visited = new Set();
  function visit(node) {
    if (visited.has(node)) return;
    visited.add(node);
    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      ts.isIdentifier(node.tagName)
    ) {
      const component = imports.get(node.tagName.text);
      if (component && component in ui) {
        const ids = covered.get(component) ?? new Set();
        ids.add(story.id);
        covered.set(component, ids);
      }
    }
    if (ts.isIdentifier(node) && locals.has(node.text)) visit(locals.get(node.text));
    ts.forEachChild(node, visit);
  }
  visit(render.initializer);
}

for (const name of Object.keys(nonComponents)) {
  assert(name in ui && !covered.has(name), `Outdated exclusion: ${name}`);
}
for (const [alias, component] of Object.entries(aliases)) {
  assert(ui[alias] && ui[alias] === ui[component], `Outdated alias: ${alias}`);
  covered.set(alias, covered.get(component));
}
const missing = Object.keys(ui).filter(
  (name) => !(name in nonComponents) && !covered.get(name)?.size,
);
assert.deepEqual(
  missing,
  [],
  'Public exports without an indexed CSF render or an explicit exclusion',
);

const report = {
  storyCount: stories.length,
  components: Object.fromEntries(
    [...covered]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, ids]) => [name, [...ids].sort()]),
  ),
  aliases,
  nonComponents,
};
await mkdir(new URL('.', evidence), { recursive: true });
await writeFile(evidence, JSON.stringify(report, null, 2) + '\n');
console.log(`Covered ${covered.size} component exports in ${stories.length} indexed stories.`);
