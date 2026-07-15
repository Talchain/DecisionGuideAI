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
 */

import { computeFitPadding, type FitPadding } from './computeFitPadding'

/** Below this zoom a node's label is not readably rendered — never "comfortable". */
export const MIN_READABLE_ZOOM = 0.5
/** Forgives animation-end drift and lets an exactly-fitted frame count as comfortable. */
export const COMFORT_SLACK_PX = 8
/** Fallbacks for nodes that have not reported measured dimensions yet. */
export const DEFAULT_NODE_WIDTH = 200
export const DEFAULT_NODE_HEIGHT = 80

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
 */
export function readFocusCamera(getViewport: () => ViewportLike): FocusCamera | null {
  if (typeof document === 'undefined') return null
  const el = document.querySelector('.react-flow')
  const rect = el?.getBoundingClientRect()
  if (!rect || rect.width <= 0 || rect.height <= 0) return null
  // ONE measurement feeds both the gate (insets) and the fit (padding).
  const padding = computeFitPadding(el)
  return {
    viewport: getViewport(),
    paneWidth: rect.width,
    paneHeight: rect.height,
    insets: paddingToInsets(padding),
    padding,
  }
}
