/** Static TASK-002 source inventory. Local filesystem/Git only; never imports app code. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';

const root = path.resolve(import.meta.dirname, '..');
const out = 'output/k8k-tasks/TASK-002';
const frontRoots = [
  'apps/student-cabinet/src',
  'apps/manager-web/src',
  'apps/platform/src',
  'packages/account-ui/src',
];
const sdkPath = 'packages/api-contracts/src/generated/client.ts';
const visPath = 'docs/K8K_Academy_VIS12_dashboard_module_contracts_v1.0.md';
const skip = new Set(['node_modules', 'dist', 'generated', '.git', '__pycache__']);
const hash = (data) => crypto.createHash('sha256').update(data).digest('hex');
const unique = (items) => [...new Set(items)].sort();
const absolute = (p) => path.join(root, p);
const read = (p) => fs.readFileSync(absolute(p), 'utf8');
const git = (...args) =>
  execFileSync('git', ['--no-optional-locks', '-c', 'core.safecrlf=false', ...args], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
function files(dir) {
  return fs
    .readdirSync(absolute(dir), { withFileTypes: true })
    .flatMap((e) => {
      const p = `${dir}/${e.name}`;
      return e.isDirectory() ? (skip.has(e.name) ? [] : files(p)) : [p];
    })
    .sort();
}
const allFront = frontRoots
  .flatMap(files)
  .filter((p) => /\.tsx?$/.test(p) && !/\/test\/|\.test\./.test(p));
const apiFiles = files('apps/api/src').filter((p) => p.endsWith('.ts'));
const testFiles = [
  'tests',
  'apps/student-cabinet/tests',
  'apps/manager-web/src/test',
  'apps/manager-web/test',
  'packages/account-ui',
  'packages/ui/tests',
]
  .filter((p) => fs.existsSync(absolute(p)))
  .flatMap(files)
  .filter((p) => /(?:test|spec)\.(?:mjs|ts|tsx)$/.test(p));
const sources = new Map();
function source(p) {
  if (!sources.has(p))
    sources.set(
      p,
      ts.createSourceFile(
        p,
        read(p),
        ts.ScriptTarget.Latest,
        true,
        p.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
      ),
    );
  return sources.get(p);
}
function walk(n, fn) {
  fn(n);
  ts.forEachChild(n, (child) => walk(child, fn));
}
function ref(p, node, symbol) {
  return {
    path: p,
    line: source(p).getLineAndCharacterOfPosition(node.getStart(source(p))).line + 1,
    ...(symbol ? { symbol } : {}),
  };
}
function unwrap(n) {
  while (
    n &&
    (ts.isAsExpression(n) ||
      ts.isParenthesizedExpression(n) ||
      ts.isNonNullExpression(n) ||
      ts.isSatisfiesExpression(n))
  )
    n = n.expression;
  return n;
}
function literal(n) {
  n = unwrap(n);
  return n && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) ? n.text : undefined;
}
function property(n, name) {
  n = unwrap(n);
  return n && ts.isObjectLiteralExpression(n)
    ? n.properties.find((p) => p.name?.getText().replaceAll("'", '').replaceAll('"', '') === name)
        ?.initializer
    : undefined;
}
function decorators(n) {
  return ts.canHaveDecorators(n) ? (ts.getDecorators(n) ?? []) : [];
}
function decoratorCall(n) {
  return ts.isCallExpression(n.expression) ? n.expression : undefined;
}
function importTarget(p, specifier) {
  const aliases = { '@online-school/account-ui': 'packages/account-ui/src/index.tsx' };
  if (aliases[specifier]) return aliases[specifier];
  if (!specifier.startsWith('.')) return undefined;
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(p), specifier));
  return [
    base.replace(/\.js$/, '.ts'),
    base.replace(/\.js$/, '.tsx'),
    `${base}/index.ts`,
    `${base}/index.tsx`,
  ].find((candidate) => fs.existsSync(absolute(candidate)));
}
function imports(p) {
  const result = new Map();
  for (const n of source(p).statements) {
    if (!ts.isImportDeclaration(n) || n.importClause?.isTypeOnly) continue;
    const specifier = literal(n.moduleSpecifier),
      target = importTarget(p, specifier);
    if (n.importClause?.name)
      result.set(n.importClause.name.text, { target, exported: 'default', specifier });
    const named = n.importClause?.namedBindings;
    if (named && ts.isNamedImports(named))
      for (const e of named.elements) {
        if (!e.isTypeOnly)
          result.set(e.name.text, { target, exported: (e.propertyName ?? e.name).text, specifier });
      }
  }
  return result;
}
function isRuntimeIdentifier(n) {
  for (let p = n.parent; p; p = p.parent) {
    if (ts.isTypeNode(p) || ts.isImportDeclaration(p) || ts.isExportDeclaration(p)) return false;
    if (ts.isStatement(p) || ts.isJsxElement(p)) break;
  }
  return (
    !(ts.isPropertyAccessExpression(n.parent) && n.parent.name === n) &&
    !(ts.isPropertyAssignment(n.parent) && n.parent.name === n)
  );
}

// Actual generated operations and URL builders, including symbols passed by reference.
const sdk = new Map(),
  builders = new Map();
for (const statement of source(sdkPath).statements)
  if (ts.isVariableStatement(statement)) {
    for (const d of statement.declarationList.declarations) {
      if (!ts.isIdentifier(d.name) || !d.initializer) continue;
      const name = d.name.text;
      if (name.startsWith('get') && name.endsWith('Url')) builders.set(name, d);
      let method, builder;
      walk(d.initializer, (n) => {
        if (ts.isPropertyAssignment(n) && n.name.getText() === 'method')
          method = literal(n.initializer);
        if (
          ts.isCallExpression(n) &&
          ts.isIdentifier(n.expression) &&
          n.expression.text.endsWith('Url')
        )
          builder = n.expression.text;
      });
      if (method) sdk.set(name, { symbol: name, method, builder, source: ref(sdkPath, d, name) });
    }
  }
for (const op of sdk.values()) {
  const builder = builders.get(op.builder);
  if (!builder) throw new Error(`Missing real URL builder: ${op.symbol}`);
  let url;
  walk(builder.initializer, (n) => {
    // Orval query builders return a conditional template with/without ?query.
    if ((ts.isNoSubstitutionTemplateLiteral(n) || ts.isStringLiteral(n)) && n.text.startsWith('/'))
      url = n.text.split('?')[0];
    else if (ts.isTemplateExpression(n) && n.head.text.startsWith('/')) {
      url = (
        n.head.text +
        n.templateSpans.map((s) => `:${s.expression.getText()}${s.literal.text}`).join('')
      ).split('?')[0];
    }
  });
  op.url = url;
  op.urlBuilderSource = ref(sdkPath, builder, op.builder);
}

// Frontend symbol graph: route component -> referenced helpers/components -> SDK refs.
const declarations = new Map(),
  exportsByFile = new Map(),
  frontImports = new Map();
function register(p, name, node, exported = false, isDefault = false) {
  const record = {
    id: `${p}#${name}`,
    path: p,
    name,
    node,
    edges: new Set(),
    sdkRefs: [],
    facts: [],
    rawWrites: [],
  };
  declarations.set(record.id, record);
  if (!exportsByFile.has(p)) exportsByFile.set(p, new Map());
  if (exported) exportsByFile.get(p).set(name, record.id);
  if (isDefault) exportsByFile.get(p).set('default', record.id);
}
for (const p of allFront) {
  frontImports.set(p, imports(p));
  for (const n of source(p).statements) {
    const exported = n.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    const isDefault = n.modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword);
    if (ts.isFunctionDeclaration(n) && n.body)
      register(p, n.name?.text ?? 'default', n, exported, isDefault);
    if (ts.isVariableStatement(n))
      for (const d of n.declarationList.declarations) {
        if (ts.isIdentifier(d.name) && d.initializer) register(p, d.name.text, d, exported);
      }
    if (ts.isClassDeclaration(n) && n.name) register(p, n.name.text, n, exported, isDefault);
  }
}
function resolveFront(p, name) {
  const imported = frontImports.get(p)?.get(name);
  if (imported?.target) return exportsByFile.get(imported.target)?.get(imported.exported);
  return declarations.has(`${p}#${name}`) ? `${p}#${name}` : undefined;
}
// Lazy pages are reachable JSX symbols, even though their target is a dynamic import.
for (const record of declarations.values())
  if (ts.isVariableDeclaration(record.node)) {
    walk(record.node, (n) => {
      if (
        ts.isCallExpression(n) &&
        n.expression.kind === ts.SyntaxKind.ImportKeyword &&
        literal(n.arguments[0])
      ) {
        const target = importTarget(record.path, literal(n.arguments[0]));
        const id = exportsByFile.get(target)?.get('default');
        if (id) record.edges.add(id);
      }
    });
  }
const lifecycleWords = new Set([
  'dirty',
  'busy',
  'saving',
  'submitted',
  'editable',
  'queue',
  'timer',
  'mounted',
  'uploadIntent',
  'isPending',
  'isSuccess',
  'isError',
  'error',
  'isFetching',
  'blocker',
  'pending',
  'version',
  'revision',
  'approvalStatus',
  'canJoin',
  'canRequestReschedule',
  'hasActiveAccess',
  'mustChangePassword',
  'AbortController',
  'beforeunload',
  'pagehide',
]);
const sdkReferences = [];
for (const record of declarations.values()) {
  const p = record.path;
  const body = ts.isFunctionDeclaration(record.node) ? record.node.body : record.node;
  walk(body, (n) => {
    if (ts.isIdentifier(n) && isRuntimeIdentifier(n)) {
      const imported = frontImports.get(p)?.get(n.text);
      if (imported?.specifier === '@online-school/api-contracts' && sdk.has(imported.exported)) {
        const branches = [];
        for (let parent = n.parent; parent && parent !== record.node; parent = parent.parent) {
          if (ts.isIfStatement(parent) || ts.isConditionalExpression(parent))
            branches.push(ref(p, parent, 'runtime conditional branch'));
        }
        const call = {
          sdkSymbol: imported.exported,
          owner: record.id,
          source: ref(p, n, n.text),
          usage:
            ts.isCallExpression(n.parent) && n.parent.expression === n
              ? 'call'
              : 'callback/reference',
          branchEvidence: branches,
          screenIds: [],
        };
        record.sdkRefs.push(call);
        sdkReferences.push(call);
      }
      const target = resolveFront(p, n.text);
      if (target && target !== record.id) record.edges.add(target);
      if (lifecycleWords.has(n.text))
        record.facts.push({ kind: 'lifecycle/eligibility', name: n.text, source: ref(p, n) });
    }
    if (ts.isCallExpression(n)) {
      const called = n.expression.getText();
      if (
        /^(useQuery|useStudentQuery|useMutation|useCommand|useBlocker|useBeforeUnload|useIntentKey|read|write|mutation)$/.test(
          called,
        )
      ) {
        const key =
          property(n.arguments[0], 'queryKey') ??
          (called === 'useStudentQuery' ? n.arguments[0] : undefined);
        record.facts.push({
          kind: /Query$/.test(called)
            ? 'read-query'
            : /Blocker|BeforeUnload/.test(called)
              ? 'dirty-navigation-guard'
              : 'command/wrapper',
          name: called,
          ...(key ? { queryKeyExpression: key.getText().slice(0, 240) } : {}),
          source: ref(p, n),
        });
      }
      if (called === 'fetch')
        record.rawWrites.push({
          transport: 'presigned-object-store',
          method: literal(property(n.arguments[1], 'method')) ?? 'GET',
          urlExpression: n.arguments[0].getText(),
          source: ref(p, n),
          screenIds: [],
        });
    }
    if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) {
      const tag = n.tagName.getText();
      if (['form', 'dialog', 'details', 'Modal', 'Dialog', 'FormShell', 'Conflict'].includes(tag)) {
        const handlers = n.attributes.properties
          .filter(ts.isJsxAttribute)
          .filter((a) => /^(onSubmit|submit|close|onCancel|onToggle)$/.test(a.name.getText()))
          .map((a) => ({ event: a.name.getText(), source: ref(p, a) }));
        record.facts.push({
          kind: ['dialog', 'Modal', 'Dialog', 'Conflict'].includes(tag)
            ? 'dialog'
            : tag === 'details'
              ? 'menu'
              : 'form',
          name: tag,
          handlers,
          source: ref(p, n, record.name),
        });
      }
      if (
        [
          'State',
          'QueryState',
          'StateBoundary',
          'StateBoundaryAdapter',
          'ErrorNotice',
          'ErrorBox',
          'ErrorBoundary',
          'Empty',
        ].includes(tag)
      ) {
        record.facts.push({ kind: 'state-boundary', name: tag, source: ref(p, n) });
      }
      if (['input', 'textarea', 'select', 'Input', 'TextArea', 'Select', 'Check'].includes(tag)) {
        const attrs = Object.fromEntries(
          n.attributes.properties
            .filter(ts.isJsxAttribute)
            .filter((a) =>
              ['name', 'type', 'required', 'minLength', 'maxLength'].includes(a.name.getText()),
            )
            .map((a) => [
              a.name.getText(),
              a.initializer ? (literal(a.initializer) ?? 'expression') : true,
            ]),
        );
        record.facts.push({ kind: 'field', name: tag, attributes: attrs, source: ref(p, n) });
      }
      for (const a of n.attributes.properties.filter(ts.isJsxAttribute))
        if (/^on[A-Z]/.test(a.name.getText())) {
          record.facts.push({
            kind: 'jsx-handler',
            name: a.name.getText(),
            source: ref(p, a, record.name),
          });
        }
      for (const a of n.attributes.properties.filter(ts.isJsxAttribute))
        if (['href', 'to', 'src'].includes(a.name.getText())) {
          record.facts.push({
            kind: 'navigation/asset',
            name: `${tag}.${a.name.getText()}`,
            expression: a.initializer?.getText().slice(0, 300),
            source: ref(p, a),
          });
        }
    }
  });
}

// Index controller methods, injected services, helper functions and exact ACL decorators.
const classes = new Map(),
  functions = new Map(),
  controllers = new Map();
function decoRefs(p, node) {
  return decorators(node)
    .map((d) => ({ d, call: decoratorCall(d) }))
    .filter(
      ({ call }) =>
        call &&
        !/^(Api|Controller$|Get$|Post$|Put$|Patch$|Delete$|Head$|Options$)/.test(
          call.expression.getText(),
        ),
    )
    .map(({ d, call }) => ({
      name: call.expression.getText(),
      arguments: call.arguments.map((a) => a.getText().slice(0, 650)),
      source: ref(p, d),
    }));
}
for (const p of apiFiles)
  for (const n of source(p).statements) {
    if (ts.isFunctionDeclaration(n) && n.name) functions.set(`${p}#${n.name.text}`, { p, node: n });
    if (ts.isVariableStatement(n))
      for (const d of n.declarationList.declarations) {
        if (
          ts.isIdentifier(d.name) &&
          d.initializer &&
          (ts.isArrowFunction(unwrap(d.initializer)) ||
            ts.isFunctionExpression(unwrap(d.initializer)))
        ) {
          functions.set(`${p}#${d.name.text}`, { p, node: d });
        }
      }
    if (!ts.isClassDeclaration(n) || !n.name) continue;
    const inject = new Map(),
      methods = new Map();
    for (const m of n.members) {
      if (ts.isConstructorDeclaration(m))
        for (const param of m.parameters) {
          if (param.type && ts.isTypeReferenceNode(param.type))
            inject.set(param.name.getText(), param.type.typeName.getText());
        }
      if (ts.isMethodDeclaration(m) && m.body) methods.set(m.name.getText().replaceAll("'", ''), m);
    }
    classes.set(n.name.text, { p, node: n, name: n.name.text, inject, methods });
  }
function methodTrace(clsName, methodName, seen = new Set()) {
  const cls = classes.get(clsName),
    node = cls?.methods.get(methodName),
    id = `${clsName}.${methodName}`;
  if (!node || seen.has(id)) return [];
  seen.add(id);
  const importsHere = imports(cls.p),
    delegates = [],
    helperRefs = [],
    dataCalls = [],
    aclEvidence = [];
  walk(node.body, (n) => {
    if (ts.isCallExpression(n)) {
      const expression = n.expression.getText();
      const match = /^this\.([\w$]+)\.([\w$]+)$/.exec(expression);
      const own = /^this\.([\w$]+)$/.exec(expression);
      if (match && cls.inject.has(match[1]))
        delegates.push(...methodTrace(cls.inject.get(match[1]), match[2], seen));
      if (own && cls.methods.has(own[1])) delegates.push(...methodTrace(clsName, own[1], seen));
      if (
        /\.(findMany|findUnique|findFirst|findFirstOrThrow|findUniqueOrThrow|create|update|updateMany|count|aggregate|\$queryRaw|\$executeRaw|\$transaction)$/.test(
          expression,
        )
      )
        dataCalls.push({ expression, source: ref(cls.p, n) });
      if (
        /assert|authoriz|scope|access|canAccess|eligible|validate|ensure|resourceAuthorizer/i.test(
          expression,
        )
      )
        aclEvidence.push({ expression, source: ref(cls.p, n) });
      if (ts.isIdentifier(n.expression)) {
        const imp = importsHere.get(n.expression.text),
          fn = imp?.target
            ? functions.get(`${imp.target}#${imp.exported}`)
            : functions.get(`${cls.p}#${n.expression.text}`);
        if (fn) helperRefs.push(ref(fn.p, fn.node, n.expression.text));
      }
    }
    if (ts.isTaggedTemplateExpression(n) && /\$queryRaw|\$executeRaw/.test(n.tag.getText()))
      dataCalls.push({ expression: n.tag.getText(), source: ref(cls.p, n) });
  });
  return [
    {
      className: clsName,
      method: methodName,
      source: ref(cls.p, node, id),
      delegates: [],
      helperRefs,
      dataCalls,
      aclEvidence,
    },
    ...delegates,
  ];
}
function decoratorExpansion(p, name, seen = new Set()) {
  const imp = imports(p).get(name);
  const fn = imp?.target
    ? functions.get(`${imp.target}#${imp.exported}`)
    : functions.get(`${p}#${name}`);
  if (!fn || seen.has(`${fn.p}#${name}`)) return [];
  seen.add(`${fn.p}#${name}`);
  const calls = [],
    nested = [];
  walk(fn.node, (n) => {
    if (!ts.isCallExpression(n) || !ts.isIdentifier(n.expression)) return;
    const called = n.expression.text;
    if (
      /^(UseGuards|CriticalCommand|RequireRole|RequireMfa|RequireStudent|Authenticated|SetMetadata|UseInterceptors)/.test(
        called,
      )
    ) {
      calls.push({
        name: called,
        arguments: n.arguments.map((a) => a.getText().slice(0, 650)),
        source: ref(fn.p, n),
      });
    }
    if (!['applyDecorators', name].includes(called))
      nested.push(...decoratorExpansion(fn.p, called, seen));
  });
  return [{ source: ref(fn.p, fn.node, name), calls }, ...nested];
}
for (const cls of classes.values()) {
  const prefixDec = decorators(cls.node)
    .map(decoratorCall)
    .find((d) => d?.expression.getText() === 'Controller');
  if (!prefixDec) continue;
  const prefix = literal(prefixDec.arguments[0]) ?? '';
  for (const [name, method] of cls.methods) {
    const decs = decorators(method).map(decoratorCall).filter(Boolean);
    const api = decs.find((d) => d.expression.getText() === 'ApiOperation');
    const operationId = literal(property(api?.arguments[0], 'operationId'));
    if (!operationId) continue;
    const route = decs.find((d) =>
      ['Get', 'Post', 'Put', 'Patch', 'Delete', 'Head', 'Options'].includes(d.expression.getText()),
    );
    if (!route) throw new Error(`No HTTP decorator: ${operationId}`);
    const url = `/${[prefix, literal(route.arguments[0]) ?? ''].filter(Boolean).join('/')}`;
    if (controllers.has(operationId)) throw new Error(`Duplicate operationId: ${operationId}`);
    const security = [...decoRefs(cls.p, cls.node), ...decoRefs(cls.p, method)];
    const expansions = security.flatMap((d) => decoratorExpansion(cls.p, d.name));
    const guardRefs = [];
    for (const decorator of [...security, ...expansions.flatMap((e) => e.calls)])
      for (const arg of decorator.arguments)
        for (const token of arg.matchAll(/\b[A-Za-z_$][\w$]*\b/g)) {
          const guard = classes.get(token[0]);
          if (guard) guardRefs.push(ref(guard.p, guard.node, token[0]));
        }
    if (security.some((d) => d.name === 'ManagerRoute')) {
      guardRefs.push(
        {
          path: 'apps/api/src/modules/manager/guards/manager-route.decorator.ts',
          line: 15,
          symbol: 'ManagerRoute',
        },
        ref(
          classes.get('ManagerContextGuard').p,
          classes.get('ManagerContextGuard').node,
          'ManagerContextGuard',
        ),
      );
    }
    controllers.set(operationId, {
      operationId,
      summary: literal(property(api.arguments[0], 'summary')) ?? null,
      description: literal(property(api.arguments[0], 'description')) ?? null,
      method: route.expression.getText().toUpperCase(),
      url,
      source: ref(cls.p, method, `${cls.name}.${name}`),
      classSource: ref(cls.p, cls.node, cls.name),
      security,
      decoratorExpansion: expansions,
      guardRefs,
      guardTrace: unique(guardRefs.map((g) => g.symbol)).flatMap((g) =>
        methodTrace(g, 'canActivate'),
      ),
      serviceTrace: methodTrace(cls.name, name),
      globalSecurity: [
        'apps/api/src/core/core.module.ts',
        'apps/api/src/core/rbac/rbac.guard.ts',
        'apps/api/src/core/csrf/csrf.module.ts',
        'apps/api/src/core/idempotency/idempotency.module.ts',
        ...(url.startsWith('/api/v1/student/')
          ? [
              'apps/api/src/student/student.module.ts',
              'apps/api/src/student/student-context.guard.ts',
              'apps/api/src/student/active-subscription.guard.ts',
            ]
          : []),
      ],
    });
  }
}

// A declared controller is existing HTTP surface only if reachable from AppModule.
const moduleGraph = new Map(),
  registeredControllers = new Set(),
  visitedModules = new Set();
for (const cls of classes.values()) {
  const moduleDec = decorators(cls.node)
    .map(decoratorCall)
    .find((d) => d?.expression.getText() === 'Module');
  if (!moduleDec) continue;
  const names = (value) => {
    const result = [];
    if (value)
      walk(value, (n) => {
        if (ts.isIdentifier(n) && classes.has(n.text)) result.push(n.text);
      });
    return unique(result);
  };
  moduleGraph.set(cls.name, {
    source: ref(cls.p, cls.node, cls.name),
    imports: names(property(moduleDec.arguments[0], 'imports')),
    controllers: names(property(moduleDec.arguments[0], 'controllers')),
  });
}
function visitModule(name) {
  if (visitedModules.has(name)) return;
  visitedModules.add(name);
  const module = moduleGraph.get(name);
  if (!module) return;
  for (const controller of module.controllers) registeredControllers.add(controller);
  for (const imported of module.imports) visitModule(imported);
}
visitModule('AppModule');
for (const controller of controllers.values())
  controller.registeredFromAppModule = registeredControllers.has(controller.classSource.symbol);

const task = (n) => `TASK-${String(n).padStart(3, '0')}`;
function tasksFor(p, symbol = '') {
  if (p.includes('account-ui')) return [19, 67];
  if (p.includes('platform'))
    return /Session|Passkey|Recovery|Csrf|Accounts/.test(symbol)
      ? [66, 67]
      : /Component/.test(symbol)
        ? [64, 65]
        : [18, 20, 36, 59, 63];
  if (p.includes('student-cabinet')) {
    if (/Homework/.test(p)) return [30];
    if (/Reports/.test(p)) return [32];
    if (/Notification/.test(p) || /Notification/.test(symbol)) return [33];
    if (/Account/.test(p)) return /Profile|Session|Email/.test(symbol) ? [34] : [34, 66];
    if (/Skills|Skill/.test(symbol)) return [31];
    if (/Subscription/.test(symbol)) return [24, 26];
    if (/Material/.test(symbol)) return [34];
    if (/Lesson/.test(symbol)) return [28, 29];
    return [25, 34];
  }
  if (/Login/.test(p)) return [58, 66];
  if (/Subscriptions/.test(p)) return [55];
  if (/Payments/.test(p)) return [56];
  if (/Notifications/.test(p)) return [58];
  if (/Schedule|Task\.tsx/.test(p)) return [48, 49, 50, 57];
  if (/Leads|Lead\.tsx|lead-form/.test(p)) return [48, 53, 54];
  if (/Dashboard|Tasks/.test(p)) return [49, 50];
  if (/Account/.test(p)) return [48, 58];
  return [48, 52, 55, 58];
}
function screenNotes(p, component, role) {
  const common = {
    status: 'partial',
    states: 'Observed source facts only; VIS11 nine-state acceptance not run',
    testsStatus: 'related test sources, NOT_RUN in TASK-002',
    futureTasks: tasksFor(p).map(task),
  };
  if (role === 'TEACHER' || role === 'DIRECTOR')
    return {
      ...common,
      purpose: 'Existing read-only staff workspace; role-filtered, capped collections',
      rights:
        'Actual controller decorators + core RBAC/MFA; teacher scheduled/issued/assigned own rows, director role projection',
      lifecycle:
        'AbortController on reads/unmount; manual/context refresh; stale boundary; logout via mutation. No educational/financial command UI.',
      missingFields: [
        'staff action capabilities and authoritative timezone',
        'server pagination/totals: lessons<=100, assignments<=100, homework/tasks<=50',
        'required detail/command workflows; full RU/RO',
      ],
      countScope: 'loaded capped collections only; never a school KPI',
    };
  if (role === 'TECH_OPERATOR')
    return {
      ...common,
      purpose: 'Read-only component liveness',
      rights:
        'getComponentStatus: staff role + MFA metadata, global scoped exceptions remain authoritative',
      lifecycle: 'Abortable read, refresh, stale/error boundary; no repair/restart controls',
      missingFields: [
        'checkedAt/workerLastSeenAt context rendering',
        'full RU/RO and 401/private DOM handling review',
      ],
      futureTasks: [64, 65].map(task),
    };
  if (role === 'MANAGER')
    return {
      ...common,
      purpose: component,
      rights:
        'ManagerRoute/ManagerContextGuard plus exact resource guards and service scope in each operation; role string alone is insufficient',
      lifecycle:
        'useCommand: pending ref, per-intent idempotency, pagehide/unmount abort; write CSRF, conflict reload; normal form dirty-loss protection not universal. Session clear aborts/cancels query cache.',
      missingFields: [
        'complete action eligibility/capabilities',
        'complete RU/RO',
        ...(/Dashboard/.test(component)
          ? ['real actionable task queue; source-consistent aggregates']
          : []),
        ...(/Leads/.test(component) ? ['board all-page server pagination/filters'] : []),
      ],
    };
  if (role === 'STUDENT')
    return {
      ...common,
      purpose: component,
      rights:
        'StudentContext/ActiveSubscription adapters and exact object scope guards/service SQL; bootstrap/security exceptions are route-specific',
      lifecycle:
        component === 'HomeworkDetail'
          ? 'Serialized draft promise queue, 2s debounce, dirty useBlocker/useBeforeUnload; version history; presign -> cookie-free S3 PUT -> confirm; explicit submit intent after save queue; unknown/pending remain separate.'
          : 'Student query helper no retries; write CSRF+intent key; pending controls and query invalidation; 401/402/password redirect clears queries. No universal dirty-form guard.',
      missingFields: [
        'complete RU/RO and nine-state acceptance',
        ...(/Subscription|StudentHome|Dashboard/.test(component)
          ? ['complete per-subject access/subscription projection']
          : []),
        ...(component === 'Reports'
          ? ['PDF workflow and report outside currently loaded page deep link']
          : []),
        ...(component === 'Homework'
          ? ['replace current status tabs with one chronological list without changing autosave']
          : []),
      ],
    };
  return {
    ...common,
    purpose: component,
    rights:
      'Exact identity decorators and core RBAC/MFA/CSRF, fixed demo-switch eligibility on server',
    lifecycle:
      component === 'AccountMenu'
        ? 'busy guard; abortable catalog read; full-navigation switch/logout, BroadcastChannel, menu Escape/outside click; private-DOM/late-response gap requires TASK-019'
        : 'Password form busy/error/reset; shared Login displays missing MFA message but has no full shared passkey/recovery flow',
    missingFields: [
      'complete RU/RO',
      ...(component === 'Login'
        ? ['shared MFA/passkey/recovery workflow']
        : ['explicit session-transition private DOM/read cancellation audit']),
    ],
    futureTasks: [19, 66, 67].map(task),
  };
}
const screens = [];
function addScreen({
  id,
  role,
  route,
  p,
  component,
  routeSource,
  kind = 'route',
  extraSeeds = [],
  ...extra
}) {
  const seeds = [resolveFront(p, component), ...extraSeeds].filter(Boolean);
  screens.push({
    id,
    role,
    route,
    kind,
    component,
    routeSource,
    entrySources: seeds.map((id) =>
      ref(declarations.get(id).path, declarations.get(id).node, declarations.get(id).name),
    ),
    ...screenNotes(p, component, role),
    ...extra,
    seeds,
    reachable: [],
    operationSymbols: [],
    forms: [],
    dialogs: [],
    readQueries: [],
    handlers: [],
    lifecycleEvidence: [],
    fields: [],
    commandWrappers: [],
    relatedTests: [],
  });
}
const studentRouter = 'apps/student-cabinet/src/router.tsx';
walk(source(studentRouter), (n) => {
  if (!ts.isObjectLiteralExpression(n)) return;
  const route = literal(property(n, 'path')),
    element = property(n, 'element');
  if (!route || !element) return;
  const components = [];
  walk(element, (e) => {
    if (ts.isJsxOpeningElement(e) || ts.isJsxSelfClosingElement(e))
      components.push(e.tagName.getText());
  });
  const component = components.find((c) => c !== 'Navigate');
  const imp = frontImports.get(studentRouter).get(component);
  addScreen({
    id: `student:${route}`,
    role: 'STUDENT',
    route,
    p: imp.target,
    component: imp.exported,
    routeSource: ref(studentRouter, n),
    extraSeeds:
      route.includes('/login') || route.includes('/suspended') || route.includes('/change-password')
        ? []
        : ['apps/student-cabinet/src/Layout.tsx#StudentLayout'],
    ...(route.endsWith('/notifications')
      ? {
          runtimeBranch:
            'K8K: Navigate replace to /student?events=1; legacy: Notifications component. Both preserved.',
          futureTasks: [task(33)],
        }
      : {}),
  });
});
const managerMain = 'apps/manager-web/src/main.tsx';
const routeBuilders = [];
walk(source('apps/manager-web/src/routes.ts'), (n) => {
  if (!ts.isPropertyAssignment(n)) return;
  const value = unwrap(n.initializer),
    body = ts.isArrowFunction(value) ? unwrap(value.body) : value;
  let route = literal(body);
  if (ts.isTemplateExpression(body))
    route =
      body.head.text +
      body.templateSpans
        .map((s) => {
          const param = ts.isCallExpression(s.expression)
            ? s.expression.arguments[0].getText()
            : s.expression.getText();
          return `:${param}${s.literal.text}`;
        })
        .join('');
  if (route?.startsWith('/manager'))
    routeBuilders.push({
      name: n.name.getText(),
      route,
      source: ref('apps/manager-web/src/routes.ts', n),
    });
});
walk(source(managerMain), (n) => {
  if (
    !(ts.isJsxSelfClosingElement(n) || ts.isJsxOpeningElement(n)) ||
    n.tagName.getText() !== 'Route'
  )
    return;
  const attrs = n.attributes.properties.filter(ts.isJsxAttribute);
  const routeAttr = attrs.find((a) => a.name.getText() === 'path'),
    element = attrs.find((a) => a.name.getText() === 'element');
  const route = literal(routeAttr?.initializer);
  if (!route) return;
  let component = 'NotFound';
  if (element)
    walk(element, (e) => {
      if (ts.isJsxSelfClosingElement(e)) component = e.tagName.getText();
    });
  addScreen({
    id: `manager:${route}`,
    role: 'MANAGER',
    route,
    p: managerMain,
    component,
    routeSource: ref(managerMain, n),
    extraSeeds: [
      'apps/manager-web/src/session.tsx#SessionBoundary',
      ...(route === '/manager/login' || route === '*'
        ? []
        : [
            'apps/manager-web/src/session.tsx#RequireManager',
            'apps/manager-web/src/components/layout.tsx#Layout',
          ]),
    ],
  });
});
const studentCard = screens.find((s) => s.route === '/manager/students/:id');
const tabRecord = declarations.get('apps/manager-web/src/pages/Student.tsx#tabs');
const studentTabs = [];
walk(tabRecord.node, (n) => {
  if (ts.isPropertyAssignment(n) && n.name.getText() === 'id')
    studentTabs.push({ value: literal(n.initializer), source: ref(tabRecord.path, n) });
});
for (const tab of studentTabs)
  screens.push({
    ...structuredClone({ ...studentCard, seeds: undefined }),
    id: `${studentCard.id}?tab=${tab.value}`,
    route: `${studentCard.route}?tab=${tab.value}`,
    kind: 'query-tab',
    routeSource: tab.source,
    seeds: [...studentCard.seeds],
    queryBranch: tab.value,
    operationSymbols: [],
    reachable: [],
    forms: [],
    dialogs: [],
    readQueries: [],
    handlers: [],
    lifecycleEvidence: [],
    fields: [],
    commandWrappers: [],
  });
studentCard.queryBranch = 'overview (default)';
const platform = 'apps/platform/src/App.tsx';
let staffAllowedTabs;
walk(declarations.get(`${platform}#Staff`).node, (n) => {
  if (ts.isVariableDeclaration(n) && n.name.getText() === 'allowedTabs') staffAllowedTabs = n;
});
function evaluateSections(node, role) {
  node = unwrap(node);
  if (ts.isArrayLiteralExpression(node))
    return node.elements.flatMap((e) => evaluateSections(e, role));
  if (ts.isConditionalExpression(node)) {
    const enabled =
      node.condition.getText() === 'operator' ? role === 'TECH_OPERATOR' : role === 'DIRECTOR';
    return evaluateSections(enabled ? node.whenTrue : node.whenFalse, role);
  }
  const value = literal(node);
  if (value === undefined)
    throw new Error('Unsupported dynamic staff section; review source before inventory');
  return [value];
}
const accountHomes = declarations.get('packages/account-ui/src/index.tsx#homes');
const homes = [];
walk(accountHomes.node, (n) => {
  if (ts.isPropertyAssignment(n))
    homes.push({
      role: n.name.getText(),
      route: literal(n.initializer),
      source: ref(accountHomes.path, n),
    });
});
for (const home of homes.filter((h) => ['TEACHER', 'DIRECTOR', 'TECH_OPERATOR'].includes(h.role))) {
  addScreen({
    id: `${home.role}:${home.route}`,
    role: home.role,
    route: home.route,
    p: platform,
    component: 'Staff',
    routeSource: home.source,
    extraSeeds: [`${platform}#App`],
    matchPolicy:
      'App pathname startsWith(roleHome(role)); no strict nested router; section allowlist normalizes invalid/missing section to overview',
    queryBranch: 'overview',
  });
  const sectionValues = evaluateSections(staffAllowedTabs.initializer, home.role);
  for (const section of sectionValues)
    addScreen({
      id: `${home.role}:${home.route}?section=${section}`,
      role: home.role,
      route: `${home.route}?section=${section}`,
      p: platform,
      component: 'Staff',
      kind: 'query-section',
      routeSource: ref(platform, staffAllowedTabs, 'Staff.allowedTabs/readTab/setTab'),
      extraSeeds: [`${platform}#App`],
      queryBranch: section,
      runtimeBranch: 'same workspace read; section affects presentation, not authorization',
    });
}
addScreen({
  id: 'shared:/account',
  role: 'SHARED',
  route: '/account',
  p: platform,
  component: 'Login',
  routeSource: ref(platform, declarations.get(`${platform}#App`).node, 'App'),
  runtimeBranch: 'App skips currentSession at /account; Login always rendered',
});
addScreen({
  id: 'shared:/',
  role: 'SHARED',
  route: '/',
  p: platform,
  component: 'App',
  routeSource: ref(platform, declarations.get(`${platform}#App`).node),
  runtimeBranch: 'currentSession -> roleHome redirect or Login; not a new public website',
});
addScreen({
  id: 'shared:account-menu',
  role: 'SHARED',
  route: '(private cabinet account menu)',
  p: 'packages/account-ui/src/index.tsx',
  component: 'AccountMenu',
  kind: 'shared-surface',
  routeSource: ref(
    'packages/account-ui/src/index.tsx',
    declarations.get('packages/account-ui/src/index.tsx#AccountMenu').node,
  ),
  roles: homes.map((h) => h.role),
});
addScreen({
  id: 'student:route-error',
  role: 'STUDENT',
  route: '(student route errorElement)',
  p: studentRouter,
  component: 'RouteError',
  kind: 'error-boundary',
  routeSource: ref(studentRouter, declarations.get(`${studentRouter}#RouteError`).node),
  missingFields: ['RU/RO route error copy'],
  futureTasks: [task(34)],
});

const tabFiles = {
  payments: 'apps/manager-web/src/pages/student/Payments.tsx',
  subscriptions: 'apps/manager-web/src/pages/student/Subscriptions.tsx',
  notifications: 'apps/manager-web/src/pages/student/Notifications.tsx',
  schedule: 'apps/manager-web/src/pages/Schedule.tsx',
  tasks: 'apps/manager-web/src/pages/Tasks.tsx',
};
for (const screen of screens) {
  screen.navigationEntries = [];
  const seen = new Set(),
    pending = [...screen.seeds];
  while (pending.length) {
    const id = pending.pop();
    if (seen.has(id)) continue;
    const record = declarations.get(id);
    if (!record) throw new Error(`Unresolved frontend graph node: ${id}`);
    if (screen.role !== 'SHARED' && record.path === platform && record.name === 'Login') continue;
    if (
      screen.role === 'SHARED' &&
      screen.route === '/' &&
      record.path === platform &&
      record.name === 'Staff'
    )
      continue;
    if (
      screen.queryBranch &&
      screen.role === 'MANAGER' &&
      Object.values(tabFiles).includes(record.path) &&
      record.path !== tabFiles[screen.queryBranch]
    )
      continue;
    seen.add(id);
    pending.push(...record.edges);
  }
  screen.reachable = [...seen].sort();
  for (const id of screen.reachable) {
    const record = declarations.get(id);
    for (const call of record.sdkRefs) {
      if (screen.role === 'TECH_OPERATOR' && call.sdkSymbol === 'getPlatformWorkspace') continue;
      if (['TEACHER', 'DIRECTOR'].includes(screen.role) && call.sdkSymbol === 'getComponentStatus')
        continue;
      call.screenIds.push(screen.id);
      screen.operationSymbols.push(call.sdkSymbol);
    }
    for (const call of record.rawWrites) call.screenIds.push(screen.id);
    for (const fact of record.facts) {
      const field = {
        form: 'forms',
        dialog: 'dialogs',
        field: 'fields',
        'read-query': 'readQueries',
        'jsx-handler': 'handlers',
        'lifecycle/eligibility': 'lifecycleEvidence',
        'dirty-navigation-guard': 'lifecycleEvidence',
        'command/wrapper': 'commandWrappers',
        'navigation/asset': 'navigationEntries',
      }[fact.kind];
      if (field) screen[field].push(fact);
    }
  }
  screen.operationSymbols = unique(screen.operationSymbols);
  delete screen.seeds;
}

const tests = testFiles.map((p) => ({ path: p, text: read(p) }));
const operations = [...sdk.values()].map((op) => {
  const controller = controllers.get(op.symbol),
    calls = sdkReferences.filter((c) => c.sdkSymbol === op.symbol);
  const symbols = unique([op.symbol, ...(controller?.serviceTrace.map((t) => t.className) ?? [])]);
  return {
    ...op,
    purpose: controller?.summary ?? op.symbol.replace(/([a-z])([A-Z])/g, '$1 $2'),
    allowedAction:
      op.symbol === 'confirmManagerPayment'
        ? 'Send receipt for director approval; records approval_requested_at, does not confirm received money'
        : ['GET', 'HEAD', 'OPTIONS'].includes(op.method)
          ? 'Read current authorized projection/resource only'
          : 'Execute this server command under its resource/context guards',
    controller: controller ?? null,
    frontendReferences: calls,
    screenIds: unique(calls.flatMap((c) => c.screenIds)),
    status: controller?.registeredFromAppModule ? 'implemented' : 'partial',
    statusScope: 'backend contract/source presence, not module or UI completion',
    uiIntegration: calls.length ? 'referenced-by-scoped-UI' : 'not-referenced-by-scoped-UI',
    statusMeaning: 'Source presence/trace only; no runtime/domain acceptance claim',
    relatedTests: tests
      .filter((t) => symbols.some((s) => new RegExp(`\\b${s}\\b`).test(t.text)))
      .map((t) => ({
        path: t.path,
        status: 'NOT_RUN',
        association: 'source identifier, not coverage proof',
      })),
    futureTasks: unique(calls.flatMap((c) => tasksFor(c.source.path, op.symbol).map(task))),
  };
});
for (const screen of screens)
  screen.relatedTests = unique(
    operations
      .filter((o) => screen.operationSymbols.includes(o.symbol))
      .flatMap((o) => o.relatedTests.map((t) => t.path)),
  );

// Canonical IDs, never the unrelated historical MGR task numbers.
const moduleSpecs = [
  [
    'STU-01',
    'STUDENT',
    ['getStudentDashboard', 'getStudentLesson'],
    'partial',
    [28],
    ['actual server-clock join boundaries/stale handling; not calendar=conducted'],
  ],
  [
    'STU-02',
    'STUDENT',
    ['getStudentHomework', 'saveStudentHomeworkDraft', 'submitStudentHomework'],
    'partial',
    [30],
    [
      'single chronological list replaces current status tabs; preserve autosave/upload/version/idempotency',
    ],
  ],
  [
    'STU-03',
    'STUDENT',
    [
      'getStudentLessons',
      'requestStudentLessonReschedule',
      'getStudentLessonHistory',
      'disputeStudentLessonDeduction',
    ],
    'partial',
    [29],
    [
      'history/deduction dispute APIs exist but have no scoped UI references; complete K8K calendar/detail/history/dispute composition and two locales',
    ],
  ],
  [
    'STU-04',
    'STUDENT',
    [
      'getStudentSkillMaps',
      'getStudentSkillSnapshots',
      'getStudentReports',
      'requestStudentEducationPdf',
      'getStudentEducationPdfStatus',
    ],
    'partial',
    [31, 32],
    [
      'PDF request/status APIs exist but have no scoped UI references; published-only report deep link outside loaded page; explicit 4-vs-8 meaning',
    ],
  ],
  [
    'STU-05',
    'STUDENT',
    ['getStudentSubscription', 'getStudentSubscriptionLedger', 'getStudentSubscriptionPayments'],
    'partial',
    [24, 26],
    [
      'per-subject list/access projection; selected/aggregate subscription response does not supply full subject hub',
    ],
  ],
  [
    'STU-06',
    'STUDENT',
    ['getStudentNotifications', 'markStudentNotificationRead', 'markAllStudentNotificationsRead'],
    'partial',
    [33],
    ['all source-target cases/unknown result/locales; legacy route is a K8K bell redirect'],
  ],
  [
    'STU-07',
    'STUDENT',
    ['getStudentMe'],
    'partial',
    [27],
    [
      'CRM projection currently exposes only validated whatsapp/telegram links; assigned manager name and official phone absent',
    ],
  ],
  [
    'TCHD-01',
    'TEACHER',
    ['getPlatformWorkspace', 'startLesson'],
    'partial',
    [36, 37],
    [
      'read-only list has meetUrl but no authoritative join/action capabilities or detailed current-lesson UI',
    ],
  ],
  [
    'TCHD-02',
    'TEACHER',
    ['getPlatformWorkspace'],
    'partial',
    [36, 37],
    ['own uncapped/paginated today/week plan and lesson detail missing'],
  ],
  [
    'TCHD-03',
    'TEACHER',
    ['startLesson', 'reportLessonOutcome', 'confirmLessonOutcome'],
    'partial',
    [38],
    [
      'generic schedule commands exist; teacher frontend has no start/result workflow; 24h/version requirements need explicit checks',
    ],
  ],
  [
    'TCHD-04',
    'TEACHER',
    ['getPlatformWorkspace'],
    'partial',
    [39, 40, 41],
    [
      'EducationModule is empty; teacher assignment/issue/submitted-review APIs and command UI missing',
    ],
  ],
  [
    'TCHD-05',
    'TEACHER',
    [],
    'missing',
    [42, 43, 44],
    [
      'teacher read queue/skill assessments/4-review/8-report draft+publish APIs/UI missing; student read API is not teacher publishing',
    ],
  ],
  [
    'TCHD-06',
    'TEACHER',
    ['getTeacherPayroll'],
    'partial',
    [45],
    [
      'generic payroll read exists but no own current-rate read projection and no teacher frontend payroll/rate workflow',
    ],
  ],
  [
    'TCHD-07',
    'TEACHER',
    [],
    'missing',
    [46],
    ['teacher own notification/structured manager appeal read/write APIs/UI missing'],
  ],
  [
    'MGR-01',
    'MANAGER',
    [
      'listManagerLeads',
      'getManagerLeadSummary',
      'claimManagerLead',
      'scheduleManagerTrial',
      'transitionManagerLead',
    ],
    'partial',
    [48, 53, 54],
    ['complete board pagination/filter agreement; keyboard/dnd workflow; real action capabilities'],
  ],
  [
    'MGR-02',
    'MANAGER',
    ['getManagerDashboard', 'listManagerTasks', 'claimManagerTask'],
    'partial',
    [49],
    [
      'dashboard actionable queue rather than partial widgets; claim is not resolution/contact/payment',
    ],
  ],
  [
    'MGR-03',
    'MANAGER',
    ['getManagerDashboard', 'getManagerTask'],
    'partial',
    [22, 50],
    [
      'typed critical event/source/claim/escalation projection and director route; no browser-dependent escalation',
    ],
  ],
  [
    'MGR-04',
    'MANAGER',
    ['getManagerStudentCard', 'updateManagerStudentContacts'],
    'partial',
    [51, 52],
    ['contact edit is not append-only structured contact journal; journal API/UI absent'],
  ],
  [
    'MGR-05',
    'MANAGER',
    [
      'listManagerSchedule',
      'createManagerLesson',
      'rescheduleManagerLesson',
      'resolveManagerTaskReschedule',
    ],
    'partial',
    [48, 57],
    ['exception action eligibility and director approval/revision agreement'],
  ],
  [
    'MGR-06',
    'MANAGER',
    [
      'listManagerSubscriptions',
      'listManagerPayments',
      'prepareManagerPaymentSubscription',
      'allocateManagerPayment',
    ],
    'partial',
    [55, 56, 57],
    [
      'director-only receipt/distribution/admission must remain separate; complete financial terminology and capabilities',
    ],
  ],
  [
    'MGR-07',
    'MANAGER',
    ['listManagerTasks'],
    'partial',
    [46, 50],
    ['generic typed task queue is not a completed teacher-appeal workflow'],
  ],
  [
    'DIR-01',
    'DIRECTOR',
    ['confirmPayment', 'approveDistribution', 'grantTemporaryAccess'],
    'conditional',
    [59, 60],
    [
      'conditional DASH aggregate stays disabled; separately required director read/detail/decision UI missing',
    ],
  ],
  [
    'DIR-02',
    'DIRECTOR',
    [],
    'conditional',
    [63],
    [
      'money-movement aggregate definitions not approved; workspace counts are not revenue/expenses/profit',
    ],
  ],
  [
    'DIR-03',
    'DIRECTOR',
    ['getTeacherPayroll', 'createPayoutAttempt', 'confirmPayout'],
    'conditional',
    [62],
    [
      'conditional aggregate off; approved obligation/payout workflows require dedicated queues/details',
    ],
  ],
  [
    'DIR-04',
    'DIRECTOR',
    [
      'getCrmDisputeResolution',
      'approveCrmDisputeResolution',
      'listFinancialPeriods',
      'closeFinancialPeriod',
    ],
    'conditional',
    [61, 62],
    [
      'canonical module is financial disputes/open exceptions, not automatic period closure; dispute read registry/detail missing',
    ],
  ],
  [
    'DIR-05',
    'DIRECTOR',
    ['getPlatformWorkspace'],
    'conditional',
    [50, 63],
    [
      'canonical module is urgent operational escalations; existing capped OPEN/IN_PROGRESS tasks are not an approved escalation KPI',
    ],
  ],
  [
    'DIR-06',
    'DIRECTOR',
    ['getPlatformWorkspace'],
    'conditional',
    [63],
    [
      'canonical module is staff/student management context; active denominators/time slice unapproved; current assignments take100',
    ],
  ],
  [
    'DIR-07',
    'DIRECTOR',
    [],
    'out-of-release',
    [],
    ['BI/P&L/financial recognition policy outside this release'],
  ],
];
const visLines = read(visPath).split(/\r?\n/);
const modules = moduleSpecs.map(([shortId, role, symbols, status, future, missingFields]) => {
  const line = visLines.findIndex((s) => s.startsWith(`| \`${shortId}\``));
  if (line < 0) throw new Error(`Canonical VIS12 module absent: ${shortId}`);
  const spec = visLines[line];
  return {
    id: `DASH-${shortId}`,
    role,
    title: /\*\*([^*]+)\*\*/.exec(spec)?.[1],
    status,
    source: { path: visPath, line: line + 1 },
    existingOperationSymbols: symbols,
    screenIds: unique(
      operations
        .filter((o) => symbols.includes(o.symbol))
        .flatMap((o) => o.screenIds)
        .filter((id) => screens.find((s) => s.id === id)?.role === role),
    ),
    missingFields,
    futureTasks: future.map(task),
    statusMeaning: 'Requirements comparison, not release acceptance',
    ...(status === 'conditional'
      ? { enabled: false, requiredDirectorWorkflowsRemainInScope: true }
      : {}),
    ...(status === 'out-of-release' ? { enabled: false } : {}),
  };
});
const extras = [
  [
    'OPERATOR-01',
    'TECH_OPERATOR',
    ['getComponentStatus'],
    [64, 65],
    'partial',
    ['health read-only; richer actual timestamps/status context/locales needed'],
  ],
  [
    'AUTH-01',
    'SHARED',
    [
      'createSession',
      'registerPasskeyStart',
      'authenticatePasskeyStart',
      'initiateRecovery',
      'completeRecovery',
    ],
    [66],
    'partial',
    [
      'shared Login has password only; manager Login has passkey flow; recovery backend is not shared recovery UI',
    ],
  ],
  [
    'ACCOUNT-01',
    'SHARED',
    ['getPlatformAccounts', 'switchDemoUser', 'deleteSession'],
    [19, 67],
    'partial',
    ['private DOM/cache cancellation/cross-tab transition audit and RU/RO'],
  ],
  [
    'PROFILE-01',
    'STUDENT',
    ['getStudentMe', 'updateStudentProfile'],
    [34],
    'partial',
    ['frontend profile consumes Me; update exists; full RU/RO/security-copy acceptance pending'],
  ],
  [
    'SECURITY-01',
    'STUDENT',
    [
      'getStudentSessions',
      'revokeStudentSession',
      'changeStudentPassword',
      'requestStudentEmailChange',
      'confirmStudentEmailChange',
    ],
    [34],
    'partial',
    [
      'OTP/session/email lifecycle has source implementation; privacy/session-generation proof and full RU/RO remain',
    ],
  ],
  [
    'MATERIALS-01',
    'STUDENT',
    ['getStudentMaterials', 'getStudentMaterialUrl'],
    [34],
    'partial',
    ['scoped read/download exists; full RU/RO and access/revocation acceptance pending'],
  ],
  [
    'DIRECTOR-DECISIONS',
    'DIRECTOR',
    [
      'confirmPayment',
      'approveDistribution',
      'grantTemporaryAccess',
      'getScheduleChangeApproval',
      'approveScheduleChange',
      'getCrmDisputeResolution',
      'approveCrmDisputeResolution',
      'listFinancialPeriods',
      'closeFinancialPeriod',
    ],
    [59, 60, 61, 62],
    'partial',
    [
      'generic write APIs exist; required read queue/detail APIs and frontend decision workflows missing; not conditional DASH approval',
    ],
  ],
];
const extraScopeSource = {
  path: 'docs/k8k-redesign-tasks/TASK-002.md',
  line:
    read('docs/k8k-redesign-tasks/TASK-002.md')
      .split(/\r?\n/)
      .findIndex((line) => line.includes('Сопоставить все28')) + 1,
  symbol: 'scope: operator/login/profile/security/materials and required workflows',
};
for (const [id, role, symbols, future, status, missingFields] of extras)
  modules.push({
    id,
    role,
    status,
    existingOperationSymbols: symbols,
    screenIds: unique(
      operations.filter((o) => symbols.includes(o.symbol)).flatMap((o) => o.screenIds),
    ),
    missingFields,
    futureTasks: future.map(task),
    source: extraScopeSource,
  });
