import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  // Enable parallel execution for sharded test runs (Phase A)
  fullyParallel: true,
  // Use 3 workers to parallelize @streaming, @debug-compare, @debug-inspector tags
  workers: process.env.CI ? 3 : 1,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  // Allow CI to skip @flaky, or run specific tags via grep (e.g., --grep @streaming)
  grepInvert: process.env.CI ? /@flaky/ : undefined,
  use: {
    baseURL: 'http://localhost:5177',
    headless: true,
    trace: 'on-first-retry',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  webServer: {
    command: 'npm run dev -- --port 5177 --strictPort',
    port: 5177,
    env: {
      VITE_E2E: '1',
      VITE_FEATURE_SSE: '1',
      VITE_FEATURE_HINTS: '1',
      VITE_SUPABASE_URL: 'http://localhost:54321',
      VITE_SUPABASE_ANON_KEY: 'test_anon_key',
      // PLoT V1 Backend Integration
      PLOT_API_URL: 'https://plot-lite-service.onrender.com',
      // PLoT V1 Streaming & Debug Features (for E2E tests)
      VITE_FEATURE_PLOT_STREAM: '1',
      VITE_FEATURE_COMPARE_DEBUG: '1',
      VITE_FEATURE_INSPECTOR_DEBUG: '1',
      // Command Palette (Priority 1)
      VITE_FEATURE_COMMAND_PALETTE: '1',
    },
    reuseExistingServer: true,
    timeout: 300_000, // 5 minutes for streaming scenarios
  },
})
