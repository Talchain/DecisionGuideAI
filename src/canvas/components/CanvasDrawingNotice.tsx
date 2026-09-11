/**
 * ⭐⭐ THE CANVAS SAYS IT IS DRAWING, INSTEAD OF LOOKING BROKEN.
 *
 * ── THE DEFECT, AND IT IS ALREADY MEASURED IN THIS DIRECTORY ───────────────
 * `ModelExtentNotice.tsx` records 18 timed runs on the Playwright geometry
 * harness against deployed staging `f59ffc26`, real geometry:
 *
 *     t=    0ms  zoom=4    lv=0  pending=true
 *     t= 3005ms  zoom=0.5  lv=2  pending=false
 *
 * with heal times spanning **1.05s to 17.0s**, and **18/18 runs passing
 * through the unsettled state**. Until the layout pipeline settles the nodes
 * have not been measured, React Flow holds every node at `visibility: hidden`,
 * and the canvas is BLANK.
 *
 * That notice handles its own half correctly: it SUPPRESSES its count in that
 * window, because "Showing 0 of 18 elements" is a false sentence about a
 * camera that is briefly nonsense. Its header states the direction — *"silence
 * while the product is still drawing says nothing untrue"*.
 *
 * ⭐ SILENCE IS THE RIGHT ANSWER FOR A COUNT AND THE WRONG ANSWER FOR THE
 * PRODUCT. It leaves a user looking at an empty canvas for up to seventeen
 * seconds with nothing on screen to distinguish "drawing" from "broken" — and
 * that is not a hypothesis. It is the founder's own report, verbatim, 11 Sep
 * 2026: *"No graph is being displayed at all at the moment. I think there may
 * be something broken behind it."*
 *
 * For a product whose whole value is a shared visual model, the first two
 * seconds of a shared link deciding whether the reader thinks it is broken is
 * not a polish item.
 *
 * ── WHY A SENTENCE AND NOT A FIX FOR THE 17 SECONDS ────────────────────────
 * ⚠ Because the 1s-17s spread is, in that header's own words, *"measured but
 * NOT explained"*. Nothing here may depend on a bound for it, and an unexplained
 * performance spread is a separate investigation, not a caveat's job. This is
 * the honest interim and it follows the estate's standing ruling (Paul,
 * 29 Aug 2026): **no hiding, no workarounds, caveat instead.**
 *
 * ⛔ IT IS A DISCLOSURE AND CARRIES NO CONTROL, DELIBERATELY. There is no act
 * a user can take that makes the layout settle sooner, and `ModelExtentNotice`
 * already states the rule this follows: *"a count must only include what its
 * remedy can fix"*. A button here would be an affordance that does nothing —
 * the exact defect the Reasoning tab's controls were built to stop.
 *
 * ⛔ AND NOT A SPINNER. A spinner claims progress is being made; nothing here
 * measures progress in either direction. The sentence claims only what is true:
 * the product is drawing, and the user is not looking at their whole model yet.
 *
 * ── ⚠ NAMED APART FROM READINESS, NEVER COLLAPSED (CLAUDE.md trap 21) ──────
 * The Reasoning tab already says *"Your model changed since the last check.
 * Olumi is checking again, which takes a moment."* That is the CEE readiness
 * round-trip and it answers *"is this model analysable?"*. This answers a
 * DIFFERENT question — *"why is the canvas blank?"* — about a purely local
 * layout pipeline that never leaves the browser. The two are independent: a
 * model can be drawing while ready, and ready while drawn. Reconciling them
 * would be the estate's signature defect, so they are stated apart on purpose.
 *
 * ── THE INVARIANT WITH `ModelExtentNotice`, AND WHY IT CANNOT DRIFT ────────
 * ⭐⭐ THE TWO ARE EXACT COMPLEMENTS ON ONE BOOLEAN. That notice renders only
 * when `!layoutUnsettled`; this one renders only when `layoutUnsettled`. The
 * predicate is READ FROM THE SAME STORE FIELDS in the same shape
 * (`pendingLayout || layoutInProgress`) rather than re-derived, so there is no
 * second rule to keep in step — a change to one is a change to both.
 *
 * That gives the guard something real to bind to, which a caveat of this kind
 * usually cannot offer: on a non-empty model, **exactly one of the two speaks
 * in every layout state**. The spec pins both directions, because a guard that
 * only proves this one appears would pass just as happily if the extent notice
 * had started appearing beside it.
 *
 * ⚠ THE NON-EMPTY GATE IS NOT DEFENSIVE DECORATION. A genuinely empty canvas
 * has nothing to draw, and telling a user their nothing is being drawn is a
 * false claim with a friendly face. The population is counted with
 * `excludeNonModelNodes` — the SAME helper the extent notice totals with — so
 * the two cannot disagree about what a model contains. Ghost tier prompts are
 * scaffolding, not the user's model, and they are excluded by that helper.
 */
