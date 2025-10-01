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
    'test-*.js',
    '**/*.mjs',
    '**/*.ts',
    '**/*.tsx',
  ] },

  // Base JS recommended rules
  js.configs.recommended,
]
