/**
 * The camera on the olumi-core lane. A real first model is wider and taller than the canvas at the product's legibility floor (0.5), so
 * the landing fit cropped it (live olumi-core-v3, 4 Nov: cards cut off on the left). On this lane the product fit may go lower, so the
 * whole of core's model is in view on first open and after each new version; the person zooms in from there.
 */
export const CORE_LANE_FIT_FLOOR = 0.25

/** The floor a product fit uses: the lane's, never above the product's own. */
export const productFitFloor = (coreLane: boolean, legible: number): number => (coreLane ? Math.min(CORE_LANE_FIT_FLOOR, legible) : legible)

/** The zoom at or above which the whole board is shown at once (DL 4 Nov, the original look: text at about 11–12px on screen). */
export const READABLE_WHOLE_ZOOM = 0.9

type Rect = { x: number; y: number; width: number; height: number }
type Insets = { top: number; right: number; bottom: number; left: number }
/**
 * READABLE FIRST, WHOLE WHEN IT FITS (DL 4 Nov: a 22-card board fitted whole at 0.272, nothing readable; then, for the original look,
 * "on open, the camera zooms to max(fit, 0.9), anchored at the top centre"). Null when the whole board fits the free canvas at
 * `READABLE_WHOLE_ZOOM` or more: the product's own fit then frames it whole. Otherwise the board at that zoom (lower only as far as
 * keeps the whole board across the free canvas, so no card is under the dock), its top under the free canvas's top and centred across
 * it; the person scrolls down for the rest. `_top` (the question and options) is kept for its callers; the board's width now bounds the zoom.
 */
export function readableFirstViewport(bounds: Rect, pane: { width: number; height: number }, insets: Insets, _top: Rect = bounds): { x: number; y: number; zoom: number } | null {
  const freeW = Math.max(1, pane.width - insets.left - insets.right), freeH = Math.max(1, pane.height - insets.top - insets.bottom)
  const whole = Math.min(freeW / Math.max(1, bounds.width), freeH / Math.max(1, bounds.height))
  if (whole >= READABLE_WHOLE_ZOOM) return null
  // At 0.9, unless the board would not fit across the free canvas there: then as near 0.9 as keeps the whole width across, so no card
  // sits under the dock (R1.1, Paul's screen: A2 half under it at 1440). Its top under the free canvas's top; the person scrolls down.
  // `top` (the question and the options) is then across too: it is inside the board.
  const zoom = Math.max(whole, Math.min(READABLE_WHOLE_ZOOM, freeW / Math.max(1, bounds.width)))
  return { zoom, x: insets.left + freeW / 2 - (bounds.x + bounds.width / 2) * zoom, y: insets.top - bounds.y * zoom }
}
