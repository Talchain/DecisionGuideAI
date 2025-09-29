import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
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
    },
    reuseExistingServer: true,
    timeout: 240_000,
  },
})
