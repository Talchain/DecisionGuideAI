import { defineConfig, devices } from '@playwright/test'
const UNREACHABLE = 'http://127.0.0.1:9'
export default defineConfig({
  testDir: 'e2e/geometry',
  testMatch: '**/*.measure.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  timeout: 180_000,
  expect: { timeout: 30_000 },
  outputDir: 'test-results/geometry',
  use: { baseURL: 'http://localhost:5189', headless: true, trace: 'off', video: 'off', screenshot: 'off', deviceScaleFactor: 1 },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], deviceScaleFactor: 1 } }],
  webServer: {
    command: 'pnpm exec vite --port 5189 --strictPort',
    port: 5189,
    reuseExistingServer: false,
    timeout: 240_000,
    env: {
      ENGINE_SERVICE_URL: UNREACHABLE, CEE_SERVICE_URL: UNREACHABLE, ISL_SERVICE_URL: UNREACHABLE,
      PLOT_API_URL: UNREACHABLE, ASSIST_BFF_URL: UNREACHABLE,
      VITE_SUPABASE_URL: 'http://localhost:54321', VITE_SUPABASE_ANON_KEY: 'test_anon_key',
      VITE_FEATURE_SSE: '0', TZ: 'UTC',
    },
  },
})
