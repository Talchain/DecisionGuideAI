/**
 * cameraComfort — the pinned "no camera churn" rule shared by F2 (focus
 * fits the neighbourhood) and F4 (the applied-edit pulse fits its targets).
 *
 * THE RULE: the camera must NOT move when every target node is already
 * comfortably visible — each target's rect fully inside the panel-aware fit
 * frame (the pane inset by computeFitPadding's per-side margins, minus a
 * small slack so a frame the camera just fitted still counts) at a readable
 * zoom (>= MIN_READABLE_ZOOM). Anything less — a target off-screen, under an
 * occluding panel, or rendered unreadably small — and the caller fits.
 *
 * Fail-open to fitting: an unmeasurable pane/viewport (jsdom, pre-mount) or
 * an empty target list is NOT comfortable, so callers fall back to the
 * previous always-fit behaviour.
 *
 * Pure by design (cameraMotion precedent): callers supply the viewport, pane
 * size and insets; only readFocusCamera below touches the DOM, mirroring
 * computeFitPadding's measurement approach.
 *
 * ⭐⭐ THE TWO FRAMES DIVERGED ON PURPOSE, 18 Aug 2026 — READ THIS BEFORE
 * "RESTORING CONSISTENCY" BETWEEN THEM.
 *
 * `computeFitPadding` no longer reserves anything for the floating Olumi
 * companion: it is not edge-anchored, it is not layout-reserving, and charging
 * the graph 392px of canvas for it was the defect
 * `WORKSPACE-COMPOSITION-DECISION-2026-08-18.md` step 1 exists to fix.
 *
 * But THIS module's rule is about OCCLUSION, not layout — "under an occluding
 * panel" is written into the rule above — and it took its frame from that same
 * function. So the deletion alone would have scored a node behind the companion
 * COMFORTABLE and the focus camera would have silently refused to move: a
 * regression in the very capability ("ask about a selected element without
 * losing visual context") the change exists to serve, with no error, no red test
 * and no user-visible failure except that focus stops working. No design in the
 * set caught it.
 *
 * Hence two frames from ONE measurement:
 *   - `FocusCamera.padding` — what the gated fit passes to `fitView`.
 *     Edge-anchored chrome only. The companion contributes NOTHING, ever.
 *   - `FocusCamera.insets` — the frame the no-churn GATE measures against. That
 *     same padding, widened by whatever the companion occludes.
 *
 * The gate frame is a SUBSET of the fit frame, never a superset, so this can only
 * make the camera fit more often than before — never less. "Comfortable" is
 * strictly harder to earn than it was at pristine, which is the safe direction
 * for a gate whose failure mode is a stranded camera, and it means the gate's
 * behaviour is preserved from before the deletion rather than changed by it.
 *
 * ⚠ The consequence, stated rather than discovered later: a gated fit frames into
 * the companion-FREE box, so a target can still land behind the companion after
 * the camera moves. That is not a loop (the gate runs per focus action, not
 * continuously) and it is what the decision's step 6 fixes properly, by MOVING
 * the panel — fit-then-place — instead of reserving around it.
 */

import { computeFitPadding, type FitPadding } from './computeFitPadding'
import { LABEL_LEGIBLE_ZOOM } from './zoomLegibility'

/**
 * Below this zoom a node's label is not readably rendered — never "comfortable".
 *
 * DERIVED, never restated: this was its own hand-written `0.5`, twinned with
 * `LodSync.LOD_ZOOM_THRESHOLD`. One number, one home — `./zoomLegibility`.
 */
export const MIN_READABLE_ZOOM = LABEL_LEGIBLE_ZOOM
/** Forgives animation-end drift and lets an exactly-fitted frame count as comfortable. */
export const COMFORT_SLACK_PX = 8
/** Fallbacks for nodes that have not reported measured dimensions yet. */
export const DEFAULT_NODE_WIDTH = 200
export const DEFAULT_NODE_HEIGHT = 80

/**
 * Breathing gap added to a companion clearance, mirroring `computeFitPadding`'s
 * own GAP so the comfort frame and the (former) reservation agree in magnitude.
 * Kept as its own constant rather than imported: the two now answer different
 * questions, and a shared constant would invite re-fusing them.
 */
export const COMFORT_OCCLUSION_GAP = 16

