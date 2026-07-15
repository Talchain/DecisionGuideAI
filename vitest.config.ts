import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    include: [
      'src/**/__tests__/**/*.{test,spec}.?(c|m)[jt]s?(x)',
      'src/**/tests/**/*.{test,spec}.?(c|m)[jt]s?(x)',
      'tests/**/*.{test,spec}.?(c|m)[jt]s?(x)'
    ],
    exclude: [
      // ── Complex DOM integration tests: need full canvas mount or network mocking ──
      'src/canvas/__tests__/ReactFlowGraph.layout.dom.spec.tsx', // CSS-var dock offsets not set in jsdom
      'src/canvas/__tests__/canvas.run-gating.dom.spec.tsx', // toast rendering requires full canvas pipeline
      // Note: HeroSection/RecommendationSection dead-code tests were deleted from disk
      // (Brief 5.4 Phase 2 + closeout). No longer needed in exclude list.
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
    // Single thread to avoid JS heap OOM locally. CI has more RAM and uses
    // sharded runners for parallelism instead.
    poolOptions: {
      threads: {
        maxThreads: 1,
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
