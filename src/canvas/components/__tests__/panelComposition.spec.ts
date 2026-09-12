import { describe, expect, it, vi } from 'vitest'
import { CANONICAL_LAYOUT_WIDTH } from '../../utils/nodeLayoutConstants'
import {
  FLOATING_OLUMI_SIDE_TAB_WIDTH,
  MIN_USABLE_MODEL_VIEWPORT_WIDTH,
  listenForFloatingOlumiRequests,
  needsSingleExpandedPanel,
  requestFloatingOlumiSurface,
} from '../panelComposition'

describe('panel composition usable-canvas contract', () => {
  /**
   * ⛔⛔ 1600 FLIPPED false -> true ON 12 Sep 2026, AND IT IS A REAL BEHAVIOUR
   * CHANGE FOR A USER, NOT A MIRROR TO UPDATE.
   *
   * `MIN_USABLE_MODEL_VIEWPORT_WIDTH` is DERIVED from `CANONICAL_LAYOUT_WIDTH`,
   * which moved 1185 -> 1482 to stop three shipped starters laying out PORTRAIT
   * in a LANDSCAPE pane. The threshold moved with it, 641 -> 789, silently and
   * correctly — nothing announced itself, because that is what a derived
   * constant does.
   *
   *   usable(1600) = 1600 - 428 (dock) - 400 (panel) - 36 (side tab) - 16 (gap)
   *                = 720, against a threshold of 789
   *
   * CONSEQUENCE, stated plainly: on a viewport between 1600 and 1668 with the
   * Outputs dock expanded, the product now collapses one of the two thinking
   * surfaces — opening Outputs minimises floating Olumi, and vice versa. Above
   * 1668 nothing changes; at 1512 and below it was already constrained. So the
   * newly-affected band is 1600-1668, and 1600 is a common external-monitor
   * width.
   *
   * ⭐ HOW THIS WAS FOUND, because it is the more useful half: a HAND-WRITTEN
   * CORPUS ROW caught it — this literal `1600`. Every derived guard in the
   * layout change agreed with itself all the way through, exactly as CLAUDE.md
   * trap 12d says they must: derivation stops consumers drifting, and only a
   * corpus notices the VALUE is now wrong. `layoutViewportIndependence.guard`
   * sweeps 1280/1440/1512/1920 and does not contain 1600 at all — it was
   * pointed at a width set that skips the width where the behaviour turns.
   *
   * ⚠ AND THE OPEN QUESTION THIS CHANGE DID NOT SETTLE, rowed rather than
   * decided here because it belongs to this module and not to the layout lane:
   * `MIN_USABLE_MODEL_VIEWPORT_WIDTH` uses the PACKING BUDGET as a stand-in for
   * the model's RENDERED WIDTH, and those are different quantities — the
   * shipped starters lay out 1904-3080 units wide, never 1482. More importantly
   * Founder Ruling R1 says the answer to a constrained screen is a readable
   * SUBSET with an explicit "showing X of Y", never that the whole model must
   * fit. A threshold that demands the whole canonical model fit before allowing
   * two panels is arguably asking the wrong question. Changing it is a product
   * decision and needs a ruling.
   */
  it.each([
    [1280, 428, true],
    [1440, 428, true],
    [1512, 428, true],
    [1600, 428, true],
    [1669, 428, false],
    [1920, 428, false],
  ])('viewport %i with dock inset %i => constrained=%s', (viewportWidth, dockInset, expected) => {
    expect(needsSingleExpandedPanel({
      viewportWidth,
      dockInset,
      floatingPanelWidth: 400,
      dockExpanded: true,
    })).toBe(expected)
  })

  it('collapsed Outputs leaves floating Olumi and the model unconstrained', () => {
    expect(needsSingleExpandedPanel({
      viewportWidth: 1280,
      dockInset: 52,
      floatingPanelWidth: 400,
      dockExpanded: false,
    })).toBe(false)
  })

  it('derives the minimum usable width from the canonical model and label floor', () => {
    // ⚠ 641 -> 789 (12 Sep 2026), from `CANONICAL_LAYOUT_WIDTH` 1185 -> 1482.
    // The literal stays a literal ON PURPOSE. Deriving it from the same
    // expression the module uses would make this a guard agreeing with itself
    // (trap 13b) — and this pin is the ONLY thing in the suite that noticed the
    // threshold had moved at all.
    expect(MIN_USABLE_MODEL_VIEWPORT_WIDTH).toBe(789)
  })

  it('⛔⛔ THE TRADE IS UNAVOIDABLE — NO BUDGET BOTH FIXES THE PORTRAIT LAYOUT AND KEEPS 1600', () => {
    /**
     * ⭐⭐ THE ASSERTION THAT TURNS THIS FROM A TUNING QUESTION INTO A RULING.
     *
     * The obvious reviewer question is "could a smaller budget have avoided the
     * 1600 cost?" — so it is answered by derivation rather than by opinion, and
     * pinned here so nobody has to re-derive it or, worse, re-litigate it from
     * memory. The two requirements are:
     *
     *   TO FIX THE PORTRAIT LAYOUT, an eight-wide tier must single-row:
     *       B >= (FAIR + PAD + MIN_GAP) * 8 - MIN_GAP  =  1417
     *
     *   TO KEEP A 1600 VIEWPORT HOLDING BOTH PANELS:
     *       ceil(B * LABEL_LEGIBLE_ZOOM) + 2*CANVAS_MARGIN <= usable(1600) = 720
     *       B <= 1344
     *
     * 1417 > 1344, so the intersection is EMPTY. Whatever the budget is set to,
     * the product either leaves three shipped starters laying out portrait in a
     * landscape pane, or it costs a 1600-1668 viewport its second panel. It
     * cannot do neither.
     *
     * ⚠ THIS TEST DOES NOT SAY THE CHOSEN SIDE IS RIGHT. It says the choice is
     * real and forced. If a future change makes it unforced — by decoupling
     * this threshold from the packing budget, which the note above argues it
     * should be — this test SHOULD go red, and that red is the good news.
     */
    const CANVAS_MARGIN = 24
    const LABEL_LEGIBLE_ZOOM_LOCAL = 0.5
    const usableAt1600 = 1600 - 428 - 400 - FLOATING_OLUMI_SIDE_TAB_WIDTH - 16

    const budgetNeededForLandscape = (140 + 24 + 15) * 8 - 15
    const budgetAffordableAt1600 =
      2 * (usableAt1600 - 2 * CANVAS_MARGIN) / (2 * LABEL_LEGIBLE_ZOOM_LOCAL)

    expect(budgetNeededForLandscape).toBe(1417)
    expect(budgetAffordableAt1600).toBe(1344)
    expect(
      budgetNeededForLandscape,
      'a budget satisfying both appeared — the trade is no longer forced, so re-open the decision',
    ).toBeGreaterThan(budgetAffordableAt1600)

    // …and the shipped budget is on the landscape side of it, deliberately.
    expect(CANONICAL_LAYOUT_WIDTH).toBeGreaterThanOrEqual(budgetNeededForLandscape)
  })

  it('⛔ THE NEWLY-CONSTRAINED BAND IS BOUNDED, so the cost is a range and not a vibe', () => {
    /**
     * Pins BOTH edges of what this change took away. Without the upper edge,
     * "1600 is now constrained" is consistent with every viewport being
     * constrained, and the cost could grow without anything going red.
     */
    const constrainedAt = (viewportWidth: number) =>
      needsSingleExpandedPanel({ viewportWidth, dockInset: 428, floatingPanelWidth: 400, dockExpanded: true })

    expect(constrainedAt(1668), 'the top of the newly-affected band').toBe(true)
    expect(constrainedAt(1669), 'immediately above it, unchanged from before').toBe(false)
    // …and the band really is NEW: at the previous threshold of 641 both were free.
    expect(1668 - 428 - 400 - 36 - 16).toBeGreaterThanOrEqual(641)
  })

  it('lets the shell sequence a constrained floating reveal', () => {
    const reveal = vi.fn()
    const stop = listenForFloatingOlumiRequests((deferredReveal) => {
      expect(deferredReveal).toBe(reveal)
      deferredReveal()
      return true
    })
    requestFloatingOlumiSurface(reveal)
    expect(reveal).toHaveBeenCalledTimes(1)
    stop()
  })

  it('reveals immediately when no shell claims the request', () => {
    const reveal = vi.fn()
    requestFloatingOlumiSurface(reveal)
    expect(reveal).toHaveBeenCalledTimes(1)
  })
})
