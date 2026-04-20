/**
 * Brief 5 full-page visual baseline (Playwright). Close-out item B.
 *
 * Opt-in safety net for Brief-5 touched surfaces. Gated behind
 * `BRIEF5_FULLPAGE=1` to match the sibling `your-expertise-brief-only.spec.ts`
 * pattern and to avoid blocking CI until per-platform baselines exist.
 *
 * Baseline strategy — Brief 5.2 close-out round 2 (2026-04-20):
 * Playwright writes platform-suffixed baselines (`-chromium-darwin.png`,
 * `-chromium-linux.png`, etc). The committed `analysis-tab-sandbox-chromium-
 * darwin.png` is useful for macOS developers running this spec locally, but
 * CI runs on `ubuntu-latest` and needs a matching `-chromium-linux.png`. To
 * keep this promise honest:
 *   (a) This spec stays gated off in default CI runs via `BRIEF5_FULLPAGE`.
 *       The suite skips the test when the env flag is unset.
 *   (b) Per-platform baselines must be captured deliberately. macOS baseline
 *       is committed; Linux baseline must be generated either (i) by a CI
 *       workflow invoking `npx playwright test --update-snapshots e2e/brief-5
 *       --project=chromium` in a pull-request that uploads the generated
 *       PNG as an artefact, or (ii) inside a Linux Docker container locally
 *       (`docker run --rm -v $(pwd):/work mcr.microsoft.com/playwright:latest
 *       bash -c "cd /work && npm ci && BRIEF5_FULLPAGE=1 npx playwright
 *       test --update-snapshots e2e/brief-5"`). Commit the resulting PNG
 *       alongside this spec to activate Linux coverage.
 *   (c) Once both baselines exist, remove the `test.skip(...)` guard below
 *       to flip this to always-on.
 *
 * Navigation: the shared `gotoSandbox` helper lands on the default sandbox
 * e2e seed (there is no committed "mid-market bundle" debug route; the nearest
 * reachable fully-hydrated surface is the sandbox panel).
 *
 * Screenshot stability: fixed 1280×900 viewport (DS v5 desktop minimum),
 * `prefers-reduced-motion: reduce`, and a `*` CSS override that zeroes
 * animation/transition durations and hides the caret. Tolerance is 0.1 %
 * pixel difference.
 */

import { test, expect } from '@playwright/test'
import { gotoSandbox } from '../_helpers'

const VIEWPORT = { width: 1280, height: 900 }
const BASELINE_GATED = process.env.BRIEF5_FULLPAGE !== '1'

test.describe('Brief 5 full-page visual baselines @brief-5', () => {
  test.skip(BASELINE_GATED, 'Set BRIEF5_FULLPAGE=1 to run. See spec header for per-platform baseline capture.')

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
