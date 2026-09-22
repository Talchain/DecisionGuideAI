import { defineConfig } from '@playwright/test'
/**
 * CANVAS WITNESS — the instrument for the Canvas editor goal (22 Sep 2026).
 *
 * Separate from `playwright.core.config.ts` (a gate with a pinned spec manifest)
 * and from `playwright.witnessjourney.config.ts` (the whole-journey witness).
 * This one measures the Canvas's own two questions: is the model truthful to
 * inspect, and is it genuinely editable.
 *
 * No `webServer`: it binds to the SHA-pinned `deploy_url` permalink from
 * /version.json, so a run cannot straddle a mid-run redeploy.
 * `retries: 0` — a retried witness is how a flaky instrument hides.
 */
export default defineConfig({
  testDir: './e2e/canvas-witness',
  timeout: 240_000,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: { headless: true, viewport: { width: 1440, height: 900 } },
})
