import { CANONICAL_LAYOUT_WIDTH, CANVAS_MARGIN } from '../utils/nodeLayoutConstants'
import { COMFORT_OCCLUSION_GAP } from '../utils/cameraComfort'
import { LABEL_LEGIBLE_ZOOM } from '../utils/zoomLegibility'

/** The floating panel's side controls sit outside its body and occlude canvas too. */
export const FLOATING_OLUMI_SIDE_TAB_WIDTH = 36

/**
 * The narrowest honest viewport for the canonical model: its stable layout
 * budget rendered at the label-legibility floor, plus the canonical margin on
 * both sides. This is derived from existing authorities rather than a laptop
 * breakpoint, so changing the layout or legibility contract moves the panel
 * composition threshold with it.
 */
export const MIN_USABLE_MODEL_VIEWPORT_WIDTH =
  Math.ceil(CANONICAL_LAYOUT_WIDTH * LABEL_LEGIBLE_ZOOM) + 2 * CANVAS_MARGIN

export interface PanelCompositionGeometry {
  viewportWidth: number
  dockInset: number
  floatingPanelWidth: number
  dockExpanded: boolean
}

/**
 * True when two fully-expanded right-side thinking surfaces would leave less
 * than one legible canonical-model viewport. In that state only one surface is
 * expanded: opening Outputs minimises floating Olumi; choosing floating Olumi
 * collapses Outputs. Both capabilities remain one click away.
 */
export function needsSingleExpandedPanel({
  viewportWidth,
  dockInset,
  floatingPanelWidth,
  dockExpanded,
}: PanelCompositionGeometry): boolean {
  if (!dockExpanded) return false
  if (![viewportWidth, dockInset, floatingPanelWidth].every(Number.isFinite)) return false
  if (viewportWidth <= 0 || dockInset <= 0 || floatingPanelWidth <= 0) return false

  const usableWidth =
    viewportWidth - dockInset - floatingPanelWidth - FLOATING_OLUMI_SIDE_TAB_WIDTH - COMFORT_OCCLUSION_GAP
  return usableWidth < MIN_USABLE_MODEL_VIEWPORT_WIDTH
}

const FLOATING_SURFACE_REQUEST_EVENT = 'olumi-floating-surface-requested'

interface FloatingSurfaceRequestDetail {
  reveal: () => void
}

type FloatingSurfaceRequestEvent = CustomEvent<FloatingSurfaceRequestDetail>

/**
 * Ask the workspace shell to yield to floating Olumi before revealing it.
 * With no shell (tests, rollback surfaces), reveal immediately.
 */
export function requestFloatingOlumiSurface(reveal: () => void): void {
  if (typeof window === 'undefined') {
    reveal()
    return
  }
  const event: FloatingSurfaceRequestEvent = new CustomEvent(FLOATING_SURFACE_REQUEST_EVENT, {
    cancelable: true,
    detail: { reveal },
  })
  const unhandled = window.dispatchEvent(event)
  if (unhandled) reveal()
}

/**
 * Register the workspace shell's composition decision. Return true when the
 * shell took ownership of sequencing the reveal; false to let it happen now.
 */
export function listenForFloatingOlumiRequests(
  decide: (reveal: () => void) => boolean,
): () => void {
  if (typeof window === 'undefined') return () => undefined
  const handle = (raw: Event) => {
    const event = raw as FloatingSurfaceRequestEvent
    if (!event.detail || typeof event.detail.reveal !== 'function') return
    if (decide(event.detail.reveal)) event.preventDefault()
  }
  window.addEventListener(FLOATING_SURFACE_REQUEST_EVENT, handle)
  return () => window.removeEventListener(FLOATING_SURFACE_REQUEST_EVENT, handle)
}
