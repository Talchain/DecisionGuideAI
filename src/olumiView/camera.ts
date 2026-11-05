/**
 * The camera on the olumi-core lane. A real first model is wider and taller than the canvas at the product's legibility floor (0.5), so
 * the landing fit cropped it (live olumi-core-v3, 4 Nov: cards cut off on the left). On this lane the product fit may go lower, so the
 * whole of core's model is in view on first open and after each new version; the person zooms in from there.
 */
import type { View } from './client'

export const CORE_LANE_FIT_FLOOR = 0.25

/** The floor a product fit uses: the lane's, never above the product's own. */
export const productFitFloor = (coreLane: boolean, legible: number): number => (coreLane ? Math.min(CORE_LANE_FIT_FLOOR, legible) : legible)

/** The readable floor (DL 4 Nov, the original look: text at about 11–12px on screen): a board that does not fit whole opens at this zoom. */
export const READABLE_WHOLE_ZOOM = 0.9

/** The zoom at or above which the whole board is shown at once (DL 4 Nov, R3: Paul's original fits the whole board when it reads at 0.8). */
export const WHOLE_FIT_ZOOM = 0.8

type Rect = { x: number; y: number; width: number; height: number }
type Insets = { top: number; right: number; bottom: number; left: number }
/**
 * READABLE FIRST (DL 4 Nov, 17Z ruling on R1.1: "readable first wins"). The visible rect is the canvas minus the dock; the board is framed
 * inside it, never behind the dock. Null when the whole board fits it at `WHOLE_FIT_ZOOM` or more: the product's own fit then frames
 * it whole, and no card is under the dock. Otherwise the board at 0.9, never lower: its top under the visible rect's top, `top` (the
 * question and the options) centred across it and wholly inside it; the person pans for the rest.
 */
export function readableFirstViewport(bounds: Rect, pane: { width: number; height: number }, insets: Insets, top: Rect = bounds): { x: number; y: number; zoom: number } | null {
  const freeW = Math.max(1, pane.width - insets.left - insets.right), freeH = Math.max(1, pane.height - insets.top - insets.bottom)
  const whole = Math.min(freeW / Math.max(1, bounds.width), freeH / Math.max(1, bounds.height))
  if (whole >= WHOLE_FIT_ZOOM) return null
  const zoom = READABLE_WHOLE_ZOOM
  const centred = insets.left + freeW / 2 - (top.x + top.width / 2) * zoom
  // A board that fits across at 0.9 (only too tall) is held wholly across the visible rect, so no card is under the dock: the question
  // and options as near the centre as that allows. A wider one keeps them centred and the rest is reached by panning.
  // The x range that keeps the whole board across: from its left edge at the visible rect's left (lo) to its right edge at its right (hi).
  const lo = insets.left - bounds.x * zoom, hi = insets.left + freeW - (bounds.x + bounds.width) * zoom
  const x = lo <= hi ? Math.min(hi, Math.max(lo, centred)) : centred
  return { zoom, x, y: insets.top - bounds.y * zoom }
}

/**
 * The board the camera frames: each version of core's model, and before any version the first model, which core shows as a pending
 * proposal (R5 look defect 4: framed only per version, that board was never framed and its question sat under the top and lens bars).
 * A proposal held on a version keeps the version's key, so it does not move the camera. Empty when nothing is shown.
 */
export function boardKeyOf(sid: string | null, view: View | null): string {
  if (sid === null || view === null) return ''
  if (view.version) return `${sid}:v${view.version.id}`
  return view.proposal ? `${sid}:p${view.proposal.id}` : ''
}