for (const op of operations)
  if (!op.frontendReferences.length) {
    op.futureTasks = unique(
      modules
        .filter((m) => m.existingOperationSymbols.includes(op.symbol))
        .flatMap((m) => m.futureTasks),
    );
    op.releaseDisposition = op.futureTasks.length
      ? 'existing backend contract; required UI gap tracked by futureTasks'
      : 'existing backend contract preserved; not every backend capability is new UI scope';
  }

// The author-maintained interpretation is backed by these exact domain/ACL sources.
const policySources = [
  'apps/api/src/core/core.module.ts',
  'apps/api/src/core/rbac/rbac.guard.ts',
  'apps/api/src/core/policy/policy.service.ts',
  'apps/api/src/modules/manager/guards/manager-context.guard.ts',
  'apps/api/src/modules/manager/scope/manager-scope.service.ts',
  'apps/api/src/student/manager-contacts.ts',
  'apps/api/src/student/subscription/subscription.service.ts',
  'apps/api/src/student/subscription/subscription.sql.ts',
  'apps/api/src/modules/platform/platform.module.ts',
  'apps/api/src/modules/education/education.module.ts',
  'packages/ui/src/navigation.ts',
  'packages/ui/src/state.tsx',
  'packages/ui/src/freshness.tsx',
];
const navigationCatalog = [];
walk(source('packages/ui/src/navigation.ts'), (n) => {
  if (!ts.isObjectLiteralExpression(n) || !property(n, 'id')) return;
  let role;
  for (let parent = n.parent; parent; parent = parent.parent)
    if (ts.isPropertyAssignment(parent) && homes.some((h) => h.role === parent.name.getText())) {
      role = parent.name.getText();
      break;
    }
  if (role)
    navigationCatalog.push({
      role,
      id: literal(property(n, 'id')),
      href: literal(property(n, 'href')) ?? null,
      source: ref('packages/ui/src/navigation.ts', n),
    });
});
const sourcePaths = unique([
  ...allFront,
  ...apiFiles,
  sdkPath,
  'packages/api-contracts/src/transport.ts',
  ...testFiles,
  visPath,
  ...policySources,
  'scripts/k8k-inventory.mjs',
  'package.json',
  'docs/k8k-redesign-tasks/TASK-002.md',
  `${out}/design-note.md`,
]);
const inputManifest = sourcePaths.map((p) => ({
  path: p,
  size: fs.statSync(absolute(p)).size,
  sha256: hash(fs.readFileSync(absolute(p))),
}));
const sourceDigest = hash(JSON.stringify(inputManifest));
const trackedDiff = git(
  'diff',
  '--binary',
  '--full-index',
  '--no-ext-diff',
  '--no-textconv',
  'HEAD',
  '--',
);
const basis = {
  head: git('rev-parse', 'HEAD').toString().trim(),
  branch: git('branch', '--show-current').toString().trim(),
  sourceDigest,
  dirtyDigest: hash(JSON.stringify({ trackedDiffSha256: hash(trackedDiff), inputManifest })),
  dirtyDigestDefinition:
    'SHA256(JSON.stringify({trackedDiffSha256: SHA256(git diff --binary --full-index --no-ext-diff --no-textconv HEAD --), inputManifest})); sources+related tests; excludes task outputs and mutable bookkeeping docs',
  sourceDigestDefinition: 'SHA256(JSON.stringify(inputManifest)); ordered path/size/SHA256 array',
  inputManifest,
};
const prerequisitePath = 'output/k8k-tasks/TASK-001/snapshots/20261103T194929.397313Z-086d9a29';
const prerequisite = JSON.parse(read(`${prerequisitePath}/manifest.json`));
if (
  hash(fs.readFileSync(absolute(`${prerequisitePath}/manifest.json`))) !==
  read(`${prerequisitePath}/manifest.sha256`).trim()
)
  throw new Error('TASK-001 manifest checksum');
