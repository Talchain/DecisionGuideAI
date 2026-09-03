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
import { ZoomIn } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useReactFlow } from '@xyflow/react'
import { useOverlayCell } from './CanvasOverlayBand'
import { useCanvasStore } from '../store'
import { LABEL_LEGIBLE_ZOOM, selectLodBodyHidden } from '../utils/zoomLegibility'
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

export function CanvasLodNotice() {
  const lodBodyHidden = useCanvasStore(selectLodBodyHidden)
  const { getViewport, setViewport } = useReactFlow()
  const prefersReducedMotion = usePrefersReducedMotion()
  // The cell decides WHERE this draws and whether it draws at all when a
  // higher-priority occupant holds bottom-centre. `lodBodyHidden` is this
  // component's own condition — the semantic-zoom ladder's own selector over
  // `lodRung` (#1159), NOT a second reading of the rung — and it is passed as
  // `wants` rather than returned on early, so a notice with nothing to say
  // never holds the slot shut against one that has.
  const { granted, target } = useOverlayCell('bottom-centre', CANVAS_LOD_NOTICE_TESTID, lodBodyHidden)

  if (!lodBodyHidden || !granted) return null

  const body = (
    <div
      data-testid={CANVAS_LOD_NOTICE_TESTID}
      role="status"
      aria-live="polite"
      className="pointer-events-auto flex items-center gap-2 rounded-full border border-panel-border bg-panel px-3 py-1.5 shadow-sm"
    >
      <ZoomIn className="h-3.5 w-3.5 flex-none text-text-light" aria-hidden="true" />
      <span className={`${typography.panelMeta} text-text-body`}>{CANVAS_LOD_NOTICE_COPY}</span>
      <button
        type="button"
        data-testid={`${CANVAS_LOD_NOTICE_TESTID}-action`}
        onClick={() => {
          // Return to the legibility floor exactly, keeping the centre of the
          // current view fixed so the user does not lose their place. Derived
          // from LABEL_LEGIBLE_ZOOM, never a restated literal — the
          // single-source guard fails on a second numeric zoom literal.
          const vp = getViewport()
          if (vp.zoom >= LABEL_LEGIBLE_ZOOM) return
          const el = document.querySelector('.react-flow') as HTMLElement | null
          const w = el?.clientWidth ?? 0
          const h = el?.clientHeight ?? 0
          const scale = LABEL_LEGIBLE_ZOOM / vp.zoom
          setViewport(
            {
              zoom: LABEL_LEGIBLE_ZOOM,
              x: w / 2 - (w / 2 - vp.x) * scale,
              y: h / 2 - (h / 2 - vp.y) * scale,
            },
            { duration: cameraDuration(300, prefersReducedMotion) },
          )
        }}
        className={`${typography.panelMeta} rounded text-info underline hover:text-text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info`}
      >
        {CANVAS_LOD_NOTICE_ACTION}
      </button>
    </div>
  )

  // No band (a standalone render, which is how this component's own spec
  // mounts it) means no portal target — draw inline, exactly as before.
  return target ? createPortal(body, target) : body
}
