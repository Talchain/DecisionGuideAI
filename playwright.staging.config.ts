import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright config for HTTP-only staging gates.
 *
 * Used by `pnpm e2e:staging:v5`. Targets specs that hit a deployed staging
 * host directly via Playwright's `request` fixture and therefore need no
 * local dev server.
 *
 * Differences from `playwright.config.ts`:
 *   - no `webServer` (does not launch `npm run dev`)
 *   - `testMatch` narrowed to staging-gated specs only
 *   - no `baseURL` (specs use absolute URLs from staging env vars)
 *
 * Specs targeted here are individually self-skipping when their staging
 * env vars are absent, so this config is also safe to invoke without env.
 */
export default defineConfig({
  testDir: 'e2e',
  testMatch: ['**/smoke/v5-proxy-reachability.spec.ts'],
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    headless: true,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Intentionally no webServer — staging gates make HTTP requests directly
  // to a deployed host and should not require a local dev server.
})
