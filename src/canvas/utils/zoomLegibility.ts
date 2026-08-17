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

/**
 * ⭐ THE CONSTANT ABOVE NAMED SOMETHING IT DID NOT DELIVER (measured 17 Aug 2026).
 * ---------------------------------------------------------------------------
 * `LABEL_LEGIBLE_ZOOM` decides two things: where level-of-detail drops the
 * labels, and — since this module shipped — the `minZoom` floor the post-layout
 * auto-fit is allowed to park at (`useFitViewOnLayoutVersion`). It fixed the
 * blank-first-view defect: labels now RENDER after a draft. It never made them
 * READABLE, and nothing in the module checked.
 *
 * Canvas label text is DOM inside React Flow's viewport transform, and that
 * transform scales text. `vector-effect="non-scaling-stroke"` exempts strokes,
 * not glyphs. So the rendered size of a label is `declared × zoom`, and a
 * post-draft graph clamps at exactly this floor:
 *
 *   nodeTitle 13px × 0.50 = 6.5px    nodeLabel 11px × 0.50 = 5.5px
 *   edgeLabel 10px × 0.50 = 5.0px
 *
 * against a Design System v5 §2.4 canvas floor of 10px. Paul: "hard to read even
 * on a reasonably sized screen."
 *
 * WHY COUNTER-SCALING AND NOT A HIGHER FLOOR — the derivation, not a preference.
 * `rendered = declared × fontScale × zoom`. Three variables, and only one is
 * free:
 *   • `zoom` is NOT free. It is whatever fitView needs to show the whole model;
 *     the floor merely clamps it, and clamping harder crops the model on first
 *     view. (Measured, and already paid for once: a prior lane bought 136px of
 *     panel width for the graph and delivered no legibility, because the fit
 *     clamped at this floor at EVERY width.)
 *   • `declared` is NOT free. DS v5 §2.3 fixes the canvas scale at 13/11/10 and
 *     §2.4 forbids inventing another one.
 *   • `fontScale` IS free, and it is the only channel that is a function of the
 *     same quantity that destroys legibility. So it is the one to use.
 *
 * The rule below therefore holds `rendered === declared` across the whole band
 * the product calls legible, which is exactly what the constant's name has
 * always claimed. It is bounded in both directions by construction:
 * counter-scaling never exceeds `1 / LABEL_LEGIBLE_ZOOM`, and never exceeds 1
 * once the user zooms in past 1:1 (magnification is then the user's own
 * deliberate choice, and text should grow with it).
 */

/**
 * The font-size multiplier canvas label text must carry at `zoom` for its
 * rendered size to equal its declared size.
 *
 * Derived from `LABEL_LEGIBLE_ZOOM`; introduces no second literal (CLAUDE.md
 * trap 12 — this module exists because two hand-kept copies of one number
 * agreed on the day they were written and nothing would have gone red when they
 * stopped).
 *
 *   zoom ≥ 1                       → 1                    (no counter-scale)
 *   LABEL_LEGIBLE_ZOOM ≤ zoom < 1  → 1 / zoom             (rendered = declared)
 *   zoom < LABEL_LEGIBLE_ZOOM      → 1 / LABEL_LEGIBLE_ZOOM   (capped; LOD has
 *                                    hidden most labels below here anyway, and
 *                                    the few that are kept stay as large as the
 *                                    cap allows)
 *
 * A non-finite or non-positive zoom cannot produce a meaningful scale, so it
 * returns 1 — the identity — rather than Infinity or NaN reaching a CSS value.
 */
export function labelCounterScale(zoom: number): number {
  if (typeof zoom !== 'number' || !Number.isFinite(zoom) || zoom <= 0) return 1
  return 1 / Math.min(1, Math.max(zoom, LABEL_LEGIBLE_ZOOM))
}

/**
 * The rendered size, in CSS px, of canvas text declared at `declaredPx` when the
 * viewport sits at `zoom` and the counter-scale above is applied.
 *
 * Exported because it is the ONLY honest way to make a legibility claim in a
 * jsdom test: jsdom has no layout, so a passing DOM assertion proves a class is
 * present and proves nothing about size on screen. Specs assert this arithmetic
 * instead, and say so.
 */
export function renderedLabelPx(declaredPx: number, zoom: number): number {
  return declaredPx * labelCounterScale(zoom) * zoom
}

/**
 * The CSS custom property that carries `labelCounterScale` into the canvas type
 * tokens. Set on the React Flow root by `CanvasLabelScaleSync`; unset (and
 * therefore 1, via each token's `var()` fallback) everywhere else, so panel and
 * inspector copy is untouched.
 */
export const CANVAS_LABEL_SCALE_VAR = '--canvas-label-scale'
