/**
 * ⭐ A USER FIT CENTRES THE BOARD IN THE FREE PANE, NOT UNDER THE DOCK
 * (build train slice D, root R7 "Fit to view sits off-centre"; D-2 row (e)).
 *
 * Measured by the D-2 board-states gate (#2184) on Paul's MRR boards at
 * 1280x800: after the real "Fit to view", the board sat 15.1% of the free
 * pane's width off-centre — and 0.0% off the centre of the WHOLE canvas, which
 * runs under the right-hand dock.
 *
 * The mechanism is xyflow's, not the padding's. `computeFitPadding()` reserves
 * the dock correctly (right ≈ 331px, left ≈ the tools rail), but xyflow 12
 * treats asymmetric padding as a MINIMUM: `getViewportForBounds` centres the
 * bounds on the whole pane, then shifts only when a side's applied padding
 * would fall below the required one. On a tall board the zoom is set by the
 * HEIGHT, so neither horizontal side is violated, nothing shifts, and the
 * board stays centred under the dock — off by (right − left) / 2, ~130px.
 *
 * So the fit is computed here against the free pane itself (the pane minus the
 * product's own reserved padding) and placed with `setViewport`. The ZOOM is
 * identical to xyflow's — `min(freeW / w, freeH / h)`, clamped — only the
 * centring changes. Used by every user-invoked fit: the toolbar's "Fit to
 * view", the palette's "Zoom to Fit" and the extent notice's "Show whole
 * model". The product's landing fit keeps its own path
 * (`useFitViewOnLayoutVersion`: floored, top-anchored when the board overflows).
 */
import type { Rect, Viewport } from '@xyflow/react'
import { cameraDuration } from './cameraMotion'
import { computeFitPadding, type FitPadding } from './computeFitPadding'
import { FLOW_MAX_ZOOM, FLOW_MIN_ZOOM } from './zoomLegibility'

export { FLOW_MAX_ZOOM, FLOW_MIN_ZOOM }

const px = (v: string): number => parseFloat(v) || 0

/** The viewport that centres `bounds` in `pane` minus `padding`. Pure. */
export function viewportCentredInFreePane({
  bounds,
  pane,
  padding,
  minZoom = FLOW_MIN_ZOOM,
  maxZoom = FLOW_MAX_ZOOM,
}: {
  bounds: Rect
  pane: { width: number; height: number }
  padding: FitPadding
  minZoom?: number
  maxZoom?: number
}): Viewport {
  const left = px(padding.left)
  const top = px(padding.top)
  const freeW = Math.max(1, pane.width - left - px(padding.right))
  const freeH = Math.max(1, pane.height - top - px(padding.bottom))
  const zoom = Math.min(
    maxZoom,
    Math.max(minZoom, Math.min(freeW / Math.max(1, bounds.width), freeH / Math.max(1, bounds.height))),
  )
  const centreX = bounds.x + bounds.width / 2
  const centreY = bounds.y + bounds.height / 2
  return { x: left + freeW / 2 - centreX * zoom, y: top + freeH / 2 - centreY * zoom, zoom }
}

interface FitIntoFreePaneFlow<N> {
  getNodes: () => N[]
  getNodesBounds: (nodes: N[]) => Rect
  setViewport: (viewport: Viewport, options?: { duration?: number }) => unknown
}

/**
 * Fit `nodes` (all visible nodes when empty, as `fitView` does) into the free
 * pane. Returns false, and leaves the camera alone, when there is nothing
 * measurable to frame.
 */
export function fitIntoFreePane<N extends { hidden?: boolean }>(
  flow: FitIntoFreePaneFlow<N>,
  options: {
    nodes?: N[]
    minZoom?: number
    maxZoom?: number
    /** The move's length before the reduced-motion guard (`cameraDuration`), which this applies. */
    durationMs?: number
    reducedMotion?: boolean
    flowEl?: Element | null
  } = {},
): boolean {
  const el =
    options.flowEl ?? (typeof document !== 'undefined' ? document.querySelector('.react-flow') : null)
  const rect = el?.getBoundingClientRect()
  if (!rect || rect.width <= 0 || rect.height <= 0) return false
  const targets = options.nodes && options.nodes.length > 0 ? options.nodes : flow.getNodes().filter((n) => !n.hidden)
  if (targets.length === 0) return false
  const bounds = flow.getNodesBounds(targets)
  if (!(bounds.width > 0) || !(bounds.height > 0)) return false
  flow.setViewport(
    viewportCentredInFreePane({
      bounds,
      pane: { width: rect.width, height: rect.height },
      padding: computeFitPadding(el),
      minZoom: options.minZoom,
      maxZoom: options.maxZoom,
    }),
    { duration: cameraDuration(options.durationMs ?? 0, options.reducedMotion ?? false) },
  )
  return true
}
