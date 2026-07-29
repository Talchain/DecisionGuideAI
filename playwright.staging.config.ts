import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright config for staging gates.
 *
 * Used by `pnpm e2e:staging:v5`. Targets specs that run against a DEPLOYED
 * staging host and therefore need no local dev server. Two shapes live here:
 *   - HTTP-only gates using the `request` fixture (v5-proxy-reachability)
 *   - real-browser journey gates against the deployed UI
 *     (required-login-window-gate — ROADMAP 2.126b)
 *
 * Differences from `playwright.config.ts`:
 *   - no `webServer` (does not launch `npm run dev`)
 *   - `testMatch` narrowed to staging-gated specs only
 *   - no `baseURL` (specs use absolute URLs from staging env vars)
 *
 * Specs targeted here are individually self-skipping when their staging
 * env vars are absent, so this config is also safe to invoke without env.
 * `required-login-window-gate` additionally self-skips when the deployed build
 * has not had `VITE_REQUIRE_LOGIN` flipped on — see that file's header; a red
 * suite on an unflipped environment would be a broken alarm.
 */
export default defineConfig({
  testDir: 'e2e',
  testMatch: [
    '**/smoke/v5-proxy-reachability.spec.ts',
    '**/smoke/required-login-window-gate.spec.ts',
  ],
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
