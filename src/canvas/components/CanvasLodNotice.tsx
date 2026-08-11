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
 * It renders from the SAME store flag the nodes blank themselves on
 * (`lodActive`, written by `LodSync` from the live viewport transform), so the
 * notice cannot claim a state the nodes are not in — derive, don't mirror.
 */
import { ZoomIn } from 'lucide-react'
import { useReactFlow } from '@xyflow/react'
import { useCanvasStore } from '../store'
import { LABEL_LEGIBLE_ZOOM } from '../utils/zoomLegibility'
import { cameraDuration } from '../utils/cameraMotion'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import { typography } from '../../styles/typography'

export const CANVAS_LOD_NOTICE_TESTID = 'canvas-lod-notice'

/**
 * The copy. Stated as the fact it is — the labels are hidden, and why — with no
 * apology and no claim about what the user should have done. "Zoomed out too far
 * to show labels" is true at exactly the moment `lodActive` is true, because
 * that flag IS `zoom < LABEL_LEGIBLE_ZOOM`.
 */
export const CANVAS_LOD_NOTICE_COPY = 'Zoomed out too far to show labels'
export const CANVAS_LOD_NOTICE_ACTION = 'Zoom in to read them'

export function CanvasLodNotice() {
  const lodActive = useCanvasStore((s) => s.lodActive === true)
  const { getViewport, setViewport } = useReactFlow()
  const prefersReducedMotion = usePrefersReducedMotion()

  if (!lodActive) return null

  return (
    <div
      data-testid={CANVAS_LOD_NOTICE_TESTID}
      role="status"
      aria-live="polite"
      className="pointer-events-auto absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border border-panel-border bg-panel px-3 py-1.5 shadow-sm"
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
}
