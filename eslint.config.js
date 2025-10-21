import js from '@eslint/js'

export default [
  // Ignore artefacts, Node scripts, and TypeScript files (typechecked separately)
  { ignores: [
    'dist/**',
    'docs/**',
    'playwright-report/**',
    'test-results/**',
    '.github/**',
    'tools/**',
    'supabase/**',
    'scripts/**',
    'test-*.js',
    '**/*.mjs',
    '**/*.cjs',
    '**/*.ts',
    '**/*.tsx',
  ] },

  // Base JS recommended rules
  js.configs.recommended,
]
