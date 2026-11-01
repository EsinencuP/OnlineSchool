import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { managerRules } from './scripts/eslint-manager-rules.mjs';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/dist-tools/**',
      '**/.turbo/**',
      '**/src/generated/**',
      'ref/**',
      'template/**',
      '.codex/**',
      '.playwright-mcp/**',
      'apps/manager-web/test/public/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: globals.node },
    rules: { 'no-throw-literal': 'error' },
  },
  {
    files: [
      'apps/qa-shell/src/**/*.{ts,tsx}',
      'apps/student-cabinet/src/**/*.{ts,tsx}',
      'apps/manager-web/src/**/*.{ts,tsx}',
    ],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['apps/manager-web/test/*.mjs'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  {
    files: ['apps/*/src/**/*.{ts,tsx}', 'packages/*/src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        { selector: 'ThrowStatement', message: 'Return Result<T, E> for application failures.' },
      ],
    },
  },
  {
    files: ['apps/manager-web/src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        { selector: 'ThrowStatement', message: 'Return Result for application failures.' },
        {
          selector: 'CallExpression[callee.name=/^(Number|parseFloat|fetch)$/]',
          message: 'Use decimal strings and the generated API client.',
        },
        { selector: 'NewExpression[callee.name="Number"]', message: 'Use Decimal for money.' },
        {
          selector: 'CallExpression[callee.property.name=/^(parseFloat|toNumber)$/]',
          message: 'Keep money as Decimal strings.',
        },
        {
          selector: 'JSXAttribute[name.name="dangerouslySetInnerHTML"]',
          message: 'Render user input as plain text.',
        },
      ],
    },
  },
  {
    files: ['apps/api/src/core/errors/domain-error.ts'],
    rules: { 'no-restricted-syntax': 'off' },
  },
  {
    files: ['apps/api/src/modules/manager/**/*.ts'],
    plugins: { manager: { rules: managerRules } },
    rules: {
      'manager/no-protected-writes': 'error',
      'manager/finance-facade-only': 'error',
      'manager/result-services': 'error',
      'manager/no-money-number': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ThrowStatement',
          message: 'INV-08: return Result; HTTP conversion belongs to core.',
        },
        {
          selector: 'CallExpression[callee.name=/^(Number|parseFloat)$/]',
          message: 'INV-05: use Decimal and decimal strings.',
        },
        {
          selector: 'NewExpression[callee.name="Number"]',
          message: 'INV-05: use Decimal and decimal strings.',
        },
        {
          selector:
            'CallExpression[callee.object.name="Number"][callee.property.name="parseFloat"]',
          message: 'INV-05: use Decimal and decimal strings.',
        },
      ],
    },
  },
  prettier,
);
