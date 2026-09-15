/**
 * WITNESS RUNS — long, deliberately AD HOC, and deliberately NOT in CI.
 *
 * ⚠ WHY A CONFIG OF ITS OWN RATHER THAN A `.core.spec.ts`. These specs drive a
 * full journey against deployed staging and take minutes each; folding them
 * into the Core suite would add that to every PR for a question that is asked
 * a handful of times, and Core's `globalTeardown` completeness guard is written
 * around Core's own manifest. They are instruments, run when the question is
 * live — and the question they answer (does a producer field ever ARRIVE) is
 * not one a per-PR gate can settle anyway.
 *
 *     npx playwright test --config=playwright.witness.config.ts
 */
import { defineConfig, devices } from '@playwright/test'

const ORIGIN = process.env.CORE_UI_URL ?? 'https://staging--olumi.netlify.app'

export default defineConfig({
  testDir: 'e2e/witness',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  timeout: 900_000,
  expect: { timeout: 30_000 },
  outputDir: 'test-results/witness',
  use: {
    baseURL: ORIGIN,
    headless: true,
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    viewport: { width: 1280, height: 800 },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
