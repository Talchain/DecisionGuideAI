/**
 * The camera on the olumi-core lane. A real first model is wider and taller than the canvas at the product's legibility floor (0.5), so
 * the landing fit cropped it (live olumi-core-v3, 4 Nov: cards cut off on the left). On this lane the product fit may go lower, so the
 * whole of core's model is in view on first open and after each new version; the person zooms in from there.
 */
export const CORE_LANE_FIT_FLOOR = 0.25

/** The floor a product fit uses: the lane's, never above the product's own. */
export const productFitFloor = (coreLane: boolean, legible: number): number => (coreLane ? Math.min(CORE_LANE_FIT_FLOOR, legible) : legible)

/** The zoom at or above which the whole board is shown at once: a board that fits only below it is unreadable whole. */
export const READABLE_WHOLE_ZOOM = 0.5

type Rect = { x: number; y: number; width: number; height: number }
type Insets = { top: number; right: number; bottom: number; left: number }
/**
 * READABLE FIRST, WHOLE WHEN IT FITS (DL 4 Nov, after f-fit-on-open: a 22-card board fitted whole at 0.272, tall and narrow, nothing
 * readable). Null when the whole board fits the free canvas at `READABLE_WHOLE_ZOOM` or more: the product's own fit then frames it whole.
 * Otherwise the board's width (every column side by side), centred across the free canvas and top-aligned under its top inset, so the
 * question and the first cards of every column are in view and the person pans down; never zoomed past 1.
 */
export function readableFirstViewport(bounds: Rect, pane: { width: number; height: number }, insets: Insets): { x: number; y: number; zoom: number } | null {
  const freeW = Math.max(1, pane.width - insets.left - insets.right), freeH = Math.max(1, pane.height - insets.top - insets.bottom)
  if (Math.min(freeW / Math.max(1, bounds.width), freeH / Math.max(1, bounds.height)) >= READABLE_WHOLE_ZOOM) return null
  const zoom = Math.min(1, freeW / Math.max(1, bounds.width))
  return { zoom, x: insets.left + (freeW - bounds.width * zoom) / 2 - bounds.x * zoom, y: insets.top - bounds.y * zoom }
}
