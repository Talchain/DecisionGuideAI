import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: [
      'src/**/__tests__/**/*.{test,spec}.?(c|m)[jt]s?(x)',
      'src/**/tests/**/*.{test,spec}.?(c|m)[jt]s?(x)',
      'tests/**/*.{test,spec}.?(c|m)[jt]s?(x)'
    ],
    exclude: [
      'src/__tests__/sanity.test.ts'
    ],
    environment: 'jsdom',
    watch: false,
    reporters: ['default'],
    css: false,
    setupFiles: ['tests/setup/rtl.ts'],
    restoreMocks: true,
    clearMocks: true,
    mockReset: true,
    isolate: true,
    passWithNoTests: true,
    // Limit parallelism to avoid JS heap OOM in CI and local full runs
    poolOptions: {
      threads: {
        maxThreads: 2,
        minThreads: 1,
      },
    },
    // P1: Coverage configuration with enterprise thresholds
    coverage: {
      provider: 'v8',
      enabled: false, // Enable via --coverage flag
      reporter: ['text-summary', 'lcov', 'html'],
      reportsDirectory: './coverage',
      // Exclude non-source files from coverage
      exclude: [
        'node_modules/**',
        'dist/**',
        'coverage/**',
        '**/*.d.ts',
        '**/__tests__/**',
        '**/tests/**',
        '**/*.config.{js,ts}',
        '**/test-utils/**',
        '**/mocks/**',
      ],
      // Enterprise coverage thresholds (baseline - can be increased over time)
      thresholds: {
        statements: 40,
        branches: 35,
        functions: 40,
        lines: 40,
      },
    },
  },
})
