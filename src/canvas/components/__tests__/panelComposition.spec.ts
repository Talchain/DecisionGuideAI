import { describe, expect, it, vi } from 'vitest'
import {
  CANONICAL_LAYOUT_WIDTH,
  CANVAS_MARGIN,
} from '../../utils/nodeLayoutConstants'
import { balancedRowSizes } from '../../utils/layout'
import { LABEL_LEGIBLE_ZOOM } from '../../utils/zoomLegibility'
import { COMFORT_OCCLUSION_GAP } from '../../utils/cameraComfort'
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

  it('⭐ S4 DISSOLVES THE FORCED TRADE: the budget no longer decides the packing, so 1600 is constrained by choice, not by the layout', () => {
    /**
     * ⭐⭐ THIS TEST USED TO PROVE THE TRADE WAS UNAVOIDABLE, AND ITS OWN MESSAGE
     * SAID WHAT TO DO IF THAT STOPPED BEING TRUE: "the trade is no longer
     * forced, so re-open the decision". S4 is that moment.
     *
     * The argument was: an eight-wide tier stays landscape (one row) only at a
     * budget ≥ 1417, and `MIN_USABLE_MODEL_VIEWPORT_WIDTH` is a function of the
     * budget, so no budget could both fix the portrait layout and keep 1600
     * unconstrained. Experience Design then replaced the packing policy
     * (#63 5806207128: "Rows above 5 cards wrap into balanced sub-rows … 8→4+4")
     * — the packing is now a COUNT, and no budget value changes it. So the
     * landscape half of the trade no longer depends on the budget at all.
     *
     * ⚠ WHAT THIS DOES NOT DO: it changes NO panel behaviour. The threshold is
     * still derived from the (unchanged) budget, so 1600 stays constrained. The
     * DECISION to keep it so is now a choice for the Panel lane to re-open, not
     * a consequence of the layout — which is what this test now records.
     */

    // ── 1. THE COUPLING ITSELF, still asserted: the threshold is a FUNCTION OF
    // THE BUDGET, so if it is ever decoupled this line goes red.
    const minUsableAtBudget = (budget: number) =>
      Math.ceil(budget * LABEL_LEGIBLE_ZOOM) + 2 * CANVAS_MARGIN
    expect(
      MIN_USABLE_MODEL_VIEWPORT_WIDTH,
      'the threshold is no longer a function of the canonical budget — re-open the decision',
    ).toBe(minUsableAtBudget(CANONICAL_LAYOUT_WIDTH))

    // ── 2. THE PACKING NO LONGER READS THE BUDGET: an eight-wide tier wraps the
    // same way whatever the budget is (the function takes a count, not a width).
    expect(balancedRowSizes(8)).toEqual([4, 4])

    // ── 3. 1600 is STILL constrained today — unchanged by S4, through the REAL
    // predicate — so nothing shipped here moved a panel.
    const constrainedAt1600 = needsSingleExpandedPanel({
      viewportWidth: 1600, dockInset: 428, floatingPanelWidth: 400, dockExpanded: true,
    })
    expect(constrainedAt1600, 'S4 changed panel behaviour, which it must not').toBe(true)
    const usableAt1600 = 1600 - 428 - 400 - FLOATING_OLUMI_SIDE_TAB_WIDTH - COMFORT_OCCLUSION_GAP
    expect(minUsableAtBudget(CANONICAL_LAYOUT_WIDTH)).toBeGreaterThan(usableAt1600)
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
