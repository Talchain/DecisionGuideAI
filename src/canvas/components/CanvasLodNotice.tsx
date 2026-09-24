/**
 * CanvasLodNotice — say so when the canvas has stopped rendering labels.
 *
 * ── THE MEASUREMENT THIS EXISTS FOR ────────────────────────────────────────
 * Real Chromium, the product's own "Customer Data Platform Selection" example
 * (19 nodes), clicking the real "Fit to view" control, 2026-08-11:
 *
 *   viewport      fit zoom   node titles hidden   LOD   disclosed?
 *   1920x1080      0.802          0 / 19          off      —
 *   1440x900       0.668          0 / 19          off      —
 *   1280x800       0.595          0 / 19          off      —
 *   1024x768       0.543          0 / 19          off      —
 *   834x1112       0.344         17 / 19          ON      **no**
 *
 * At a narrow canvas, "Fit to view" lands at 0.344 — well under
 * `LABEL_LEGIBLE_ZOOM` — and hides 17 of 19 node titles and 86 of 89 text
 * elements. That reproduces the reported "18 of 20 node labels blank" almost
 * exactly, and it explains why the finding looked intermittent: it is
 * VIEWPORT-CONDITIONAL, not build-conditional. A user on a laptop with the AI
 * panel and inspector open has the same narrow canvas as the 834px column here.
 *
 * ── WHAT THIS DOES *NOT* DO, AND WHY ───────────────────────────────────────
 * It does NOT clamp the fit. `src/canvas/utils/zoomLegibility.ts` carries a
 * reasoned, dated doctrine that explicit user gestures stay unfloored, and that
 * below the floor "the level-of-detail view is the honest, intended rendering:
 * structure without labels". That doctrine is right: flooring "fit to view"
 * would crop the model the user just asked to see whole, which is a worse lie
 * than hiding labels. Overturning it was not this lane's to do.
 *
 * The defect is the word the doctrine already used and the product never
 * delivered: **honest**. A screen of blank rectangles that says nothing is
 * indistinguishable from a broken render, and the measurement above shows the
 * product disclosed the state at 0 of 5 viewports. So this component says which
 * one you are looking at, and offers the way back.
 *
 * It renders from the SAME store rung the nodes blank themselves on, through the
 * SAME exported selector (`selectLodBodyHidden`, over the `lodRung` written by
 * `LodSync` from the live viewport transform), so the notice cannot claim a
 * state the nodes are not in — derive, don't mirror.
 *
 * ⚠ THE SELECTOR IS SHARED ON PURPOSE, AND THE SPLIT INTO RUNGS IS WHY. While
 * level-of-detail was a boolean there was only one thing either surface could
 * read. With three rungs there are two plausible predicates — "is the body
 * hidden?" and "is the canvas simplified at all?" — and this notice must answer
 * the FIRST, because its copy is a claim about the cards. Reading the rung and
 * testing it here would be a second predicate wearing the same name (trap 21).
 */
import { ZoomIn, Focus } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useReactFlow } from '@xyflow/react'
import { useOverlayCell } from './CanvasOverlayBand'
import { useCanvasStore } from '../store'
import { LABEL_LEGIBLE_ZOOM, selectLodBodyHidden, selectLensDetailActive } from '../utils/zoomLegibility'
import { cameraDuration } from '../utils/cameraMotion'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import { typography } from '../../styles/typography'

export const CANVAS_LOD_NOTICE_TESTID = 'canvas-lod-notice'

/**
 * The copy. Stated as the fact it is — the labels are hidden, and why — with no
 * apology and no claim about what the user should have done. "Zoomed out too far
 * to show labels" is true at exactly the moment the body is hidden, because that
 * rung IS `zoom < LABEL_LEGIBLE_ZOOM`.
 */
/**
 * ⚠⚠ THIS SENTENCE HAS NOW BEEN FALSE TWICE, IN THE SAME WAY, AND THE PATTERN
 * IS THE POINT.
 *
 * v1 — "Zoomed out too far to show labels" — described a state where titles
 * rendered `visibility: hidden`. On 30 Aug titles stopped hiding, and the
 * comment above this one was written to correct it.
 *
 * v2 — "showing titles only" — was true for exactly one day. Cards now keep a
 * reduced metric line below the floor (`shared/lodMetricLine.ts`), so the
 * product was standing on the canvas announcing "titles only" directly above
 * six cards reading `Influence 100%`. **Caught by LOOKING at deployed
 * `30bd7f8c`. No test could see it: every one of them pins the constant, and a
 * constant agrees with itself.**
 *
 * ⭐ THE RULE THIS EARNS: copy that ENUMERATES what is on screen goes stale
 * every time the screen changes, and the correcting sentence is written by the
 * same head in the same sitting, so it inherits the same blind spot. v3 states
 * the DIRECTION rather than the inventory — "less on each card" stays true
 * whether a card shows a title, a title and a figure, or a title and a glyph,
 * and it stops being true only if the ladder is removed entirely. Do not
 * "improve" it back into a list of what is showing.
 */
export const CANVAS_LOD_NOTICE_COPY = 'Zoomed out — showing less on each card'
export const CANVAS_LOD_NOTICE_ACTION = 'Zoom in for detail'

/**
 * ⭐ THE SECOND CAUSE, AND IT NEEDED ITS OWN SENTENCE RATHER THAN A SHARED ONE.
 *
 * At the `quiet` rung a card the active lens set aside now shows less
 * (`selectLensDetailActive`). The user has NOT zoomed out — they asked a
 * question — so the existing sentence would be false about the cause and the
 * existing button would be false about the remedy.
 *
 * ⛔ AND THE BUTTON IS DELIBERATELY ABSENT HERE, not restyled. Its handler
 * early-returns on `vp.zoom >= LABEL_LEGIBLE_ZOOM`, which is ALWAYS true at
 * `quiet` — so offering it would be a control that is truthful about the state
 * and cannot execute, which this estate has already shipped once. The cause is
 * named instead, because the remedy (clear or change the lens) lives on the lens
 * control, not here.
 */
