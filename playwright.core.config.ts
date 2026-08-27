import { defineConfig, devices } from '@playwright/test'

/**
 * SYSTEM E — the Core PoC mounted-browser suite.
 *
 * Drives the DEPLOYED staging build in a real browser. 5-10 specs, each falsifying
 * a Core claim. Not a regression net; not a replacement for the historical estate.
 *
 * WHY ITS OWN CONFIG, rather than repointing `playwright.staging.config.ts`:
 *
 *  - SKIP SEMANTICS ARE OPPOSITE. That config's specs are deliberately self-skipping
 *    and one has never been executed against a live environment on purpose — correct
 *    for an optional gate. For a Core gate it is fatal: a skipped suite exits 0 and
 *    looks exactly like a pass. Mixing both semantics under one config means one of
 *    them is wrong. Here a Core spec that cannot run FAILS.
 *
 *  - NO `webServer`, deliberately and load-bearingly. `vite.config.ts` THROWS at
 *    config load unless ENGINE_SERVICE_URL / CEE_SERVICE_URL / ISL_SERVICE_URL are
 *    present (`requireProxyEnv`, no fallback for those three). Because this config
 *    never launches `npm run dev`, it never loads `vite.config.ts` and that repair
 *    is not on this suite's path at all.
 *
 *  - `testMatch` NEVER IMPORTS `e2e/palette.spec.ts`, whose undeclared bare
 *    `axe-playwright` import zeroes collection for the whole historical estate
 *    (`Total: 0 tests in 0 files`). MEASURED 2026-08-27: this config collects and
 *    runs with that breakage still in place and NO repair. Fixing that import is a
 *    one-line courtesy for whoever wants the old estate back — it is not a
 *    dependency of System E.
 *
 *  - `retries: 0`, always. Retrying a journey is how a flaky harness hides. If a
 *    journey is not deterministic that is a defect in its seeding, not something to
 *    paper over — and this suite has to be trusted to be worth running at all.
 *
 * TARGET: `CORE_UI_URL` (default https://staging--olumi.netlify.app). The quartet it
 * ran against is pinned by scripts/golden-journey/lib/quartet-manifest.mjs and
 * recorded in the evidence, because a drifting target makes a verdict unattributable.
 *
 * ⛔ CREDENTIALS: none. Accounts are minted through the project's OPEN REST signup
 * with the PUBLIC publishable key crawled from the deployed bundle. No service-role
 * key is read, stored or accepted by this suite.
 */

const ORIGIN = process.env.CORE_UI_URL ?? 'https://staging--olumi.netlify.app'

export default defineConfig({
  testDir: 'e2e/core',
  testMatch: '**/*.core.spec.ts',
  globalSetup: './e2e/core/globalSetup.ts',
  // The completeness guard. In teardown, not in a spec, so `--grep` cannot exclude
  // the check that proves the run measured something.
  globalTeardown: './e2e/core/globalTeardown.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  // A Core spec may not be marked `.only` into CI and silently shrink the run.
  forbidOnly: !!process.env.CI,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report-core', open: 'never' }]],
  timeout: 420_000,
  expect: { timeout: 30_000 },
  outputDir: 'test-results/core',
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
