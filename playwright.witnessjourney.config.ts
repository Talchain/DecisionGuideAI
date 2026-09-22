import { defineConfig } from '@playwright/test'
/**
 * EXPLORATORY JOURNEY WITNESS — deliberately NOT the Core gate suite.
 *
 * `playwright.core.config.ts` pins an expected-spec manifest and fails a run that
 * cannot name its build. Both guards are correct FOR A GATE and neither should be
 * loosened to let an exploratory probe in — so this config exists beside it. A
 * finding proven here graduates into `e2e/core/` with its manifest entry.
 *
 * No `webServer`: `vite.config.ts` throws at config load without the three proxy
 * env vars, and never loading it keeps that repair off this suite's path.
 * `retries: 0` — a retried journey is how a flaky harness hides.
 */
export default defineConfig({
  testDir: './e2e/witness-journey',
  timeout: 180_000,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: { headless: true, viewport: { width: 1440, height: 900 } },
})
