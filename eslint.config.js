// Flat config for ESLint v9+
// Guardrails: perf wrappers, UI flags via context, and no vi.resetModules in tests.
import tsParser from '@typescript-eslint/parser'
import tseslint from '@typescript-eslint/eslint-plugin'
import reactPlugin from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import importPlugin from 'eslint-plugin-import'

/** @type {import('eslint').Linter.FlatConfig[]} */
export default [
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx,jsx}'],
    ignores: ['dist', 'build', '.vite', 'node_modules'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
        warnOnUnsupportedTypeScriptVersion: false,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      react: reactPlugin,
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
      import: importPlugin,
    },
    settings: { react: { version: 'detect' } },
  },
  // App perf wrapper only: enforce using lib/perf.ts for marks/measures
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/lib/perf.ts'],
    rules: {
      'no-restricted-properties': ['error',
        { object: 'performance', property: 'mark', message: 'Use lib/perf.ts mark()' },
        { object: 'performance', property: 'measure', message: 'Use lib/perf.ts measure()' },
      ],
    },
  },
  // Exempt the wrapper implementation itself
  {
    files: ['src/lib/perf.ts'],
    rules: {
      'no-restricted-properties': 'off',
    },
  },
  // UI flags via context: block importing config helpers in UI directories
  {
    files: ['src/sandbox/{components,panels,ui}/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [
          { name: '@/lib/config', message: 'Use useFlags() from lib/flags.tsx in UI.' },
        ],
      }],
    },
  },
  // Tests: forbid vi.resetModules(); prefer renderSandbox() + per-test mocks
  {
    files: ['src/sandbox/**/__tests__/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': ['error', {
        selector: "MemberExpression[object.name='vi'][property.name='resetModules']",
        message: 'Do not use vi.resetModules(); use renderSandbox() and per-test mocks.',
      }],
    },
  },
];