/**
 * The floating companion's DOM, spelled ONCE for the whole codebase.
 *
 * After step 1, `computeFitPadding` names the panel nowhere, so this list is the
 * only place it appears. The side tab is a sibling positioned at `left: -36`
 * with the panel `overflow: visible`, so it is NOT part of the panel's own
 * `getBoundingClientRect` — union the two or the box is 36px short of what the
 * user sees.
 *
 * ⚠ The minimised pill is deliberately absent. Its entire contract is "I am out
 * of the way": it is small, semi-transparent and draggable, and treating it as
 * an occluder used to collapse the vertical fitting box to 355px for a graph
 * needing 524px. Occlude the surface, not the affordance.
 */
export const FLOATING_COMPANION_SELECTORS = [
  '[data-testid="floating-olumi-panel"]',
  '[data-testid="floating-olumi-panel-side-tab"]',
] as const

/** A rectangle in viewport coordinates — the shape `getBoundingClientRect` returns. */
export interface Box {
  left: number
  top: number
  right: number
  bottom: number
}

/** The four sides a clearance can be taken from. */
export type ComfortClearanceSide = 'left' | 'right' | 'top' | 'bottom'

/**
 * The cheapest way to hold a frame entirely clear of a FREE-FLOATING occluder.
 *
 * MOVED HERE VERBATIM from `computeFitPadding.cheapestReservation` (18 Aug 2026)
 * — the geometry is unchanged and its tests came with it; what changed is who is
 * allowed to consume it. It may inform the comfort GATE. It may never again
 * inform a layout reservation.
 *
 * A rectangular inset cannot express "this box is covered", so the only way to
 * keep a frame off an occluder is to keep the frame entirely to one side of it.
 * Four clearances achieve that; this returns the SMALLEST:
 *
 *   right  → `frame.right - occ.left`     (frame sits left of the occluder)
 *   left   → `occ.right - frame.left`     (frame sits right of it)
 *   bottom → `frame.bottom - occ.top`     (frame sits above it)
 *   top    → `occ.bottom - frame.top`     (frame sits below it)
 *
 * Returns `null` when the occluder does not overlap at all. Ties resolve in
 * `right, left, bottom, top` order, which only matters for exactly-square
 * overlaps and never changes the amount.
 */
export function cheapestClearance(
  frame: Box,
  occ: Box,
): { side: ComfortClearanceSide; amount: number } | null {
  const overlapsX = occ.left < frame.right && occ.right > frame.left
  const overlapsY = occ.top < frame.bottom && occ.bottom > frame.top
  if (!overlapsX || !overlapsY) return null

  const candidates: Array<{ side: ComfortClearanceSide; amount: number }> = [
    { side: 'right', amount: frame.right - occ.left },
    { side: 'left', amount: occ.right - frame.left },
    { side: 'bottom', amount: frame.bottom - occ.top },
    { side: 'top', amount: occ.bottom - frame.top },
  ]
  let best = candidates[0]
  for (const c of candidates) {
    if (c.amount < best.amount) best = c
  }
  return { side: best.side, amount: Math.max(0, best.amount) }
}

/**
 * The floating companion's on-screen box, or `null` when it is not mounted.
 * Union of every selector above, so the side tab is included.
 */
export function readFloatingCompanionBox(): Box | null {
  if (typeof document === 'undefined') return null
  const rects: DOMRect[] = []
  for (const selector of FLOATING_COMPANION_SELECTORS) {
    const el = document.querySelector(selector) as HTMLElement | null
    if (!el) continue
    const rect = el.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) continue
    rects.push(rect)
  }
  if (rects.length === 0) return null
  return {
    left: Math.min(...rects.map((r) => r.left)),
    top: Math.min(...rects.map((r) => r.top)),
    right: Math.max(...rects.map((r) => r.right)),
    bottom: Math.max(...rects.map((r) => r.bottom)),
  }
}

/**
 * The GATE's frame: the fit padding, widened by whatever the floating companion
 * occludes.
 *
 * Pure — the caller supplies the companion box — so the whole rule is testable
 * without a DOM, and so a caller cannot accidentally make the FIT padding
 * companion-aware by reaching for this.
 *
 * Deliberately NOT re-clamped by `computeFitPadding`'s MAX_PADDING_FRACTION: an
 * occluder too large to clear yields a degenerate frame, and
 * `nodesComfortablyVisible` already treats a degenerate frame as NOT
 * comfortable — which is this module's documented fail-open-to-fitting. Clamping
 * it would make the frame LARGER and could newly score an occluded node
 * comfortable, i.e. the one direction that is unsafe.
 */
