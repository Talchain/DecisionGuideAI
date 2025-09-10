module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint','react','react-hooks','jsx-a11y','import'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:jsx-a11y/recommended',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'prettier',
  ],
  settings: { react: { version: 'detect' } },
  ignorePatterns: ['dist','build','.vite','node_modules'],
  overrides: [
    {
      // App perf wrapper only: enforce using lib/perf.ts for marks/measures
      files: ['src/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-properties': ['error',
          { object: 'performance', property: 'mark', message: 'Use lib/perf.ts mark()' },
          { object: 'performance', property: 'measure', message: 'Use lib/perf.ts measure()' },
        ],
      },
    },
    {
      // UI flags via context: block importing config helpers in UI directories
      files: ['src/sandbox/{components,panels,ui}/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': ['error', {
          paths: [
            { name: '@/lib/config', message: 'Use useFlags() from lib/flags.tsx in UI.' },
          ],
        }],
      },
    },
    {
      // Tests: forbid vi.resetModules(); prefer renderSandbox() + per-test mocks
      files: ['src/**/__tests__/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-syntax': ['error', {
          selector: "MemberExpression[object.name='vi'][property.name='resetModules']",
          message: 'Do not use vi.resetModules(); use renderSandbox() and per-test mocks.',
        }],
      },
    },
  ],
};
