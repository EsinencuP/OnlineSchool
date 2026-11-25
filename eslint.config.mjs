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
      '.codex/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: globals.node },
    rules: { 'no-throw-literal': 'error' },
  },
  {
    files: ['apps/*/src/**/*.ts', 'packages/*/src/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        { selector: 'ThrowStatement', message: 'Return Result<T, E> for application failures.' },
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
