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
 *
 * ⭐⭐ AND THAT SECOND BULLET WAS PROSE ONLY — THE CODE DID THE OPPOSITE, FOR
 * WEEKS, AND NOTHING WENT RED (31 Aug 2026, found while fixing #1051).
 * `ReactFlowGraph.handleFitView` and the command palette's "Zoom to Fit" both
 * passed `minZoom: LABEL_LEGIBLE_ZOOM`, so on any model whose whole-model fit
 * sits below 0.5 — which is every model the extent notice appears for — the
 * left-rail control could not show the whole model however many times it was
 * pressed. The paragraph above says explicit user gestures are unfloored; the
 * gesture was floored. A doctrine paragraph and its implementation drifting
 * apart with no mechanism between them is this estate's dominant defect class
 * (CLAUDE.md trap 12), and here it was inside the file that owns the doctrine.
 *
 * `e2e/canvas.lod-disclosure.spec.ts` still carries the measurement from before
 * the drift — the same control landing at **0.344** at 834x1112, which the floor
 * makes arithmetically impossible — and its header states flatly that "the
 * manual fit never passes a `minZoom`". Two files describing behaviour the code
 * had stopped having, and neither could fail.
 *
 * ⭐ SO THE TWO CLASSES ARE NOW A FUNCTION, NOT A PARAGRAPH: `fitBoundsFor`
 * below. Every fit that means to be bounded by legibility asks it, naming the
 * class it belongs to, and `zoomLegibilitySingleSource.spec.ts` REDs on any fit
 * that sets `minZoom`/`maxZoom` from these constants by hand. The prose can no
 * longer drift from the behaviour without something going red.
 */

/**
 * Below this zoom node labels are hidden (level-of-detail); at or above it they
 * render. The one number; do not restate it anywhere else.
 */
export const LABEL_LEGIBLE_ZOOM = 0.5

/**
 * WHO ASKED FOR THIS FIT — the only distinction the legibility bounds make.
 *
 * `'user'` is a control the person pressed: "Show whole model", the left-rail
 * "Fit to view", the palette's "Zoom to Fit". `'product'` is the canvas fitting
 * itself: after a layout, after a restore, after the reserved box changes.
 *
 * It is deliberately the SAME two classes `utils/userCameraClaim.ts` divides the
 * camera by, because it is the same rule — *"the user may choose the overview,
 * the product may not choose it for them"* — and the two halves of that rule
 * were separately half-implemented before #1051. `zoomLegibilitySingleSource`
 * asserts the two lists agree, so a site cannot claim the camera as the user's
 * and then fit under the product's bounds, or the reverse.
 */
export type FitInitiator = 'user' | 'product'

/**
 * The `minZoom` / `maxZoom` a fit of this class runs under, spread into the
 * `fitView` options: `fitView({ ..., ...fitBoundsFor('user') })`.
 *
 * A USER fit gets NEITHER bound. That is not "no opinion" — it is the opinion:
 * the only limits on a view the user asked for are the canvas instance's own
 * (`minZoom={0.1}`, `maxZoom={4}`), and the honest way to use those is to not
 * restate them. `options?.minZoom ?? minZoom` in xyflow's `fitViewport` falls
 * through to the instance exactly when the field is absent or `undefined`, so
 * spreading an empty object and omitting the keys are the same call.
 *
 * A PRODUCT fit gets both: the legibility floor, because an automatic fit that
 * parks in the unreadable band is the product choosing a bad view for someone;
 * and `AUTO_FIT_MAX_ZOOM`, because a degenerate bounding box otherwise magnifies
 * to the instance ceiling (a witnessed canvas sat at 328%).
 */
export function fitBoundsFor(initiator: FitInitiator): { minZoom?: number; maxZoom?: number } {
  return initiator === 'product' ? { minZoom: LABEL_LEGIBLE_ZOOM, maxZoom: AUTO_FIT_MAX_ZOOM } : {}
}

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
 * The LARGEST counter-scale canvas label text can ever carry.
 *
 * ⭐ THIS IS THE COUPLING BETWEEN THE LABEL SCALE AND NODE GEOMETRY. Read this
 * before changing either.
 *
 * `labelCounterScale` is bounded above by construction (see its derivation), and
 * the bound is reached at exactly `LABEL_LEGIBLE_ZOOM` — which is also where a
 * post-draft auto-fit parks, because `useFitViewOnLayoutVersion` passes that
 * value as `minZoom`. So the settle zoom IS the worst case, and the worst case
 * is a CONSTANT rather than a number that has to be tracked at runtime.
 *
 * WHY GEOMETRY USES THE BOUND AND NOT `labelCounterScale(zoom)` ITSELF (the
 * defect this closes, measured 17 Aug 2026): `#758` counter-scaled the FONT and
 * left node geometry alone, so at the settle zoom a title measure sized for
 * 13px text was holding 26px text. 59 of 174 rendered node titles across the
 * five shipped starters broke MID-WORD — "Stripe Middlewa|re", "Engineerin|g
 * Overload". The font grew; the box did not.
 *
 * Geometry cannot simply track `labelCounterScale(zoom)`, because node POSITIONS
 * come from a layout that runs on `layoutVersion`, not on zoom: cards that
 * resized as the user zoomed would slide out of the boxes ELK placed them in,
 * and a layout that re-ran on zoom would feed its own fit (a wider graph fits at
 * a lower zoom, which raises the counter-scale, which widens the graph). Sizing
 * for the BOUND is stable, needs no relayout, and is correct at the only zoom
 * the product ever chooses for the user.
 *
 * Consumers: `nodeLayoutConstants.ts` (`NODE_TITLE_MIN_MEASURE_PX`,
 * `NODE_LAYOUT_MIN_W`). Changing `LABEL_LEGIBLE_ZOOM` moves the font scale and
 * the geometry together, in one decision — which is the whole point.
 */
export const MAX_LABEL_COUNTER_SCALE = labelCounterScale(LABEL_LEGIBLE_ZOOM)

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

/**
 * ⭐⭐ WHICH React Flow INSTANCE THE LABEL SCALE BELONGS TO — the ONE answer, so
 * the writer and the reader cannot drift on it (CLAUDE.md trap 12).
 *
 * `CanvasLabelScaleSync` renders this marker as a child of the MAIN `<ReactFlow>`
 * and walks UP from it (`markerRef.current.closest('.react-flow')`), on the
 * stated grounds that `document.querySelector('.react-flow')` *"would reach the
 * Compare-tab mini-maps and any other React Flow instance on the page"*. Anyone
 * who has to find the SAME root must ask the same question the same way.
 *
 * ⚠ AND THIS IS NOT A STYLE RULE — IT DECIDES WHOSE CARDS GET MEASURED.
 * `ReactFlowGraph.tsx` renders comparison mode as a TERNARY, so while it is on
 * the main canvas is unmounted and the only roots on the page are two
 * `<MiniCanvas>` instances rendering THE SAME graph's node ids, un-re-keyed. A
 * document-rooted lookup binds to the first of those and returns a mini-map's
 * heights under the real nodes' ids — and because
 * `layoutGraph`'s `getNodeDimensions` PREFERS a supplied bound height, the
 * "absent ⇒ fall through" safety never engages: the ids are present and wrong.
 * Demonstrated by probe: one root → `{n1:300, n2:280}`; two roots →
 * `{n1:90, n2:84}`, i.e. the first root's.
 *
 * Selecting from the marker degrades to the DESIGNED inert path instead: no
 * marker, no root, empty map, `measured.height` as before.
 */
export const CANVAS_LABEL_SCALE_MARKER_TESTID = 'canvas-label-scale-sync'

/** The selector that finds the marker above. Derived, never restated. */
export const CANVAS_LABEL_SCALE_MARKER_SELECTOR = `[data-testid="${CANVAS_LABEL_SCALE_MARKER_TESTID}"]`

/**
 * ⭐⭐ THE CEILING THE AUTO-FIT MUST NOT CROSS — the other end of the band.
 *
 * `LABEL_LEGIBLE_ZOOM` stops the product parking the camera somewhere too small
 * to read. Nothing stopped the opposite, and the opposite shipped: on a fresh
 * fundraising brief the layout engine threw, the product's own fit never ran,
 * and the canvas kept xyflow's bare mount `fitView` — bounded only by the
 * instance's `maxZoom={4}`. Framing one ~300px node in a 1092×878 canvas gave
 * **328%**. The model was legible in the sense that a single enormous card is
 * legible, and unusable in every sense that matters.
 *
 * A floor with no ceiling is half a band. The doctrine at the top of this module
 * says the product must never AUTOMATICALLY choose an unreadable view; choosing
 * an absurdly magnified one is the same failure pointing the other way.
 *
 * WHERE THE NUMBER COMES FROM, and why it is not a preference: this module
 * already names the boundary — counter-scaling "never exceeds 1 once the user
 * zooms in past 1:1 (magnification is then the user's own deliberate choice)".
 * So 1:1 is exactly where the product stops compensating and the user takes
 * over, and an AUTOMATIC fit has no business past it.
 *
 * ⚠⚠ THIS WAS WRITTEN AS `labelCounterScale(1)`, AND THAT WAS A FALSE CLAIM
 * ABOUT OUR OWN VERIFICATION — withdrawn here rather than quietly deleted
 * (CLAUDE.md trap 14). It read as "derived, so it moves with the contract". It
 * moves with nothing: `labelCounterScale(z) = 1 / min(1, max(z, FLOOR))`, and
 * `max(1, x) >= 1` for every `x`, so the expression is **1 for every possible
 * input** — refuted by simulation across `{0.1 … 4}`, ten identical values. It
 * also laundered a bare `1` past `zoomLegibilitySingleSource`, whose regex
 * matches a numeric literal and cannot see a call expression.
 *
 * The VALUE was right and the JUSTIFICATION was not, which is the more dangerous
 * half — a wrong number gets caught by a test, a wrong reason gets inherited. So
 * the number is stated plainly below and the single-source spec now NAMES it as
 * the second permitted constant: visible to the guard rather than hidden from it.
 * That spec's rule was never "one number" — it is "no SECOND copy of a number
 * that already has a home", and a floor and a ceiling are different quantities.
 *
 * As with the floor, this binds the PRODUCT's automatic fits only. Explicit user
 * gestures — scroll-zoom, the zoom controls, the toolbar's fit button — stay
 * unclamped by design.
 */
export const AUTO_FIT_MAX_ZOOM = 1
