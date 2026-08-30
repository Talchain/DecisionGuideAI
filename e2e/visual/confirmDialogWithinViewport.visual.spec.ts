/**
 * The confirmation dialog lands inside the viewport, in a real browser.
 *
 * ── WHY A BROWSER TEST, AND WHY THIS ONE ───────────────────────────────────
 * `ConfirmDialog`'s overlay is `position: fixed; inset-0`. That fills the
 * viewport ONLY while no ancestor establishes a containing block — and
 * `TopBar.module.css` sets `backdrop-filter: blur(8px)`, which does. The
 * KebabMenu renders the dialog inside that pill, so `inset-0` resolved to a
 * 43px-tall box and the card centred in it, putting its title and first line
 * ABOVE THE FOLD.
 *
 * Measured on deployed staging at 1280x800, guest, on two consecutive builds
 * (so this is not a regression of the rename, it is older than it):
 *   6a93f806  "Reset canvas?"       overlay 477x43   card top  -73
 *   6a94047c  "Start a new model?"  overlay 411x43   card top -112
 *
 * jsdom cannot see any of that (trap 3). `ConfirmDialog.portal.spec.tsx` pins
 * the structural half — the overlay is not a descendant of its mount point —
 * and this pins the half a user experiences. A portal that rendered off-screen
 * would satisfy that spec and fail this one; a lucky ancestor would satisfy
 * this one and fail that. Both, or neither is evidence.
 *
 * No screenshot is captured, so this spec adds nothing to the reference
 * manifest the completeness guard asserts.
 */

import { test, expect } from '@playwright/test'
import { preparePage, openCanvas } from './harness'

const VIEWPORTS = [
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
]

for (const vp of VIEWPORTS) {
  test(`the start-new-model confirmation is fully inside the viewport @ ${vp.width}x${vp.height}`, async ({ page }) => {
    // A cold `vite dev` optimises dependencies on the first navigation; the
    // suite default is not generous enough for a spec that may run alone
    // under --grep, where nothing has warmed the server first.
    test.setTimeout(300_000)
    await preparePage(page, vp)
    // PRE-WARM. A cold `vite dev` can take longer to serve the module graph
    // than `openCanvas`'s own hard 30s `.react-flow` timeout, which no test-level
    // timeout can extend. Paying that cost here keeps the spec reliable when run
    // alone under --grep, without weakening the assertion inside the harness.
    await page.goto('/#/canvas', { waitUntil: 'domcontentloaded', timeout: 180_000 })
    await page.locator('.react-flow').waitFor({ state: 'visible', timeout: 180_000 })
    await openCanvas(page)

    // Assert the measuring environment in the SAME read as the measurement.
    const env = await page.evaluate(() => ({ hidden: document.hidden, w: window.innerWidth, h: window.innerHeight }))
    expect(env.hidden, 'a hidden document does not lay out reliably').toBe(false)
    expect(env.w).toBe(vp.width)
    expect(env.h).toBe(vp.height)

    await page.click('button[aria-label="More options"]')
    await page.click('[data-testid="kebab-start-new-model"]')

    const card = page.locator('[role="dialog"]', { hasText: 'Start a new model?' }).locator('> div')
    await expect(card).toBeVisible()

    const box = await card.boundingBox()
    expect(box, 'the confirmation card has no layout box').not.toBeNull()

    // The claim, stated as FULL containment — an "intersects the viewport"
    // check passes on a card whose title is off the top, which is the whole
    // defect.
    expect(box!.y, 'card top is above the fold').toBeGreaterThanOrEqual(0)
    expect(box!.x, 'card left is off-screen').toBeGreaterThanOrEqual(0)
    expect(box!.y + box!.height, 'card bottom is below the fold').toBeLessThanOrEqual(vp.height)
    expect(box!.x + box!.width, 'card right is off-screen').toBeLessThanOrEqual(vp.width)

    // The precondition: the title we are framing is actually rendered, so this
    // cannot pass by measuring some other dialog's box.
    await expect(page.getByText('Start a new model?')).toBeVisible()
  })
}
