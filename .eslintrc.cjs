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
  ignorePatterns: ['dist/', 'node_modules/', 'coverage/', '.vite/'],
  rules: {
    'no-console': 'warn',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }]
  },
  overrides: [
    {
      // Safe entry must never import React/Zustand/React Flow
      files: ['src/poc/safe/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': ['error', {
          paths: [
            { name: 'react', message: 'Safe entry must not import React' },
            { name: 'react-dom', message: 'Safe entry must not import React DOM' },
            { name: 'zustand', message: 'Safe entry must not import Zustand' },
            { name: 'reactflow', message: 'Safe entry must not import React Flow' },
            { name: '@xyflow/react', message: 'Safe entry must not import React Flow' },
            { name: '@xyflow/system', message: 'Safe entry must not import React Flow' },
            { name: '@sentry/react', message: 'Safe entry must not import Sentry React' }
          ],
          patterns: [
            { group: ['**/store*'], message: 'Safe entry must not import app stores' },
            { group: ['**/ReactFlow*'], message: 'Safe entry must not import graph components' },
            { group: ['**/*ErrorBoundary*'], message: 'Safe entry must not import error boundaries' }
          ]
        }]
      }
    }
  ]
}