import { useCanvasStore } from '../store'
import { excludeNonModelNodes } from '../utils/fitTargets'
import { typography } from '../../styles/typography'
import { useOverlayCell } from './CanvasOverlayBand'
import { createPortal } from 'react-dom'

/**
 * ⚠ THE SENTENCE IS DELIBERATELY NOT EXPORTED, for the reason this estate
 * applies to every other copy constant: a spec that asserted the render against
 * the constant it renders would agree with itself whatever the constant said
 * (CLAUDE.md trap 13b). The spec spells it out.
 */
const DRAWING_NOTICE = 'Drawing your model…'

export function CanvasDrawingNotice() {
  /**
   * ⚠ TWO PRIMITIVE SELECTORS COMBINED IN THE SELECTOR, not a selector
   * returning an object — an object allocates a new reference on every store
   * update and would re-render this on every unrelated change. A boolean
   * compares by value. `ModelExtentNotice` reads the same pair the same way.
   */
  const layoutUnsettled = useCanvasStore((s) => s.pendingLayout || s.layoutInProgress)

  /**
   * ⚠ COUNTED, NOT CACHED IN A `useMemo`. The result is a NUMBER compared to
   * zero, so there is no reference to stabilise and memoising it would buy
   * nothing while adding a dependency array to keep correct.
   */
  const hasModel = useCanvasStore((s) => excludeNonModelNodes(s.nodes ?? []).length > 0)

  const wants = layoutUnsettled && hasModel
  const { granted, target } = useOverlayCell('bottom-centre', 'canvas-drawing-notice', wants)

  if (!wants || !granted) return null

  /**
   * ⚠ `aria-live="polite"`, never assertive. This resolves itself; interrupting
   * a screen-reader user mid-sentence for something that goes away on its own
   * would be worse than the silence it replaces.
   *
   * ⚠ AND `pointer-events-auto` ON A NOTICE THAT HAS NOTHING TO CLICK — which is
   * deliberate rather than copied from a sibling. The band and all three cells
   * set `pointer-events: none` and the property INHERITS, so every occupant must
   * re-enable it or its controls are dead; `overlayOwner.sourceScan.spec.ts`
   * asserts exactly that across the whole occupant set. The guard is written as
   * a blanket rather than "only occupants with buttons", which is the right
   * shape: this notice has no control TODAY, and on the day one is added a
   * narrower guard would have been silent about it.
   *
   * It costs nothing here. The band reserves a fixed strip that
   * `computeFitPadding` guarantees the graph is never fitted underneath, so
   * there is no node behind this rectangle for it to take a gesture from.
   */
  const body = (
    <div
      data-testid="canvas-drawing-notice"
      aria-live="polite"
      className="pointer-events-auto flex items-center rounded-lg border
                 border-panel-border bg-panel shadow-1 px-3 py-2"
    >
      <span className={`${typography.caption} text-text-body`}>{DRAWING_NOTICE}</span>
    </div>
  )

  return target ? createPortal(body, target) : body
}
