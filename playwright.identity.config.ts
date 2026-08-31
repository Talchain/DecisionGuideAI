import { defineConfig, devices } from '@playwright/test'

// Playwright otherwise writes error-context DOM even when screenshots are off.
process.env.PLAYWRIGHT_NO_COPY_PROMPT = '1'

// Explicit opt-in config only; never collected by the historical *.spec.ts suites.
export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/identity-owner-collaboration.identity.ts',
  outputDir: 'test-results/identity',
  workers: 1,
  retries: 0,
  timeout: 900_000,
  expect: { timeout: 30_000 },
  reporter: [['list']],
  use: {
    ...devices['Desktop Chrome'],
    headless: true,
    trace: 'off',
    video: 'off',
    screenshot: 'off',
    actionTimeout: 30_000,
    navigationTimeout: 45_000,
  },
})
