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
      // ── iCloud sync-conflict copies ───────────────────────────────────────
      // iCloud Drive resolves a sync conflict by writing a SECOND file whose
      // basename gains a " <n>" suffix — `foo 2.test.ts` sitting beside
      // `foo.test.ts`. They are never tracked by git (they exist only in a
      // synced working tree), but the include globs above DO collect them, so a
      // local run silently executes a frozen copy of the suite alongside the
      // real one: test counts inflate, and a fix to the real file can look like
      // it did not bite because the stale twin still asserts the old behaviour.
      //
      // This is a PATTERN over iCloud's naming convention, deliberately NOT a
      // list of filenames. A filename list is the hand-maintained mirror that
      // goes stale the next time the sync conflicts, and the drift reads as
      // green — the defect class this repo's guards exist to avoid.
      //
      // SCOPE, stated precisely, because a broader claim would be false: this
      // excludes exactly the conflict shape the include glob COLLECTS, i.e. the
      // digits fall at the end of the stem, before the `.test`/`.spec` segment.
      // The other shape iCloud produces — `foo.test 2.ts`, digits AFTER that
      // segment — does not end in `.{test,spec}.<ext>` and is therefore never
      // matched by the include in the first place. It needs no exclude, and
      // adding one would be machinery that cannot be shown to bite.
      //
      // Nothing tracked matches this pattern; `git ls-files` is the check.
      '**/* +([0-9]).{test,spec}.?(c|m)[jt]s?(x)',
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
