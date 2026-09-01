import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: 'e2e/geometry',
  testMatch: '**/*.stagingmeasure.ts',
  fullyParallel: false, workers: 1, retries: 0, reporter: [['list']],
  timeout: 900_000, expect: { timeout: 60_000 },
  outputDir: 'test-results/stagingmeasure',
  use: { headless: true, trace: 'off', video: 'off', screenshot: 'off', deviceScaleFactor: 1 },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], deviceScaleFactor: 1 } }],
})