export const CANVAS_LENS_DETAIL_NOTICE_COPY = 'Showing less on cards this lens set aside'

export function CanvasLodNotice() {
  const lodBodyHidden = useCanvasStore(selectLodBodyHidden)
  /**
   * ⚠ THE SAME SHARED SELECTOR `BaseNode` CONSUMES — never a second reading of
   * the rung or of the lens. A notice with its own predicate can claim a state
   * the nodes are not in; that is why `selectLodBodyHidden` exists as a function
   * and why this one does too.
   */
  const lensDetailActive = useCanvasStore(selectLensDetailActive)
  const { getViewport, setViewport } = useReactFlow()
  const prefersReducedMotion = usePrefersReducedMotion()
  // The cell decides WHERE this draws and whether it draws at all when a
  // higher-priority occupant holds bottom-centre. `lodBodyHidden` is this
  // component's own condition — the semantic-zoom ladder's own selector over
  // `lodRung` (#1159), NOT a second reading of the rung — and it is passed as
  // `wants` rather than returned on early, so a notice with nothing to say
  // never holds the slot shut against one that has.
  const wants = lodBodyHidden || lensDetailActive
  const { granted, target } = useOverlayCell('bottom-centre', CANVAS_LOD_NOTICE_TESTID, wants)

  if (!wants || !granted) return null

  // `lodBodyHidden` wins when both hold: below the floor EVERY card is reduced,
  // which is the larger, truer statement, and zooming in is then a real remedy.
  const lensCause = !lodBodyHidden && lensDetailActive

  const body = (
    <div
      data-testid={CANVAS_LOD_NOTICE_TESTID}
      role="status"
      aria-live="polite"
      // contract v3.1 CHR-6: the cell's one floating-chrome recipe — warm DS
      // `shadow-2`, not Tailwind's cool `shadow-sm`. Pill radius and
      // `panelMeta` are this cell's one-line grammar and stay.
      className="pointer-events-auto flex items-center gap-2 rounded-full border border-panel-border bg-panel px-3 py-1.5 shadow-2"
    >
      {/* ⚠ THE ICON IS PART OF THE SENTENCE. A magnifier beside "this lens set
          aside" would name zoom as the cause, which is the same false claim the
          copy above avoids — one channel, two meanings. */}
      {lensCause
        ? <Focus className="h-3.5 w-3.5 flex-none text-text-light" aria-hidden="true" />
        : <ZoomIn className="h-3.5 w-3.5 flex-none text-text-light" aria-hidden="true" />}
      <span className={`${typography.panelMeta} text-text-body`}>
        {lensCause ? CANVAS_LENS_DETAIL_NOTICE_COPY : CANVAS_LOD_NOTICE_COPY}
      </span>
      {lensCause ? null : <button
        type="button"
        data-testid={`${CANVAS_LOD_NOTICE_TESTID}-action`}
        onClick={() => {
          // ⭐⭐ LAND ON THE LEGIBILITY FLOOR, A FULL NOTCH CLEAR OF THE CLIFF.
          //
          // The remedy set the viewport to the boundary value EXACTLY, so a user
          // who pressed "Zoom in for detail" got detail and zero margin: one
          // wheel notch, one trackpad nudge, or one press of the toolbar's
          // zoom-out (÷1.2) put the whole board straight back. A remedy that
          // leaves you one gesture from the problem is not a remedy.
          //
          // ⛔ AN EARLIER VERSION OF THIS WROTE `Math.max(LABEL_LEGIBLE_ZOOM,
          // LOD_BODY_RESTORED_ZOOM)` and claimed it overshot the cliff. Review
          // proved it a NO-OP by execution: the re-entry point is 0.45 and the
          // legibility floor is 0.5, so the max is always the floor. The comment
          // asserted a behaviour the code did not have — corrected rather than
          // deleted, because a confident comment over an inert line is how the
          // next reader inherits a false model (trap 14).
          //
          // Landing on `LABEL_LEGIBLE_ZOOM` IS the right target now, and for a
          // reason that only holds since the cliff moved: at 0.5 the
          // counter-scale is at full compensation and body text is at its
          // declared size, and the cliff is a whole toolbar notch below at
          // 0.41667. The remedy leaves the user inside the band with real
          // travel, which is exactly what it failed to do when the cliff and the
          // floor were the same number.
          const vp = getViewport()
          if (vp.zoom >= LABEL_LEGIBLE_ZOOM) return
          const el = document.querySelector('.react-flow') as HTMLElement | null
          const w = el?.clientWidth ?? 0
          const h = el?.clientHeight ?? 0
          const target = LABEL_LEGIBLE_ZOOM
          const scale = target / vp.zoom
          setViewport(
            {
              zoom: target,
              x: w / 2 - (w / 2 - vp.x) * scale,
              y: h / 2 - (h / 2 - vp.y) * scale,
            },
            { duration: cameraDuration(300, prefersReducedMotion) },
          )
        }}
        className={`${typography.panelMeta} rounded text-info underline hover:text-text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info`}
      >
        {CANVAS_LOD_NOTICE_ACTION}
      </button>}
    </div>
  )

  // No band (a standalone render, which is how this component's own spec
  // mounts it) means no portal target — draw inline, exactly as before.
  return target ? createPortal(body, target) : body
}