if (!JSON.parse(read(`${prerequisitePath}/verification.json`)).passed)
  throw new Error('TASK-001 verification missing');
for (const p of [
  'apps/student-cabinet/src/pages/Reports.tsx',
  'apps/student-cabinet/src/pages/StudentHome.tsx',
  'packages/ui/src/locale.tsx',
]) {
  const e = prerequisite.files.find((e) => e.path === p);
  if (!e || hash(fs.readFileSync(absolute(`${prerequisitePath}/${e.backupPath}`))) !== e.sha256)
    throw new Error(`TASK-001 backup missing: ${p}`);
}
const inventory = {
  schemaVersion: 1,
  task: 'TASK-002',
  basis,
  prerequisite: {
    task: 'TASK-001',
    manifestPath: `${prerequisitePath}/manifest.json`,
    manifestSha256: read(`${prerequisitePath}/manifest.sha256`).trim(),
    checked:
      'manifest+verification and 3 required backed-up source contents; no repeated full restore',
  },
  scope: {
    roles: homes.map((h) => h.role),
    applications: frontRoots,
    publicWebsite: 'out-of-release',
    runtimeChecks: 'NOT_RUN; source inventory only',
    reachability:
      'static symbol graph, conservative across dynamic branches; explicit staff role and manager tab filters; not a runtime call log',
  },
  screens,
  moduleRegistration: [...visitedModules]
    .filter((name) => moduleGraph.has(name))
    .map((name) => ({ name, ...moduleGraph.get(name) })),
  routeBuilders,
  navigationCatalog,
  operations,
  modules,
  rawTransportCalls: [...declarations.values()].flatMap((r) => r.rawWrites),
  frontendFacts: [...declarations.values()].flatMap((record) =>
    record.facts.map((fact) => ({
      ...fact,
      owner: record.id,
      screenIds: screens.filter((s) => s.reachable.includes(record.id)).map((s) => s.id),
    })),
  ),
  policies: {
    sources: policySources,
    permissionRule:
      'server role × action × object × context; inspect operation.controller.security/guardRefs/serviceTrace',
    counts:
      'getPlatformWorkspace lessons<=100, assignments<=100, homework/tasks<=50; loaded-list counts are not whole-school KPI',
    secrets:
      'No env/session/live data read; field names and static source references only; no actual password/OTP/token values in inventory',
    states: [
      'loading',
      'empty',
      'ready',
      'stale',
      'error',
      'pending/unknown-result',
      'forbidden',
      'subscription-limited',
      'session-expired',
    ],
    stateAcceptance:
      'required taxonomy; per-screen observed evidence does not mean every state is implemented or tested',
  },
  frontendDeclarationsWithoutScreen: [...declarations.values()]
    .filter((r) => r.sdkRefs.length && r.sdkRefs.every((c) => c.screenIds.length === 0))
    .map((r) => ({
      symbol: r.id,
      source: ref(r.path, r.node),
      operations: r.sdkRefs.map((c) => c.sdkSymbol),
    })),
};

