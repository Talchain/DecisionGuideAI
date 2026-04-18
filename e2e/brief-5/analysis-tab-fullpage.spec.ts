/**
 * Brief 5 full-page visual baseline (Playwright).
 *
 * Matches the README commitment for full-page captures at Phase 0, end of
 * Phase 6, and Phase 7. Gated on BRIEF5_FULLPAGE=1 so it does NOT add load
 * to the default CI run. Enable locally with:
 *
 *   npm run dev -- --port 5177 --strictPort    # in one terminal
 *   BRIEF5_FULLPAGE=1 npx playwright test e2e/brief-5/ --update-snapshots
 *
 * Subsequent runs without --update-snapshots compare against the baseline.
 *
 * The spec deliberately targets the canvas sandbox route: it loads fully
 * without external network (the repo's existing e2e patterns install a fake
 * EventSource) and exercises the Analysis-tab surfaces this brief touched.
 */

import { test, expect } from '@playwright/test'
import { installFakeEventSource, waitForPanel } from '../_helpers'

test.describe('Brief 5 full-page visual baselines', () => {
  test.skip(
    !process.env.BRIEF5_FULLPAGE,
    'Set BRIEF5_FULLPAGE=1 to run Brief 5 full-page captures.',
  )

  test('Analysis tab — pre-analysis surface @brief-5', async ({ page }) => {
    await installFakeEventSource(page)
    await page.goto('/')
    await waitForPanel(page)

    // Tolerance 0.1 % per README — absorbs font rendering / antialias noise.
    await expect(page).toHaveScreenshot('analysis-tab-pre-analysis.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.001,
    })
  })
})
