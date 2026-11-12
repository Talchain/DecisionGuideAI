/**
 * The camera on the olumi-core lane. A real first model is wider and taller than the canvas at the product's legibility floor (0.5), so
 * the landing fit cropped it (live olumi-core-v3, 4 Nov: cards cut off on the left). On this lane the product fit may go lower, so the
 * whole of core's model is in view on first open and after each new version; the person zooms in from there.
 */
import type { View } from './client'
import { labelCounterScale, LABEL_SCALE_QUANTUM } from '../canvas/utils/zoomLegibility'

export const CORE_LANE_FIT_FLOOR = 0.25

/** The foot of the canvas the whole-board fit keeps clear (px): the zoomed-out notice (ViewZoomNotice), drawn at the foot's middle. */
export const NOTICE_CLEAR_BOTTOM = 60

/** The floor a product fit uses: the lane's, never above the product's own. */
export const productFitFloor = (coreLane: boolean, legible: number): number => (coreLane ? Math.min(CORE_LANE_FIT_FLOOR, legible) : legible)

/** The zoom at which this lane's smallest card type (12 px) draws at 11 px (DL 10 Nov: no card text under 11 px). At or above it a card
 *  draws its full face; below it, its reduced face (heading and headline chance, set at `reducedFaceSize` so it still draws at 11 px).
 *  Paul, 10 Nov: "Board at first open: the whole model in view, as the previous product did." The first fit is the whole board
 *  (`wholeAtTopViewport`, never below `CORE_LANE_FIT_FLOOR`), not this zoom. */
export const MIN_CARD_TEXT_PX = 11
export const READABLE_WHOLE_ZOOM = MIN_CARD_TEXT_PX / 12
/** The label counter-scale a reduced face draws at (DL 10 Nov evening, reversing the 12 px rule: "as the previous product did"): the previous
 *  product's own rule, `labelCounterScale` (capped at LABEL_COUNTER_SCALE_CAP, 1.64), rounded UP to the sync's 0.01 grid exactly as
 *  CanvasLabelScaleSync writes it. 0 when the zoom is at or above `READABLE_WHOLE_ZOOM` (the full face is drawn) or not a usable number. */
export const reducedFaceSize = (zoom: number): number =>
  Number.isFinite(zoom) && zoom > 0 && zoom < READABLE_WHOLE_ZOOM ? Math.ceil(labelCounterScale(zoom) * LABEL_SCALE_QUANTUM) / LABEL_SCALE_QUANTUM : 0

/** The zoom at or above which the whole board is shown at once: the readable floor (R25), so a whole-board fit never draws text under
 *  12px; was 0.8 (DL 4 Nov, R3). */
export const WHOLE_FIT_ZOOM = READABLE_WHOLE_ZOOM

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
 * J1 step 2 (DL 8 Nov, Codex's order: "framing at 1232 that keeps the question, the selected card and the aim readable beside the dock"):
 * a board that fits whole at the readable floor is drawn whole at the largest zoom that fits, never past 1, with its top under the free
 * canvas's top (the question first, where the prototype puts it, never floated to the middle with room above it) and centred across the
 * free canvas left of the dock. The canvas's own controls hang at the bottom left, so a board read from the top keeps clear of them.
 */
export function wholeAtTopViewport(bounds: Rect, pane: { width: number; height: number }, insets: Insets, maxZoom = 1, floor = 0): { x: number; y: number; zoom: number } {
  const freeW = Math.max(1, pane.width - insets.left - insets.right), freeH = Math.max(1, pane.height - insets.top - insets.bottom)
  // The whole board, at the largest zoom that fits it; a board too large for `floor` opens at the floor, its top in view.
  const zoom = Math.max(floor, Math.min(maxZoom, freeW / Math.max(1, bounds.width), freeH / Math.max(1, bounds.height)))
  return { zoom, x: insets.left + freeW / 2 - (bounds.x + bounds.width / 2) * zoom, y: insets.top - bounds.y * zoom }
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

/**
 * The badges core shows open (`badge.open`, on the question and on each card) in the View it returned. Opening or closing one adds or takes
 * away the records it folds, so the board changes size: the camera frames it again (DL, 12 Nov: at 2000 with the question's notes open the
 * right-most cards ran under the dock). Keyed on the View core returns, never on the press, so the frame is of the board that arrived.
 */
export function openBadgesKeyOf(view: View | null): string {
  const m = view?.model
  if (m == null) return ''
  return [...(m.question.badge?.open ? ['question'] : []), ...m.cards.flatMap((c) => (c.badge?.open ? [c.id] : []))].join(',')
}