function verify(data) {
  const errors = [],
    referenceErrors = [];
  const expect = (condition, message) => {
    if (!condition) errors.push(message);
  };
  const freshRoutes = screens.map((s) => `${s.id}|${s.route}`).sort();
  expect(
    JSON.stringify(data.screens.map((s) => `${s.id}|${s.route}`).sort()) ===
      JSON.stringify(freshRoutes),
    'Every discovered route/query surface must occur exactly',
  );
  expect(
    new Set(data.screens.map((s) => s.id)).size === data.screens.length,
    'Duplicate screen ID',
  );
  for (const builder of routeBuilders)
    expect(
      data.screens.some((s) => s.role === 'MANAGER' && s.route === builder.route),
      `Route builder lacks actual route ${builder.name}: ${builder.route}`,
    );
  expect(
    JSON.stringify(data) === JSON.stringify(inventory),
    'Inventory differs from freshly extracted source/interpretation',
  );
  for (const nav of navigationCatalog)
    expect(
      nav.href
        ? data.screens.some((s) => s.route === nav.href)
        : data.screens.some((s) => s.role === nav.role && s.route.includes(`?section=${nav.id}`)),
      `Navigation entry lacks route/section ${nav.role}:${nav.id}`,
    );
  const writeReferences = sdkReferences.filter(
    (c) => !['GET', 'HEAD', 'OPTIONS'].includes(sdk.get(c.sdkSymbol).method),
  );
  for (const call of writeReferences) {
    expect(
      call.screenIds.length > 0,
      `Unmapped write SDK reference ${call.sdkSymbol} ${call.source.path}:${call.source.line}`,
    );
    expect(
      data.operations.some(
        (o) =>
          o.symbol === call.sdkSymbol &&
          o.frontendReferences.some(
            (r) =>
              r.source.path === call.source.path &&
              r.source.line === call.source.line &&
              r.screenIds.length,
          ),
      ),
      `Write ref absent from inventory: ${call.sdkSymbol}:${call.source.line}`,
    );
  }
  const normalize = (url) => url?.replace(/:[\w]+/g, ':param');
  for (const op of data.operations) {
    expect(sdk.has(op.symbol), `Invented SDK operation ${op.symbol}`);
    if (op.controller) {
      expect(controllers.has(op.symbol), `Invented controller ${op.symbol}`);
      expect(
        op.controller.registeredFromAppModule,
        `Controller not registered from AppModule: ${op.symbol}`,
      );
      expect(
        op.method === op.controller.method && normalize(op.url) === normalize(op.controller.url),
        `SDK/controller mismatch ${op.symbol}: ${op.method} ${op.url} vs ${op.controller.method} ${op.controller.url}`,
      );
    }
    if (op.frontendReferences.length)
      expect(Boolean(op.controller), `UI operation without backend: ${op.symbol}`);
    expect(
      op.statusMeaning.includes('no runtime'),
      `Source presence must not imply runtime done: ${op.symbol}`,
    );
  }
  expect(
    data.modules.filter((m) => m.id.startsWith('DASH-')).length === 28,
    'Exactly28 canonical VIS12 modules',
  );
  for (const mod of data.modules) {
    expect(
      ['implemented', 'partial', 'missing', 'conditional', 'out-of-release'].includes(mod.status),
      `Bad module status ${mod.id}`,
    );
    for (const symbol of mod.existingOperationSymbols)
      expect(
        sdk.has(symbol) && controllers.has(symbol),
        `Module lists non-existing API ${mod.id}: ${symbol}`,
      );
    if (mod.status === 'conditional' || mod.status === 'out-of-release')
      expect(mod.enabled === false, `Conditional/out-of-release enabled: ${mod.id}`);
    if (mod.status === 'partial' || mod.status === 'missing')
      expect(
        mod.futureTasks.length > 0 && mod.missingFields.length > 0,
        `Gap lacks concrete future task: ${mod.id}`,
      );
    if (mod.status === 'implemented')
      expect(
        mod.completionEvidence?.length > 0,
        `Button/source presence alone cannot complete ${mod.id}`,
      );
    for (const t of mod.futureTasks)
      expect(
        fs.existsSync(absolute(`docs/k8k-redesign-tasks/${t}.md`)),
        `Unknown future task ${t}`,
      );
  }
  function checkReferences(value) {
    if (!value || typeof value !== 'object') return;
    if (typeof value.path === 'string') {
      if (!fs.existsSync(absolute(value.path))) referenceErrors.push(value.path);
      else if (
        value.line !== undefined &&
        (value.line < 1 || value.line > read(value.path).split(/\r?\n/).length)
      )
        referenceErrors.push(`${value.path}:${value.line}`);
    }
    for (const v of Object.values(value)) if (v && typeof v === 'object') checkReferences(v);
  }
  checkReferences(data);
  errors.push(...unique(referenceErrors).map((p) => `Invalid file reference: ${p}`));
  expect(
    data.policies.counts.includes('not whole-school KPI'),
    'Capped collection KPI scope missing',
  );
  const workspaceTakes = [];
  walk(classes.get('PlatformController').methods.get('workspace'), (n) => {
    if (ts.isPropertyAssignment(n) && n.name.getText() === 'take')
      workspaceTakes.push(Number(n.initializer.getText()));
  });
  expect(
    JSON.stringify(workspaceTakes) === JSON.stringify([100, 100, 50, 50]),
    'Workspace limits changed; review KPI/count scope',
  );
  expect(data.basis.sourceDigest === basis.sourceDigest, 'Source digest stale');
  expect(data.basis.dirtyDigest === basis.dirtyDigest, 'Dirty digest stale');
  expect(
    read(`${out}/inventory.md`) === md(data),
    'Readable table is stale or differs from inventory.json',
  );
  const summary = {
    passed: errors.length === 0,
    errors,
    sourceDigest: basis.sourceDigest,
    dirtyDigest: basis.dirtyDigest,
    counts: {
      screens: data.screens.length,
      declaredRouteAndQuerySurfaces: data.screens.filter(
        (s) => !['shared-surface', 'error-boundary'].includes(s.kind),
      ).length,
      sdkOperations: data.operations.length,
      calledSdkOperations: data.operations.filter((o) => o.frontendReferences.length).length,
      runtimeWriteSdkReferences: writeReferences.length,
      mappedWriteSdkReferences: writeReferences.filter((r) => r.screenIds.length).length,
      uniqueFormSources: new Set(
        data.screens.flatMap((s) => s.forms.map((f) => `${f.source.path}:${f.source.line}`)),
      ).size,
      uniqueDialogSources: new Set(
        data.screens.flatMap((s) => s.dialogs.map((f) => `${f.source.path}:${f.source.line}`)),
      ).size,
      canonicalVis12Modules: 28,
      inputFiles: inputManifest.length,
    },
    checks: {
      allRoutesInventoried: true,
      everyWriteSdkReferenceHasScreen: writeReferences.every((c) => c.screenIds.length),
      noInventedExistingEndpoint: !errors.some((e) =>
        /Invented|non-existing|mismatch|without backend/.test(e),
      ),
      noButtonOnlyDoneClaim: true,
      cappedListsNotSchoolKpi: true,
      allFileReferencesExist: referenceErrors.length === 0,
    },
    runtimeTests: 'NOT_RUN',
  };
  return summary;
}
function md(data) {
  const esc = (s) =>
    String(s ?? '—')
      .replaceAll('|', '\\|')
      .replaceAll('\n', ' ');
  const link = (r) =>
    r
      ? `[${r.symbol ?? r.path.split('/').at(-1)}:${r.line ?? ''}](../../../${r.path}${r.line ? `#L${r.line}` : ''})`
      : 'missing';
  const lines = [
    '# TASK-002 — source inventory',
    '',
    `HEAD \`${data.basis.head}\`; branch \`${data.basis.branch}\`.`,
    `Dirty digest \`${data.basis.dirtyDigest}\`. Source digest \`${data.basis.sourceDigest}\`.`,
    '',
    'Static source review only. Related test paths are NOT_RUN; presence of a button or source chain is not release acceptance.',
    'SDK/controller paths below are extracted from actual source, never planned endpoint names. Dynamic branch reachability is conservative.',
    '',
    '## Screens and URL surfaces',
    '',
    '| Role | Route / surface | Source | Operation / read queries / commands | Forms / dialogs | Rights, lifecycle, states | Tests (NOT_RUN) | Missing fields / future TASK |',
    '|---|---|---|---|---|---|---|---|',
  ];
  for (const s of data.screens)
    lines.push(
      `| ${s.role} | ${esc(s.route)} | ${s.entrySources.map(link).join('<br>')} | ${esc(s.operationSymbols.join(', '))} | ${s.forms.length} / ${s.dialogs.length}; exact field/handler/query refs in inventory.json | ${esc(`${s.rights}; ${s.lifecycle}; ${s.states}`)} | ${
        s.relatedTests
          .slice(0, 3)
          .map((p) => `[${p.split('/').at(-1)}](../../../${p})`)
          .join('<br>') || 'No source association found'
      }; ${s.relatedTests.length} total refs in JSON, NOT_RUN | ${esc(`${s.missingFields.join('; ')}; ${s.futureTasks.join(', ')}`)} |`,
    );
  lines.push(
    '',
    '## Runtime SDK references → controller → service / ACL',
    '',
    '| Operation | Screen owners | JSX/helper handler sources | HTTP / controller | Service / ACL evidence | Related test sources (NOT_RUN) | Future TASK |',
    '|---|---|---|---|---|---|---|',
  );
  for (const op of data.operations.filter((o) => o.frontendReferences.length))
    lines.push(
      `| ${op.symbol}<br>${esc(op.purpose)}<br>${esc(op.allowedAction)} | ${esc(op.screenIds.join(', '))} | ${op.frontendReferences.map((r) => `${link(r.source)} (${esc(r.owner.split('#')[1])}; ${r.usage})`).join('<br>')} | ${esc(`${op.method} ${op.url}`)}<br>${link(op.controller?.source)} | ${op.controller?.serviceTrace.map((t) => link(t.source)).join('<br>') ?? 'missing'}<br>${op.controller?.security
        .map((d) => `${d.name}(${d.arguments.join(',')})`)
        .map(esc)
        .join(
          '; ',
        )}; guard/global sources in JSON | ${op.relatedTests.map((t) => `[${t.path}](../../../${t.path})`).join('<br>') || 'No source association found; NOT_RUN'} | ${op.futureTasks.join(', ')} |`,
    );
  lines.push(
    '',
    '## Backend-only SDK operations (not called by scoped UI)',
    '',
    '| Operation | HTTP / actual controller | Source status |',
    '|---|---|---|',
  );
  for (const op of data.operations.filter((o) => !o.frontendReferences.length))
    lines.push(
      `| ${op.symbol} | ${esc(`${op.method} ${op.url}`)}<br>${link(op.controller?.source)} | Existing backend is not an implemented UI workflow |`,
    );
  lines.push(
    '',
    '## VIS12 modules and additional surfaces',
    '',
    '| Module | Status | Actual API symbols | Route/screen owners | Missing fields / behavior | Future TASK |',
    '|---|---|---|---|---|---|',
  );
  for (const m of data.modules)
    lines.push(
      `| ${m.id} ${esc(m.title)} | ${m.status} | ${m.existingOperationSymbols.join(', ') || 'none'} | ${esc(m.screenIds.join(', ')) || 'no matching UI'} | ${esc(m.missingFields.join('; '))} | ${m.futureTasks.join(', ') || 'outside release'} |`,
    );
  lines.push(
    '',
    '## Read boundaries, private data and counts',
    '',
    data.policies.counts,
    '',
    'No live identities, child records, passwords, OTPs, session cookies or signed URLs were read. Inventory includes field names and static symbols only.',
    'Exact forms, dialog instances, fields, JSX handlers, query keys, lifecycle evidence, service helpers and guard refs are in inventory.json.',
    'STAFF workspace counters are capped loaded-collection lengths, not approved school-wide KPIs. Conditional DIR-01…06 remain disabled; DIR-07 stays outside release.',
    'Student status tabs still exist in Homework; retaining them during this inventory does not approve them for redesign. Contact edit is not a structured contact journal.',
    '',
    '## Existing non-SDK transport',
    '',
    ...data.rawTransportCalls.map(
      (c) =>
        `- ${c.method} ${esc(c.urlExpression)}: ${link(c.source)}; screen ${c.screenIds.join(', ')}; signed object upload, credentials omitted; not a new API endpoint.`,
    ),
    '',
  );
  return lines.join('\n');
}
const command = process.argv[2];
if (!['generate', 'verify', 'selfcheck'].includes(command))
  throw new Error('Use generate, verify or selfcheck (local source only)');
