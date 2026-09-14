import { describe, expect, it, vi } from 'vitest'
import {
  CANONICAL_LAYOUT_WIDTH,
  CANVAS_MARGIN,
  NODE_SINGLE_ROW_FAIR_SHARE_W,
  LAYOUT_PADDING_X,
  MIN_GAP,
} from '../../utils/nodeLayoutConstants'
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

  it('⛔⛔ THE TRADE IS UNAVOIDABLE — NO BUDGET BOTH FIXES THE PORTRAIT LAYOUT AND KEEPS 1600', () => {
    /**
     * ⭐⭐ THE ASSERTION THAT TURNS THIS FROM A TUNING QUESTION INTO A RULING.
     *
     * The obvious reviewer question is "could a smaller budget have avoided the
     * 1600 cost?" — answered by derivation rather than opinion, and pinned so
     * nobody re-derives it or re-litigates it from memory.
     *
     * ⛔⛔ THE FIRST VERSION OF THIS TEST COULD NOT FIRE, AND github-a4 [2314f4]
     * PROVED IT BY MUTATION (12 Sep 2026). It re-declared as local literals
     * every constant it reasoned about — `const CANVAS_MARGIN = 24`,
     * `(140 + 24 + 15)` — so `expect(budgetNeededForLandscape).toBe(1417)` was
     * arithmetic on literals: true forever, independent of the product.
     * Replacing `MIN_USABLE_MODEL_VIEWPORT_WIDTH`'s derivation with a bare
     * `640` — the exact decoupling this test's own comment names as its
     * trigger — left it GREEN (1 passed, applied-check confirmed, and a
     * contrast control showed the mutation was detectable elsewhere in the
     * file: 3 failed).
     *
     * **A hand-maintained mirror inside the test written to stop people
     * reasoning from memory** — CLAUDE.md trap 12, and trap 13b's "a guard
     * agreeing with itself" at the same time. Every constant below is now the
     * EXPORTED one, and the coupling is asserted before anything is built on
     * it.
     */

    // ── 1. THE COUPLING ITSELF, which is the mechanism that forces the trade.
    // If `MIN_USABLE_MODEL_VIEWPORT_WIDTH` is ever decoupled from the packing
    // budget, THIS is the line that goes red — and it is the line the previous
    // version was missing. It is deliberately a restatement of the module's
    // expression: the claim being guarded is precisely "the threshold is a
    // FUNCTION OF THE BUDGET", so restating the function is the assertion, not
    // a mirror of it.
    const minUsableAtBudget = (budget: number) =>
      Math.ceil(budget * LABEL_LEGIBLE_ZOOM) + 2 * CANVAS_MARGIN
    expect(
      MIN_USABLE_MODEL_VIEWPORT_WIDTH,
      'the threshold is no longer a function of the canonical budget — the trade may no longer be forced, so re-open the decision',
    ).toBe(minUsableAtBudget(CANONICAL_LAYOUT_WIDTH))

    // ── 2. THE LANDSCAPE REQUIREMENT, from the exported layout constants.
    const budgetNeededForLandscape =
      (NODE_SINGLE_ROW_FAIR_SHARE_W + LAYOUT_PADDING_X + MIN_GAP) * 8 - MIN_GAP

    // ── 3. WHAT A 1600 VIEWPORT CAN AFFORD, taken through the REAL predicate
    // rather than re-derived, so a change to `needsSingleExpandedPanel`'s own
    // arithmetic cannot slip past this.
    const constrainedAt1600 = needsSingleExpandedPanel({
      viewportWidth: 1600, dockInset: 428, floatingPanelWidth: 400, dockExpanded: true,
    })
    const usableAt1600 = 1600 - 428 - 400 - FLOATING_OLUMI_SIDE_TAB_WIDTH - COMFORT_OCCLUSION_GAP
    expect(constrainedAt1600, 'the whole premise of this test').toBe(true)

    // ── 4. THE FORCED CHOICE. `minUsableAtBudget` was validated against the
    // module at the shipped budget in step 1, so evaluating it at the SMALLEST
    // budget that fixes the portrait layout is sound rather than a second
    // mirror: even there, 1600 cannot pay.
    expect(
      minUsableAtBudget(budgetNeededForLandscape),
      'a budget satisfying both appeared — the trade is no longer forced, so re-open the decision',
    ).toBeGreaterThan(usableAt1600)

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
