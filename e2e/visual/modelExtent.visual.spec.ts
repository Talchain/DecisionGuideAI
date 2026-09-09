/**
 * THE FIRST VIEW TELLS THE TRUTH ABOUT HOW MUCH OF THE MODEL IT IS SHOWING.
 *
 * ⛔⛔ BOTH ARMS ARE PARKED, AND THE REASON IS A LIVE DEFECT RATHER THAN A DEAD
 * TEST. READ THIS BEFORE DELETING ANYTHING HERE.
 *
 * #1340 removed the extent notice on Paul's instruction ("annoying and takes up
 * unnecessary space"), and it had also demonstrably lied — its own frame spec
 * records it reading "Showing 0 of 19 elements" with nine nodes on screen. Both
 * true. But the notice was the FIX for the last clause of the paragraph below —
 * *"and nothing on screen says so"* — and **the framing defect it disclosed was
 * never fixed.**
 *
 * Verified at `origin/staging`, 9 Sep 2026:
 *   · `utils/zoomLegibility.ts:110` still returns `{ minZoom: LABEL_LEGIBLE_ZOOM }`
 *     for a PRODUCT-initiated fit, and `LABEL_LEGIBLE_ZOOM = 0.5`. The auto-fit
 *     still clamps and centres.
 *   · `CanvasLodNotice` does NOT cover it: it fires on `vp.zoom < LABEL_LEGIBLE_ZOOM`
 *     (`:124`), and the product fit lands AT 0.5 — silent in exactly the failing
 *     case. It also answers a different question (labels too small), not this one.
 *   · "Fit to view" is a RECOVERY, not a DISCLOSURE. A control the user must
 *     think to press cannot tell them about a condition they cannot see.
 *
 * So these arms are NOT stale. Their subject (the notice) is gone; their FINDING
 * is live, and this file is the record of it. Deleting them would destroy the
 * evidence for a defect nobody has decided about yet, and leaving them RED is
 * what teaches a team to stop reading a check — which is how this red came to be
 * mislabelled "standing advisory drift" for a whole night.
 *
 * ⚠⚠ AND THE SENTENCE THAT STOOD HERE WAS FALSE, WHICH IS WHY IT IS QUOTED
 * RATHER THAN DELETED. It read: *"`test.fixme` is the honest third option: the
 * suite records the gap, names its owner, and goes red again the moment someone
 * restores a disclosure without updating what it asserts."* **A skipped test
 * notices nothing, ever.** `fixme` does not run, so it cannot red — I shipped a
 * guard that could not fail inside a paragraph arguing for honest guards, and a
 * review caught it. The arm below RUNS and asserts today's truth in both
 * directions instead.
 *
 * ⚠ UNPARK WHEN PAUL RULES, and the ruling is his because he asked for the
 * banner gone. Two shapes were put to him (programme docs #38, 9 Sep 01:41):
 *   1. FIX THE FRAMING — let the initial product fit go below 0.5 as "Fit to
 *      view" already does, and let `CanvasLodNotice` carry the legibility half.
 *      Then no disclosure is needed and these arms retire honestly.
 *   2. DISCLOSE IT DIFFERENTLY — `CanvasOverlayBand` reserves its 64px whether
 *      or not anything occupies it, so a new form costs no vertical space.
 * Under (1) delete these arms with the ruling cited. Under (2) re-point them at
 * whatever discloses it.
 *
 * WHY THIS EXISTS. Measured 30 Aug 2026 in Chromium at 1280x800: on
 * `build-vs-buy` SIX of twenty nodes are entirely outside the pane on first
 * view — including the DECISION NODE, the goal and all three risks — because
 * the auto-fit clamps at the 0.50 legibility floor and then centres. A tester
 * opening that starter alone sees a view that does not contain the decision,
 * and nothing on screen says so.
 *
 * WHAT THIS PINS, and the second one is the point:
 *  1. The notice APPEARS when part of the model is out of view, and states the
 *     remainder rather than fading.
 *  2. Its button ACTUALLY WORKS — after clicking, every node is inside the
 *     pane and the notice removes itself. A control that cannot do what it says
 *     is the defect class this product cleaned up on 29 Aug; this asserts the
 *     outcome, never the click.
 *  3. It STAYS AWAY when the whole model already fits — otherwise it is noise
 *     on every screen, and a notice that always shows says nothing.
 */
import { test, expect, type Page } from '@playwright/test'
import {
  preparePage, openCanvas, seedStarterDraft, clearNotifications,
  freezeMotion, waitForVisualQuiescence, VIEWPORTS,
} from './harness'
import { GHOST_ID_PREFIX } from '../../src/canvas/utils/fitTargets'

/**
 * Wait until the camera transform stops changing.
 *
 * `waitForVisualQuiescence` watches the LAYOUT store, which is silent about the
 * camera — so it returns while a 400ms fit animation is still in flight, and a
 * measurement taken then reports nodes outside the pane that are on their way
 * in. That is a false RED that looks exactly like a dead control.
 */
