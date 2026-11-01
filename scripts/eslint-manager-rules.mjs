// Manager boundary rules also run against mutation fixtures in manager-architecture.test.mjs.
const protectedDelegates = new Set([
  'paymentReceipt',
  'paymentDistribution',
  'subscription',
  'entitlementGrant',
  'entitlementConsumption',
  'entitlementAdjustment',
  'temporaryAccessPermission',
  'refundRecord',
  'skillMap',
  'skillEntry',
  'skillAssessment',
  'skillAuditLog',
  'skillSnapshot',
  'learningGoal',
  'learningGoalHistory',
  'homework',
  'homeworkAssignment',
  'homeworkDelivery',
  'homeworkSubmission',
  'submissionReview',
  'homeworkDraft',
  'homeworkUpload',
  'homeworkSubmissionAttachment',
  'homeworkAssignmentAttachment',
  'educationalReport',
  'educationReport',
  'educationReportRead',
  'progressCheckpoint',
  'ledgerEntry',
  'ledgerLine',
  'ledgerDocument',
]);
const writes = new Set([
  'create',
  'createMany',
  'createManyAndReturn',
  'update',
  'updateMany',
  'updateManyAndReturn',
  'upsert',
  'delete',
  'deleteMany',
]);
function property(node) {
  if (!node) return undefined;
  return node.computed ? node.property?.value : node.property?.name;
}
const unwrap = (node) => {
  while (node && ['ChainExpression', 'TSAsExpression', 'TSNonNullExpression'].includes(node.type))
    node = node.expression;
  return node;
};
export const managerRules = {
  'finance-facade-only': {
    meta: {
      type: 'problem',
      schema: [],
      messages: {
        boundary:
          'INV-03: manager financial mutations must go through finance/manager-finance.facade.ts.',
      },
    },
    create(context) {
      const filename = context.filename.replaceAll('\\', '/');
      if (filename.endsWith('/finance/manager-finance.facade.ts')) return {};
      const forbidden =
        /\/(?:payments\.service|ledger-publication\.service|finance-ledger\.service|entitlements\.service|manager-disputes\/dispute\.service|manager-payments\/(?:workflow|lesson-rights)\.service|manager-subscriptions\/lifecycle\.(?:service|module))\.js$/;
      function check(node, source, specifiers) {
        if (typeof source !== 'string' || !source.includes('finance/')) return;
        const runtime = specifiers?.filter((s) => s.importKind !== 'type') ?? [];
        if (node.importKind === 'type') return;
        if (
          filename.endsWith('/manager.module.ts') &&
          source.endsWith('/manager-subscriptions/lifecycle.module.js') &&
          runtime.every((s) => s.imported?.name === 'ManagerSubscriptionLifecycleModule')
        )
          return;
        if (
          forbidden.test(source) ||
          runtime.some((s) =>
            [
              'ManagerAllocationFinance',
              'PaymentsService',
              'LedgerPublicationService',
              'FinanceLedger',
              'ManagerPaymentWorkflow',
              'ManagerLessonRights',
              'DisputeFinanceService',
              'ManagerSubscriptionLifecycle',
            ].includes(s.imported?.name),
          )
        )
          context.report({ node, messageId: 'boundary' });
      }
      return {
        ImportDeclaration(node) {
          check(node, node.source.value, node.specifiers);
        },
        ImportExpression(node) {
          check(node, node.source.value);
        },
        ExportNamedDeclaration(node) {
          if (node.source) check(node, node.source.value, node.specifiers);
        },
      };
    },
  },
  'no-protected-writes': {
    meta: {
      type: 'problem',
      schema: [],
      messages: {
        write:
          'INV-02/03: protected education/ledger writes must use their owning domain service; raw SQL is forbidden here.',
      },
    },
    create(context) {
      const aliases = new Map();
      function delegate(node, seen = new Set()) {
        node = unwrap(node);
        if (!node) return false;
        if (node.type === 'Identifier') {
          if (seen.has(node.name)) return false;
          seen.add(node.name);
          return aliases.has(node.name) && delegate(aliases.get(node.name), seen);
        }
        if (node.type === 'MemberExpression')
          return protectedDelegates.has(property(node)) || delegate(node.object, seen);
        return false;
      }
      function isWrite(node, seen = new Set()) {
        node = unwrap(node);
        if (node?.type === 'Identifier' && aliases.has(node.name)) {
          if (seen.has(node.name)) return false;
          seen.add(node.name);
          return isWrite(aliases.get(node.name), seen);
        }
        return (
          node?.type === 'MemberExpression' && writes.has(property(node)) && delegate(node.object)
        );
      }
      return {
        VariableDeclarator(node) {
          if (node.id.type === 'Identifier' && node.init) aliases.set(node.id.name, node.init);
          if (node.id.type === 'ObjectPattern' && node.init)
            for (const entry of node.id.properties)
              if (entry.type === 'Property' && entry.value.type === 'Identifier')
                aliases.set(entry.value.name, {
                  type: 'MemberExpression',
                  object: node.init,
                  computed: entry.computed,
                  property: entry.key,
                });
        },
        AssignmentExpression(node) {
          if (node.left.type === 'Identifier') aliases.set(node.left.name, node.right);
        },
        // Prohibit taking write-method references too (bind/call/destructuring cannot hide them).
        'Program:exit'(program) {
          const keys = context.sourceCode.visitorKeys;
          const visit = (node) => {
            if (
              isWrite(node) ||
              (node.type === 'MemberExpression' &&
                /^\$(?:executeRaw|queryRaw)/.test(property(node) ?? '') &&
                !(
                  property(node) === '$queryRaw' &&
                  node.parent?.type === 'CallExpression' &&
                  node.parent.arguments[0]?.name === 'sql' &&
                  context.sourceCode
                    .getAncestors(node)
                    .some(
                      (parent) => parent.type === 'MethodDefinition' && parent.key?.name === 'read',
                    ) &&
                  context.filename
                    .replaceAll('\\', '/')
                    .match(
                      /\/modules\/manager\/(?:students\/students\.read|dashboard\/dashboard\.read)\.ts$/,
                    )
                ))
            )
              context.report({ node, messageId: 'write' });
            for (const key of keys[node.type] ?? []) {
              const child = node[key];
              for (const item of Array.isArray(child) ? child : [child])
                if (item?.type) visit(item);
            }
          };
          visit(program);
        },
      };
    },
  },
  'result-services': {
    meta: {
      type: 'problem',
      schema: [],
      messages: {
        result:
          'INV-08: async manager service methods must explicitly return Promise<Result<T, DomainError>>.',
      },
    },
    create(context) {
      return {
        MethodDefinition(node) {
          if (!context.filename.endsWith('.service.ts') || !node.value.async) return;
          const annotation = context.sourceCode.getText(node.value.returnType ?? node.value);
          if (
            !/^:\s*Promise\s*<\s*Result\s*</.test(annotation) ||
            !/DomainError\s*>\s*>/.test(annotation)
          )
            context.report({ node, messageId: 'result' });
        },
      };
    },
  },
  'no-money-number': {
    meta: {
      type: 'problem',
      schema: [],
      messages: {
        money: 'INV-05: money must use Decimal/string, never number or native arithmetic.',
      },
    },
    create(context) {
      const money = /(?:amount|price|balance|money|payment|refund|revenue|cost|salary)|^total$/i;
      const quantities = new Set(['refundLessons']);
      function monetary(node) {
        return (
          node &&
          (node.type === 'Identifier'
            ? money.test(node.name) && !quantities.has(node.name)
            : node.type === 'MemberExpression'
              ? money.test(property(node) ?? '') && !quantities.has(property(node))
              : false)
        );
      }
      return {
        TSNumberKeyword(node) {
          let field = node.parent;
          while (
            field &&
            !['PropertyDefinition', 'TSPropertySignature', 'Identifier'].includes(field.type)
          )
            field = field.parent;
          if (
            field?.key?.name === 'total' &&
            /PageDto$/.test(field.parent?.parent?.id?.name ?? '')
          ) {
            const members = field.parent.body ?? [];
            if (
              members.some(
                (m) =>
                  m.key?.name === 'items' &&
                  m.typeAnnotation?.typeAnnotation?.type === 'TSArrayType',
              ) &&
              ['page', 'pageSize'].every((name) => members.some((m) => m.key?.name === name))
            )
              return;
          }
          if (
            field &&
            !quantities.has(field.key?.name ?? field.name ?? '') &&
            money.test(field.key?.name ?? field.name ?? '')
          )
            context.report({ node, messageId: 'money' });
        },
        BinaryExpression(node) {
          if (
            ['+', '-', '*', '/', '%', '**'].includes(node.operator) &&
            (monetary(node.left) || monetary(node.right))
          )
            context.report({ node, messageId: 'money' });
        },
      };
    },
  },
};