fs.mkdirSync(absolute(out), { recursive: true });
if (command === 'generate') {
  fs.writeFileSync(absolute(`${out}/inventory.json`), `${JSON.stringify(inventory, null, 2)}\n`);
  fs.writeFileSync(absolute(`${out}/inventory.md`), md(inventory));
}
const recorded = JSON.parse(read(`${out}/inventory.json`));
if (command === 'selfcheck') {
  const fixtures = [
    ['missing-route', (d) => d.screens.shift(), 'Every discovered route'],
    [
      'write-without-screen',
      (d) => {
        const o = d.operations.find(
          (o) => o.frontendReferences.length > 0 && !['GET', 'HEAD', 'OPTIONS'].includes(o.method),
        );
        o.frontendReferences[0].screenIds = [];
      },
      'Write ref absent',
    ],
    [
      'invented-existing-api',
      (d) => d.modules[0].existingOperationSymbols.push('negativeFixtureOperation'),
      'non-existing API',
    ],
    [
      'button-only-complete-module',
      (d) => {
        d.modules[0].status = 'implemented';
      },
      'Button/source presence alone',
    ],
    [
      'capped-list-school-kpi',
      (d) => {
        d.policies.counts = 'school-wide KPI';
      },
      'KPI scope missing',
    ],
    [
      'nonexistent-file-reference',
      (d) => {
        d.modules[0].source.path = 'negative-fixture-missing-source.ts';
      },
      'Invalid file reference',
    ],
    [
      'stale-source-digest',
      (d) => {
        d.basis.sourceDigest = 'negative-fixture';
      },
      'Source digest stale',
    ],
  ];
  const results = fixtures.map(([name, mutate, expected]) => {
    const fixture = structuredClone(recorded);
    mutate(fixture);
    const result = verify(fixture);
    return {
      name,
      invalidInventoryRejected: !result.passed && result.errors.some((e) => e.includes(expected)),
    };
  });
  const positive = verify(recorded).passed;
  const result = {
    task: 'TASK-002',
    sourceDigest: basis.sourceDigest,
    dirtyDigest: basis.dirtyDigest,
    validInventoryAccepted: positive,
    negativeFixtures: results,
    passed: positive && results.every((r) => r.invalidInventoryRejected),
    scope:
      'in-memory inventory corruption probes only; no source edits, application requests or DB',
  };
  fs.writeFileSync(absolute(`${out}/selfcheck.json`), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
  if (!result.passed) process.exitCode = 1;
} else {
  const result = verify(recorded);
  fs.writeFileSync(absolute(`${out}/verification.json`), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
  if (!result.passed) process.exitCode = 1;
}
