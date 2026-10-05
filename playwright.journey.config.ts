import { defineConfig, devices } from '@playwright/test'

/**
 * J1 · the whole-PoC journey (brief F, DL 0df0e1; spec: Integrator J1-SPEC-RULING).
 *
 * The same harness as System E (`e2e/core/lib/harness.ts`), aimed at a stack that
 * `.github/workflows/journey-j1.yml` boots on the runner:
 *   UI (vite preview) → CEE → PLoT → ISL, plus a local Supabase,
 * with the LLM boundary answering from frozen recordings.
 *
 * Its own config, not `playwright.core.config.ts`, because:
 *  - the core config's globalSetup/Teardown attribute a DEPLOYED build and enforce
 *    the E-spec manifest. J1 attributes its build through the tuple the workflow
 *    checked out, asserted in step J0;
 *  - J1 is ONE serial journey: every step consumes ids captured by the step before.
 *
 * Same semantics as core: retries 0 (a retried journey hides a flake), forbidOnly,
 * and a step that cannot run FAILS rather than skips.
 */
export default defineConfig({
  testDir: 'e2e/core/journey',
  testMatch: '**/*.journey.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report-journey', open: 'never' }]],
  timeout: 900_000,
  expect: { timeout: 30_000 },
  outputDir: 'test-results/journey',
  use: {
    baseURL: process.env.CORE_UI_URL ?? 'http://localhost:5173',
    headless: true,
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    viewport: { width: 1440, height: 900 },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
})
