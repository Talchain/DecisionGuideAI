import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://localhost:5176',
    headless: true,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --port 5176',
    port: 5176,
    env: {
      VITE_FEATURE_SSE: '1',
      VITE_FEATURE_HINTS: '1',
      VITE_SUPABASE_URL: 'http://localhost:54321',
      VITE_SUPABASE_ANON_KEY: 'test_anon_key',
    },
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
