import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/dist-tools/**',
      '**/.turbo/**',
      '**/src/generated/**',
      'graphify-out/**',
      'ref/**',
      'template/**',
      '.codex/**',
      '.playwright-mcp/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: globals.node },
    rules: { 'no-throw-literal': 'error' },
  },
  {
    files: ['apps/qa-shell/src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
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
    files: ['apps/api/src/core/errors/domain-error.ts'],
    rules: { 'no-restricted-syntax': 'off' },
  },
  prettier,
);
