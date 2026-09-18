/**
 * THE MODEL-EXTENT NOTICE STAYS REMOVED — AND THIS FILE NOW PROVES IT IN A BROWSER.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THIS FILE CHANGED (18 Sep 2026)
 * ═══════════════════════════════════════════════════════════════════════════
 * It used to pin three things about the bottom-of-canvas "Showing N of M
 * elements / Show whole model" panel: that it APPEARS when part of the model is
 * off-screen, that its button WORKS, and that it STAYS AWAY when everything
 * fits. All three premises are void. The founder asked for that panel to be
 * removed — twice — and `ReactFlowGraph.tsx` records the second request
 * verbatim: *"I'm sure I've requested this before, so I don't know why it's
 * back, but just get rid of it completely."* (14 Sep 2026.)
 *
 * PR #1561 removed the mount and updated the UNIT-level guard
 * (`overlayOwner.sourceScan.spec.ts` pins `ModelExtentNotice` in its
 * `INTENTIONALLY_UNMOUNTED` set). It did not reach the e2e consumers of the
 * removed testids, so these two tests have failed on every run since —
 * `getByTestId('model-extent-notice')` finds nothing, and the second test's
 * overflow branch asserts a notice that cannot exist.
 *
 * ⛔ THEY WERE NOT FAILING BECAUSE THE PRODUCT IS WRONG. They were asserting a
 * thing the founder decided to delete, which is the most expensive kind of red:
 * it looks like a defect, it is noise, and the estate had already begun routing
 * around the whole job because of it.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT IT PINS NOW, AND WHY THAT IS WORTH MORE THAN DELETING THE FILE
 * ═══════════════════════════════════════════════════════════════════════════
 * That the notice is ABSENT FROM A RUNNING BROWSER — not merely unmounted in
 * the source. This has already come back once: a later session read the missing
 * mount as an accident, restored it, and the founder had to ask a second time.
 * The unit guard catches a re-mount in the source; this catches it wherever it
 * comes from, including a rebuild of the same panel under new names.
 *
 * ⚠ THE ABSENCE IS ONLY MEANINGFUL WITH ITS PRECONDITION. On a model that fits,
 * the notice would have been absent even when it existed, so the assertion would
 * prove nothing. `build-vs-buy` is used because it OVERFLOWS the first view, and
 * that overflow is asserted in-test before any absence is believed — this is the
 * exact state in which the old notice was designed to appear.
 *
 * ⚠ AND A CONTRAST CONTROL, because a page that rendered no overlays at all
 * would satisfy every absence below. The viewport controls are mounted from the
 * SAME region of `ReactFlowGraph` — the element immediately after the comment
 * marking the removed one — so if they are visible, the probe can see overlays
 * in the place the notice used to occupy.
 *
 * ⭐ THE HONEST CAVEAT, carried over from the ruling rather than dropped: this
 * was the only surface telling a person part of their model is off-screen. The
 * real repair is that the model should FIT. Removing the disclosure is not free,
 * and this file is not an argument that it was.
 */
import { test, expect, type Page } from '@playwright/test'
import {
  preparePage, openCanvas, seedStarterDraft, clearNotifications,
  freezeMotion, waitForVisualQuiescence, VIEWPORTS,
} from './harness'
import { GHOST_ID_PREFIX } from '../../src/canvas/utils/fitTargets'

/** Every testid the removed panel owned. Absence is asserted for ALL of them. */
const REMOVED_TESTIDS = ['model-extent-notice', 'model-extent-count', 'model-extent-show-all'] as const

/**
 * Nodes wholly inside the pane, and the total, read from the live DOM.
 *
 * ⚠ THE MODEL, NOT EVERY MOUNTED NODE. Filtered by the product's own
 * `GHOST_ID_PREFIX` rather than a fourth literal: a filter that restates the ids
 * it filters is drift. Ghost nodes are invitations to EXTEND the model, not part
 * of it, and counting them made this measurement disagree with the product's own
 * fit target.
 */
async function nodeVisibility(page: Page) {
  return page.evaluate((ghostPrefix: string) => {
    const pane = document.querySelector('.react-flow') as HTMLElement | null
    if (!pane) return { paneOk: false, total: 0, fullyVisible: 0, hidden: document.hidden }
    const pr = pane.getBoundingClientRect()
    const els = [...document.querySelectorAll('.react-flow__node')].filter(
      el => !((el as HTMLElement).dataset.id ?? '').startsWith(ghostPrefix),
    )
    const fullyVisible = els.filter(el => {
      const r = el.getBoundingClientRect()
      return r.top >= pr.top - 1 && r.bottom <= pr.bottom + 1 && r.left >= pr.left - 1 && r.right <= pr.right + 1
    }).length
    return {
      paneOk: pr.width > 0 && pr.height > 0,
      total: els.length,
      fullyVisible,
      hidden: document.hidden,
    }
  }, GHOST_ID_PREFIX)
}

test.describe('the removed model-extent notice stays removed', () => {
  test('build-vs-buy: the model overflows the first view and NOTHING offers to show the rest', async ({ page }) => {
    await preparePage(page, VIEWPORTS[0])
    await openCanvas(page)
    await seedStarterDraft(page, 'build-vs-buy')
    await clearNotifications(page)
    await freezeMotion(page)
    await waitForVisualQuiescence(page)

    // ENVIRONMENT, asserted before any number is believed. A hidden tab measures
    // 0x0 and every absence below would be free.
    const v = await nodeVisibility(page)
    expect(v.hidden, 'document.hidden — a hidden tab measures 0x0 and every result is void').toBe(false)
    expect(v.paneOk, 'the canvas pane has no size — nothing was measured').toBe(true)
    expect(v.total, 'no nodes mounted').toBeGreaterThan(0)

    // PRECONDITION: this is the state the removed notice existed to speak in.
    // Without it the absence below is trivially true and proves nothing.
    expect(
      v.fullyVisible,
      `build-vs-buy is expected to overflow the first view; ${v.fullyVisible}/${v.total} were fully visible, ` +
      `so the state the notice was designed for was never reached and its absence is untested`,
    ).toBeLessThan(v.total)

    // CONTRAST CONTROL: overlays ARE reachable in this page, in the same region
    // of the tree the notice used to occupy. Without this, a page that rendered
    // no overlays at all would pass every absence assertion below.
    await expect(
      page.getByRole('navigation', { name: 'Viewport controls' }),
      'no overlay is visible at all — the absences below would be blindness, not evidence',
    ).toBeVisible()

    // THE RULING, IN A BROWSER.
    for (const testId of REMOVED_TESTIDS) {
      await expect(
        page.getByTestId(testId),
        `\`${testId}\` is back. ModelExtentNotice was removed on the founder's explicit instruction ` +
        `("just get rid of it completely", 14 Sep 2026) and has been restored once already by a ` +
        `session that read its absence as an accident. If this is a deliberate reinstatement, the ` +
        `ruling in ReactFlowGraph.tsx and the INTENTIONALLY_UNMOUNTED pin in ` +
        `overlayOwner.sourceScan.spec.ts must change first.`,
      ).toHaveCount(0)
    }
  })
})