async function waitForCameraSettled(page: Page, timeoutMs = 5000): Promise<void> {
  await page.waitForFunction(
    () => {
      const vp = document.querySelector('.react-flow__viewport') as HTMLElement | null
      if (!vp) return false
      const w = window as unknown as { __lastTf?: string; __tfStableFrames?: number }
      const tf = getComputedStyle(vp).transform
      if (w.__lastTf === tf) { w.__tfStableFrames = (w.__tfStableFrames ?? 0) + 1 }
      else { w.__lastTf = tf; w.__tfStableFrames = 0 }
      return (w.__tfStableFrames ?? 0) >= 5
    },
    undefined,
    { timeout: timeoutMs, polling: 50 },
  )
}

/**
 * Nodes wholly inside the pane, and the total, read from the live DOM.
 *
 * ⚠ THE MODEL, NOT EVERY MOUNTED NODE — AND THIS SPEC WAS THE ONLY PLACE THAT
 * DISAGREED. Three things answer "what is the model?": the notice's own count,
 * `showAll`'s fit target, and this measurement. The first two both resolve to
 * `excludeNonModelNodes`; this one counted `.react-flow__node` wholesale. So
 * once the frontier affordance reached the factor, risk and outcome tiers, the
 * button framed the model — correctly — while this asserted that the
 * *invitations to extend it* should have been framed too, and reported the
 * difference as nodes left outside the pane.
 *
 * Filtered by the product's own `GHOST_ID_PREFIX` rather than a fourth literal:
 * a filter that restates the ids it filters is the drift this whole PR removes.
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

test.describe('the first view does not disclose its own extent — a live, undisclosed defect', () => {
  /**
   * ⛔⛔ THIS ARM ASSERTS THE DEFECT, ON PURPOSE, AND IT MUST STAY RED-CAPABLE.
   *
   * ⚠ IT REPLACES TWO `test.fixme` ARMS I WROTE AN HOUR AGO, AND THE OBJECTION
   * THAT KILLED THEM IS THE ONE WORTH KEEPING: *"an unconditional test.fixme
   * cannot establish the framing property or detect its return."* Exactly so —
   * `fixme` never runs, so it can never go red. My own header claimed the
   * opposite ("goes red again the moment someone restores a disclosure"), which
   * was simply false: a skipped test notices nothing, ever. That is the
   * guard-that-cannot-fail this repo hunts, and I shipped one while writing a
   * paragraph about honesty.
   *
   * ── WHAT IT ASSERTS, AND WHY BOTH HALVES ─────────────────────────────────
   * The product's auto-fit floors at `LABEL_LEGIBLE_ZOOM` (0.5) and then
   * centres, so on `build-vs-buy` part of the model — including, when measured
   * on 30 Aug 2026, the DECISION NODE, the goal and all three risks — is
   * outside the pane on first view. #1340 removed the extent notice, which was
   * the only thing that said so. `CanvasLodNotice` fires BELOW 0.5 and the fit
   * lands AT it, so it is silent here; "Fit to view" is a recovery the user must
   * think to invoke, not a disclosure.
   *
   * So today's truth is: **the model overflows, and nothing tells the reader.**
   * This arm states both halves, which makes it red-capable in BOTH directions:
   *
   *   · fix the FRAMING (let the initial fit go below 0.5) → the overflow
   *     assertion REDs, and this file should then be retired with the ruling
   *     cited;
   *   · restore a DISCLOSURE → the silence assertion REDs, and this file should
   *     be re-pointed at whatever discloses it.
   *
   * Either way a person is required to decide, which is the whole reason not to
   * skip. ⚠ AND IT IS NOT A REQUEST TO KEEP THE DEFECT: it is a request that
   * removing it be deliberate. See programme docs #38 (9 Sep) for the two repair
   * shapes put to Paul, whose ruling this is — he asked for the banner gone
   * because it took space, not because he wanted to stop seeing his model.
   *
   * ── SECOND ARM DROPPED ───────────────────────────────────────────────────
   * `headcount-allocation: no notice when the model already fits` is removed
   * rather than parked: with no notice in the product at all, "no notice
   * appears" is true of every model in every state and cannot fail. An arm that
   * cannot go red is wall clock with no safety.
   */
  test('build-vs-buy overflows the first view, and nothing on screen says so', async ({ page }) => {
    await preparePage(page, VIEWPORTS[0])
    await openCanvas(page)
    await seedStarterDraft(page, 'build-vs-buy')
    await clearNotifications(page)
    await freezeMotion(page)
    await waitForVisualQuiescence(page)

    // ENVIRONMENT, asserted before any number is believed. A hidden tab
    // measures 0x0 and every result below would be a lie that looks fine.
    const view = await nodeVisibility(page)
    expect(view.hidden, 'document.hidden — a hidden tab measures 0x0 and every result is void').toBe(false)
    expect(view.paneOk, 'the canvas pane has no size — nothing was measured').toBe(true)
    expect(view.total, 'no nodes mounted').toBeGreaterThan(0)

    // HALF ONE — the defect. REDs if the framing is fixed, which is the good
    // outcome and must not pass silently.
    expect(
      view.fullyVisible,
      `build-vs-buy now fits its first view (${view.fullyVisible}/${view.total} fully visible). ` +
        'If the auto-fit floor was lifted deliberately, retire this file and cite the ruling.',
    ).toBeLessThan(view.total)

    // HALF TWO — the silence. REDs if any disclosure returns.
    await expect(
      page.getByTestId('model-extent-notice'),
      'a disclosure is back on screen — re-point this file at it rather than deleting the record',
    ).toHaveCount(0)
  })
})
