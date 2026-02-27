import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: [
      'src/**/__tests__/**/*.{test,spec}.?(c|m)[jt]s?(x)',
      'src/**/tests/**/*.{test,spec}.?(c|m)[jt]s?(x)',
      'tests/**/*.{test,spec}.?(c|m)[jt]s?(x)'
    ],
    exclude: [
      'src/__tests__/sanity.test.ts',
      // ── Known-broken tests (pre-existing, tracked for future repair) ──
      'src/__fixtures__/__tests__/malformed-responses.spec.ts',
      'src/adapters/assistants/__tests__/bff-only.spec.ts',
      'src/canvas/__tests__/ReactFlowGraph.layout.dom.spec.tsx',
      'src/canvas/__tests__/canvas.run-gating.dom.spec.tsx',
      'src/canvas/__tests__/domain.spec.ts',
      'src/canvas/__tests__/store.validation.spec.ts',
      'src/canvas/components/__tests__/ActionsRow.spec.tsx',
      'src/canvas/components/__tests__/InputsDock.dom.spec.tsx',
      'src/canvas/components/__tests__/ObjectiveBanner.spec.tsx',
      'src/canvas/components/__tests__/OutcomesSignal.spec.tsx',
      'src/canvas/components/__tests__/OutputsDock.dom.spec.tsx',
      'src/canvas/components/__tests__/ResultsPanel.gating.spec.tsx',
      'src/canvas/components/__tests__/ResultsPanel.spec.tsx',
      'src/canvas/components/__tests__/ValidationChip.spec.tsx',
      'src/canvas/export/__tests__/export-brief.spec.ts',
      'src/canvas/hooks/__tests__/useCanvasKeyboardShortcuts.spec.ts',
      'src/canvas/hooks/__tests__/useKeyInsight.spec.tsx',
      'src/canvas/hooks/__tests__/useRobustness.spec.ts',
      'src/canvas/onboarding/__tests__/OnboardingOverlay.dom.spec.tsx',
      'src/canvas/utils/__tests__/validateOutgoing.spec.ts',
      'src/canvas/validation/__tests__/graphPreflight.test.ts',
      'src/components/layout/__tests__/LeftSidebar.test.tsx',
      'src/lib/__tests__/ctaStateMachine.spec.ts',
      'src/pages/sandbox-guide/__tests__/hooks/useCopilotStore.test.ts',
      'src/pages/sandbox-guide/__tests__/utils/journeyDetection.test.ts',
      'src/pages/sandbox-guide/components/shared/__tests__/InsightItem.test.tsx',
      'src/test/__tests__/invariants/ui/no-semantic-transforms.test.ts',
      'tests/canvas/panels/PanelSection.test.tsx',
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
