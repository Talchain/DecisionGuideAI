/**
 * Brief 5 full-page visual baseline (Playwright). Close-out item B.
 *
 * Always-on safety net for Brief-5 touched surfaces. Runs on every Playwright
 * CI shard — not gated on an env var — so regressions are caught by default.
 *
 * Navigation: the shared `gotoSandbox` helper lands on the default sandbox
 * e2e seed (there is no committed "mid-market bundle" debug route; the nearest
 * reachable fully-hydrated surface is the sandbox panel).
 *
 * Screenshot stability: fixed 1280×900 viewport (DS v5 desktop minimum),
 * `prefers-reduced-motion: reduce`, and a `*` CSS override that zeroes
 * animation/transition durations and hides the caret. Tolerance is 0.1 %
 * pixel difference.
 *
 * Baseline lifecycle: the baseline image is NOT committed with this spec.
 * First CI run after this lands must be invoked with `--update-snapshots` to
 * generate `e2e/brief-5/analysis-tab-fullpage.spec.ts-snapshots/
 * analysis-tab-sandbox.png`; a follow-up commit then pins the baseline.
 * Without that one-time bootstrap the spec will report "missing screenshot"
 * on the first run in a new environment — by design, so the baseline is
 * captured deliberately rather than auto-accepted.
 */

import { test, expect } from '@playwright/test'
import { gotoSandbox } from '../_helpers'

const VIEWPORT = { width: 1280, height: 900 }

test.describe('Brief 5 full-page visual baselines @brief-5', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(VIEWPORT)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation-duration: 0s !important;
          animation-delay: 0s !important;
          transition-duration: 0s !important;
          transition-delay: 0s !important;
          caret-color: transparent !important;
        }
      `,
    }).catch(() => { /* page may not be loaded yet; inject again after goto */ })
  })

  test('Analysis tab — sandbox panel (always-on golden path)', async ({ page }) => {
    await gotoSandbox(page)
    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation-duration: 0s !important;
          transition-duration: 0s !important;
          caret-color: transparent !important;
        }
      `,
    }).catch(() => {})

    await expect(page).toHaveScreenshot('analysis-tab-sandbox.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.001,
    })
  })
})
