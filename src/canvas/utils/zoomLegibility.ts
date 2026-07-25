/**
 * zoomLegibility — THE single definition of "at this zoom, a node label is
 * rendered and readable". Every rule in the product that has to agree about
 * legibility derives from the constant below; none of them may restate it.
 *
 * WHY THIS MODULE EXISTS (live defect, deployed staging `039f479a`, 25 Jul
 * 2026, measured in a real browser): after a ~60 s first draft the canvas
 * auto-fitted a 19-node model to **0.4456** zoom and the payoff moment was a
 * page of blank rectangles — **16 of 18 node titles** and **all 18 node
 * bodies** resolved to `visibility: hidden`. The same defect fires on the
 * templates entry path: an 18-node saved example at **0.4509**, 15 of 17
 * titles and all 17 bodies hidden. Nothing was broken in isolation; three
 * rules simply disagreed, and nothing made them agree:
 *
 *   - `LodSync` hid every non-goal/decision label below **0.5** zoom.
 *   - `cameraComfort` separately declared **0.5** the readable floor, as its
 *     own hand-written literal.
 *   - the post-layout auto-fit (`useFitViewOnLayoutVersion`) had **no floor at
 *     all**, so it was free to park the camera inside the band the product
 *     itself calls unreadable.
 *
 * The landing zoom is a function of node count and pane size — it is not a
 * number to dial. Lowering the LOD threshold to suit an 18-node graph would
 * leave the next one (20+ nodes, fitting near 0.31) unreadable again, because
 * the fit target would still be unconstrained. The floor has to come from the
 * legibility rule itself.
 *
 * Two same-meaning literals maintained by hand in two files is the dominant
 * defect class in this codebase (CLAUDE.md trap 12): they agreed on the day
 * they were written and nothing would have gone red when they stopped. So the
 * number lives here exactly once and everything else imports it —
 * `zoomLegibilitySingleSource.spec.ts` fails the moment a second literal
 * appears under any name.
 *
 * DOCTRINE (what the constant licenses, and what it does not):
 *   - The product must never AUTOMATICALLY park the camera below this zoom.
 *     An auto-fit is the product choosing a view for the user; choosing an
 *     unreadable one is a bug. Hence `useFitViewOnLayoutVersion` passes this
 *     value as `fitView`'s `minZoom`.
 *   - The USER may go below it deliberately — scroll-zoom, the zoom-out
 *     control, or an explicit "fit to view" on a graph too big to read. Below
 *     the floor the level-of-detail view is the honest, intended rendering:
 *     structure without labels. Explicit user gestures are NOT clamped, so
 *     `ReactFlowGraph.handleFitView`, `CanvasToolbar`'s fit button and the
 *     command palette's "Zoom to Fit" stay unfloored by design.
 */

/**
 * Below this zoom node labels are hidden (level-of-detail); at or above it they
 * render. The one number; do not restate it anywhere else.
 */
export const LABEL_LEGIBLE_ZOOM = 0.5

/** True when node labels are rendered at this zoom. */
export function labelsRenderedAtZoom(zoom: number): boolean {
  return zoom >= LABEL_LEGIBLE_ZOOM
}