export function comfortInsets(
  flow: Box,
  padding: FitPadding,
  floating: Box | null,
): ComfortInsets {
  const insets = paddingToInsets(padding)
  if (!floating) return insets
  const clearance = cheapestClearance(flow, floating)
  if (!clearance || clearance.amount <= 0) return insets
  const value = clearance.amount + COMFORT_OCCLUSION_GAP
  return { ...insets, [clearance.side]: Math.max(insets[clearance.side], value) }
}

export interface ViewportLike {
  x: number
  y: number
  zoom: number
}

export interface ComfortInsets {
  top: number
  right: number
  bottom: number
  left: number
}

export interface SizedNodeLike {
  position: { x: number; y: number }
  measured?: { width?: number; height?: number }
  width?: number
  height?: number
}

/** Bridge computeFitPadding's `'<n>px'` strings to numeric insets. */
export function paddingToInsets(padding: FitPadding): ComfortInsets {
  return {
    top: parseFloat(padding.top),
    right: parseFloat(padding.right),
    bottom: parseFloat(padding.bottom),
    left: parseFloat(padding.left),
  }
}

export function nodesComfortablyVisible(
  nodes: ReadonlyArray<SizedNodeLike>,
  viewport: ViewportLike | null | undefined,
  paneWidth: number,
  paneHeight: number,
  insets: ComfortInsets,
): boolean {
  if (nodes.length === 0) return false
  if (!viewport) return false
  if (!(paneWidth > 0) || !(paneHeight > 0)) return false
  if (viewport.zoom < MIN_READABLE_ZOOM) return false

  const frameLeft = Math.max(0, insets.left - COMFORT_SLACK_PX)
  const frameTop = Math.max(0, insets.top - COMFORT_SLACK_PX)
  const frameRight = paneWidth - Math.max(0, insets.right - COMFORT_SLACK_PX)
  const frameBottom = paneHeight - Math.max(0, insets.bottom - COMFORT_SLACK_PX)
  if (frameRight <= frameLeft || frameBottom <= frameTop) return false

  for (const node of nodes) {
    const width = node.measured?.width ?? node.width ?? DEFAULT_NODE_WIDTH
    const height = node.measured?.height ?? node.height ?? DEFAULT_NODE_HEIGHT
    const screenX = node.position.x * viewport.zoom + viewport.x
    const screenY = node.position.y * viewport.zoom + viewport.y
    if (
      screenX < frameLeft ||
      screenY < frameTop ||
      screenX + width * viewport.zoom > frameRight ||
      screenY + height * viewport.zoom > frameBottom
    ) {
      return false
    }
  }
  return true
}

export interface FocusCamera {
  viewport: ViewportLike
  paneWidth: number
  paneHeight: number
  insets: ComfortInsets
  /**
   * SAME-FRAME RULE: the padding the gated fit MUST pass to fitView, derived
   * from the very computeFitPadding call `insets` was parsed from. The gate
   * (nodesComfortablyVisible, via `insets`) and the fit it gates therefore
   * measure against ONE frame.
   *
   * A bare-number padding here would reintroduce the bug this field exists to
   * kill: bare numbers are a FRACTION of the full pane (see computeFitPadding),
   * so the gate would ask "is the target clear of the expanded dock?" and the
   * fit would then frame against the whole pane and re-park it under that same
   * dock — the camera moves and the target is still occluded.
   */
  padding: FitPadding
}

/**
 * Measure the live camera for the main canvas: viewport from the caller's
 * ReactFlow instance, pane + panel-aware insets from the `.react-flow`
 * element (same single-canvas scope caveat as computeFitPadding). Returns
 * null when unmeasurable — callers treat that as "not comfortable" and fit.
 *
 * The `insets` it returns are COMPANION-AWARE and the `padding` is not; that
 * asymmetry is the contract, not a bug. See the module header.
 */
export function readFocusCamera(getViewport: () => ViewportLike): FocusCamera | null {
  if (typeof document === 'undefined') return null
  const el = document.querySelector('.react-flow')
  const rect = el?.getBoundingClientRect()
  if (!rect || rect.width <= 0 || rect.height <= 0) return null
  // ONE measurement, TWO frames — see the header. `padding` is what the gated
  // fit uses and carries edge-anchored chrome only; `insets` is what the gate
  // measures against and additionally excludes the floating companion.
  const padding = computeFitPadding(el)
  const flow: Box = { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }
  return {
    viewport: getViewport(),
    paneWidth: rect.width,
    paneHeight: rect.height,
    insets: comfortInsets(flow, padding, readFloatingCompanionBox()),
    padding,
  }
}
