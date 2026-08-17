import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright config for the VISUAL REGRESSION harness.
 *
 * Separate from `playwright.config.ts` on purpose, and the reasons are not
 * cosmetic:
 *
 *  - `updateSnapshots: 'none'`. The default config would let a missing
 *    reference be written on the first attempt and then MATCH on the retry,
 *    turning "there is no baseline" into a green run. Here a missing reference
 *    is a hard error. `VISREG_BLESS=1` is the only way to write one, and it is
 *    a deliberate, reviewable act (see e2e/visual/README.md).
 *
 *  - `retries: 0`, always. Retrying a visual comparison is how a flaky harness
 *    hides. If a state is not deterministic, that is a defect in the state's
 *    seeding, not something to paper over — and this harness has to be trusted
 *    to be worth running at all.
 *
 *  - Its own dev server on its own port. `playwright.config.ts` sets
 *    `reuseExistingServer: true` on 5177, which under concurrent lanes means
 *    silently measuring somebody else's server with somebody else's env
 *    (CLAUDE.md trap 9b). This one always boots its own on 5187 with
 *    `strictPort`, so a collision is a loud failure rather than a wrong answer.
 *
 *  - The dev server's required proxy env is set explicitly. `vite.config.ts`
 *    THROWS at config load unless `ENGINE_SERVICE_URL`, `CEE_SERVICE_URL` and
 *    `ISL_SERVICE_URL` are present (`requireProxyEnv`, no fallback for those
 *    three), and nothing under `.github/` supplies them. They are pointed at
 *    the discard port so the harness is hermetic and can never reach a real
 *    service; `e2e/visual/harness.ts` additionally intercepts and serves a
 *    fixed 503, so the offline path is deterministic rather than merely offline.
 */

const BLESS = process.env.VISREG_BLESS === '1'
const UNREACHABLE = 'http://127.0.0.1:9'

export default defineConfig({
  testDir: 'e2e/visual',
  globalSetup: './e2e/visual/globalSetup.ts',
  // The completeness guard. In teardown, not in a spec, so `--grep` cannot
  // exclude the check that proves the run measured something.
  globalTeardown: './e2e/visual/globalTeardown.ts',
  testMatch: '**/*.visual.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  // A visual comparison that only ever writes what it saw is not an
  // instrument. Blessing is explicit and out-of-band.
  updateSnapshots: BLESS ? 'all' : 'none',
  reporter: [['list'], ['html', { outputFolder: 'playwright-report-visual', open: 'never' }]],
  timeout: 120_000,
  expect: { timeout: 20_000 },
  outputDir: 'test-results/visual',

  // References are platform-scoped. Chromium renders text differently on
  // darwin and linux, so a darwin reference compared on linux is a guaranteed
  // false positive. Keeping them in separate directories makes "there is no
  // linux baseline yet" a visible, nameable state instead of a mystery diff.
  snapshotPathTemplate: 'e2e/visual/references/{platform}/{arg}{ext}',

  use: {
    baseURL: 'http://localhost:5187',
    headless: true,
    trace: 'retain-on-failure',
    video: 'off',
    screenshot: 'off',
    deviceScaleFactor: 1,
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], deviceScaleFactor: 1 } }],

  webServer: {
    command: 'pnpm exec vite --port 5187 --strictPort',
    port: 5187,
    reuseExistingServer: false,
    timeout: 240_000,
    env: {
      // Required by vite.config.ts requireProxyEnv (no fallback for these).
      ENGINE_SERVICE_URL: UNREACHABLE,
      CEE_SERVICE_URL: UNREACHABLE,
      ISL_SERVICE_URL: UNREACHABLE,
      PLOT_API_URL: UNREACHABLE,
      ASSIST_BFF_URL: UNREACHABLE,
      // Without these ~24 spec files vanish at COLLECT while the run still
      // prints a healthy total (CLAUDE.md trap 2b).
      VITE_SUPABASE_URL: 'http://localhost:54321',
      VITE_SUPABASE_ANON_KEY: 'test_anon_key',
      VITE_FEATURE_SSE: '0',
      TZ: 'UTC',
    },
  },
})
