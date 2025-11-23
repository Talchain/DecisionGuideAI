module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'react'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'prettier'
  ],
  env: { browser: true, es2022: true, node: true, jest: true },
  settings: { react: { version: 'detect' } },
  ignorePatterns: ['dist/', 'node_modules/', 'coverage/', '.vite/', 'scripts/'],
  rules: {
    'no-console': 'warn',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }]
  },
  overrides: [
    {
      // Enable Node.js globals for .cjs files
      files: ['**/*.cjs'],
      env: { node: true },
      rules: {
        'no-console': 'off'
      }
    },
    {
      // Design tokens guard: disallow raw hex colours in canvas JSX/TSX components
      files: ['src/canvas/**/*.{tsx,jsx}'],
      excludedFiles: ['src/canvas/**/__tests__/**', 'src/canvas/**/*.spec.*'],
      rules: {
        'no-restricted-syntax': [
          'error',
          {
            selector: "Literal[raw=/['\"]#[0-9A-Fa-f]{3,6}['\"]/]",
            message:
              'Use design tokens (CSS variables or Tailwind semantic colours) instead of raw hex colour literals in canvas components.',
          },
        ],
      },
    },
    {
      // AIR-GAP: Safe entry and boot helpers must never import React/Zustand/React Flow/shim
      files: ['src/poc/safe/**/*', 'src/boot/safe-*.ts'],
      rules: {
        'no-restricted-imports': ['error', {
          patterns: [
            { group: ['react*'], message: 'Safe path must not import React' },
            { group: ['react-dom*'], message: 'Safe path must not import React DOM' },
            { group: ['zustand*'], message: 'Safe path must not import Zustand' },
            { group: ['@xyflow/*'], message: 'Safe path must not import React Flow' },
            { group: ['use-sync-external-store*'], message: 'Safe path must not import shim' },
            { group: ['../**/*store*'], message: 'Safe path must not import app stores' }
          ]
        }]
      }
    }
  ]
}
