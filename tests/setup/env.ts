/**
 * Test Environment Normalization
 *
 * Sets consistent environment variables for test runs to eliminate flakiness.
 * Loaded via Vitest setupFiles configuration.
 *
 * Purpose:
 * - Ensure reproducible test baselines locally and in CI
 * - Disable rate limiting for tests
 * - Provide strong default secrets for test isolation
 * - Configure feature flags explicitly
 *
 * Usage in vitest.config.ts:
 *   setupFiles: ['./tests/setup/env.ts']
 */

/**
 * Baseline environment for all tests
 */
export function setupTestEnvironment() {
  // Disable rate limiting in tests (prevents flaky failures)
  process.env.RATE_LIMIT_ENABLED = '0'

  // SCM-Lite: default OFF (enable only for @scm-lite tagged tests)
  if (!process.env.SCM_LITE_ENABLE) {
    process.env.SCM_LITE_ENABLE = '0'
  }

  // HMAC Secret: provide strong default for tests
  if (!process.env.HMAC_SECRET) {
    process.env.HMAC_SECRET = 'test-hmac-secret-32-bytes-long-deterministic-value'
  }

  // Metrics: unset by default (some tests expect this to be undefined)
  // Tests that need metrics should set explicitly in their setup
  if (process.env.METRICS !== undefined && process.env.METRICS !== '1') {
    delete process.env.METRICS
  }

  // Feature flags: explicit defaults for test reproducibility
  // These can be overridden per-test with vi.stubEnv()

  // PLoT Streaming (required for streaming tests)
  if (!process.env.VITE_FEATURE_PLOT_STREAM) {
    process.env.VITE_FEATURE_PLOT_STREAM = '1' // Enable by default for coverage
  }

  // Debug features (compare, inspector)
  if (!process.env.VITE_FEATURE_COMPARE_DEBUG) {
    process.env.VITE_FEATURE_COMPARE_DEBUG = '0' // OFF by default
  }

  if (!process.env.VITE_FEATURE_INSPECTOR_DEBUG) {
    process.env.VITE_FEATURE_INSPECTOR_DEBUG = '0' // OFF by default
  }

  // Command Palette, Snapshots, etc. - OFF by default
  if (!process.env.VITE_FEATURE_COMMAND_PALETTE) {
    process.env.VITE_FEATURE_COMMAND_PALETTE = '0'
  }

  if (!process.env.VITE_FEATURE_INPUTS_OUTPUTS) {
    process.env.VITE_FEATURE_INPUTS_OUTPUTS = '0'
  }

  if (!process.env.VITE_FEATURE_OPTIMISE_BETA) {
    process.env.VITE_FEATURE_OPTIMISE_BETA = '0'
  }

  if (!process.env.VITE_FEATURE_DEBUG) {
    process.env.VITE_FEATURE_DEBUG = '0'
  }

  if (!process.env.VITE_FEATURE_SNAPSHOTS_V2) {
    process.env.VITE_FEATURE_SNAPSHOTS_V2 = '0'
  }

  if (!process.env.VITE_FEATURE_ONBOARDING) {
    process.env.VITE_FEATURE_ONBOARDING = '0'
  }

  // Reconnection flags - OFF by default
  if (!process.env.VITE_PLOT_STREAM_RECONNECT) {
    process.env.VITE_PLOT_STREAM_RECONNECT = '0'
  }

  if (!process.env.VITE_PLOT_STREAM_EVENTSOURCE_FALLBACK) {
    process.env.VITE_PLOT_STREAM_EVENTSOURCE_FALLBACK = '0'
  }

  // Console logging for debugging test failures
  if (process.env.DEBUG_TESTS === '1') {
    console.log('[Test Env] Environment normalized:')
    console.log('  RATE_LIMIT_ENABLED:', process.env.RATE_LIMIT_ENABLED)
    console.log('  SCM_LITE_ENABLE:', process.env.SCM_LITE_ENABLE)
    console.log('  VITE_FEATURE_PLOT_STREAM:', process.env.VITE_FEATURE_PLOT_STREAM)
    console.log('  VITE_FEATURE_COMPARE_DEBUG:', process.env.VITE_FEATURE_COMPARE_DEBUG)
    console.log('  VITE_FEATURE_INSPECTOR_DEBUG:', process.env.VITE_FEATURE_INSPECTOR_DEBUG)
  }
}

// Auto-run on import
setupTestEnvironment()
