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
 * Follow-up P0 + IMP-1: navigate through the shared gotoSandbox helper so
 * the spec actually lands on the sandbox panel (the earlier `page.goto('/')`
 * landed on the auth/Decisions shell). Screenshot stability hardened with a
 * fixed 1280x900 viewport (DS v5 desktop minimum) and prefers-reduced-motion
 * so animation/font-rendering noise doesn't produce false diffs.
 */

import { test, expect } from '@playwright/test'
import { gotoSandbox } from '../_helpers'

const VIEWPORT = { width: 1280, height: 900 }

test.describe('Brief 5 full-page visual baselines', () => {
  test.skip(
    !process.env.BRIEF5_FULLPAGE,
    'Set BRIEF5_FULLPAGE=1 to run Brief 5 full-page captures.',
  )

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(VIEWPORT)
    // Disable CSS animations + transitions + reduced-motion so screenshots
    // are byte-stable across runs. Applied before navigation so it covers
    // every element mounted afterwards.
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

  test('Analysis tab — sandbox panel @brief-5', async ({ page }) => {
    await gotoSandbox(page)
    // Re-inject the stability styles after navigation (the before-each
    // injection may have raced the goto).
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
