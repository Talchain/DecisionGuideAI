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
import { CANVAS_TYPE_PX } from '../../styles/typography'


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
/**
 * ⭐⭐ IS THE CONTENT BOX DEGENERATE? — the discrimination `AUTO_FIT_MAX_ZOOM`
 * was standing in for (12 Sep 2026).
 *
 * ⚠ DEFINED POSITIONALLY, FROM THE ACTUAL MECHANISM, not from a size threshold.
 * `applyDraftResult.ts:50` returns `position: { x: 0, y: 0 }` UNCONDITIONALLY for
 * every drafted node — it is the only position reference in that file — so at the
 * instant React Flow's element-level fit first runs, every node is stacked at the
 * origin. The box is then degenerate **by position even when measurement has
 * completed**, which is why a measurement-based test (`nodesInitialized`, node
 * dimensions) does not discriminate it and a positional one does.
 *
 * So: a box is degenerate when its occupants do not occupy at least two DISTINCT
 * positions. That needs no length constant, which also keeps this module free of
 * `nodeLayoutConstants` — which imports `MAX_LABEL_COUNTER_SCALE` from here, so
 * the reverse import would be a cycle.
 *
 * ⚠ FEWER THAN TWO NODES IS DEGENERATE TOO, deliberately. A single card carries
 * no extent to fit against, and magnifying it to fill a pane is the same defect
 * with a smaller cast.
 */
export function layoutBoxIsDegenerate(
  nodes: ReadonlyArray<{ position?: { x?: number; y?: number } | null }>,
): boolean {
  const seen = new Set<string>()
  for (const node of nodes) {
    const x = node?.position?.x
    const y = node?.position?.y
    if (typeof x !== 'number' || typeof y !== 'number') continue
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue
    seen.add(`${x},${y}`)
    if (seen.size > 1) return false
  }
  return true
}

/**
 * ⛔ RE-SURFACE TRIGGER — so this does not become built-and-unplugged.
 *
 * This mechanism is DORMANT by deliberate choice, and a dormant mechanism with
 * no named trigger is how this estate loses work (CLAUDE.md chronic failure 2:
 * "we lose schedulers, not records"). The trigger is a DEPENDENCY, not a date:
 *
 *   WHEN the ReactFlow element's own bare `fitView` prop (`maxZoom={4}` on the
 *   `<ReactFlow>` element) is repaired so it cannot fire against a degenerate
 *   box, THEN pass the verdict at the single call site in
 *   `useFitViewOnLayoutVersion.ts` and this turns on in one line.
 *
 * Until then the blanket cap is doing TWO jobs and one of them is load-bearing:
 * it is also the net under that element-level fit. Removing it removes the net.
 *
 * ⭐ ITS INERTNESS IS FAIL-LOUD, NOT MERELY FAIL-CLOSED — measured by an
 * adversarial reviewer (github-a4, 12 Sep 2026) rather than claimed by the
 * author: flipping the default `true -> false` REDs 7 tests across 4 files
 * (`useFitViewOnLayoutVersion`, `ReactFlowGraph.layoutLifecycle.integration`,
 * `autoFitLegibility`, `fitDegeneracyDiscrimination`), three of which were not
 * written for this change. So it cannot turn itself on quietly.
 */
/**
 * ⭐⭐ THE CEILING NOW ANSWERS ONE QUESTION, NOT TWO (12 Sep 2026).
 *
 * `AUTO_FIT_MAX_ZOOM` was a blanket cap on every product fit, and it was doing
 * two jobs under one name — CLAUDE.md trap 21:
 *
 *   1. *"do not magnify a DEGENERATE box"* — correct, load-bearing, and the
 *      reason a witnessed canvas sat at 328%. It stays, unchanged, for exactly
 *      that case.
 *   2. *"do not scale a VALID box up to a wide pane"* — wrong, and it was the
 *      measured cause of the graph occupying ~61% of a 1730px screen. Founder
 *      Ruling R1 makes the CAMERA the answer to viewport width ("responsive
 *      behaviour happens through camera/focus/disclosure, not persisted
 *      re-layout") — and then this cap forbade the camera from doing it.
 *
 * ⛔ THE FIX IS NOT TO DELETE THE CEILING. Copying the user fit's unbounded
 * `{}` here would reopen the 328% defect; that was proposed during the 11 Sep
 * zoom investigation and caught by reading the two call sites.
 *
 * ⚠ `boxIsDegenerate` DEFAULTS TO `true` — FAIL-CLOSED. A caller that does not
 * yet answer the question gets today's behaviour byte for byte, so this cannot
 * silently widen to a fit that has not been considered.
 *
 * ⭐ THE VALID-BOX CEILING IS `MAX_LABEL_COUNTER_SCALE`, DERIVED RATHER THAN
 * PICKED. That constant is already the product's statement of how far rendered
 * text may deviate from its declared size — it is what the counter-scale is
 * allowed to reach at the legibility floor. Using it above 1 makes the bound
 * symmetric: text may be magnified as far up as the ladder magnifies it down.
 * It introduces no third zoom literal, which `zoomLegibilitySingleSource.spec.ts`
 * forbids outright.
 */
export function fitBoundsFor(
  initiator: FitInitiator,
  boxIsDegenerate: boolean = true,
): { minZoom?: number; maxZoom?: number } {
  if (initiator !== 'product') return {}
  return {
    minZoom: LABEL_LEGIBLE_ZOOM,
    maxZoom: boxIsDegenerate ? AUTO_FIT_MAX_ZOOM : MAX_LABEL_COUNTER_SCALE,
  }
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
 * ⭐ v3.1 WS1 #25 (26 Sep 2026): THE FAR-ZOOM TITLE — "Far zoom: readable
 * identity and a simple attention cue" (contract v3.1 `.far-example`: a white
 * chip with a 9px name and a shape dot).
 *
 * Below `LABEL_LEGIBLE_ZOOM` the counter-scale is capped, so a title renders at
 * `14 × MAX_LABEL_COUNTER_SCALE × zoom`: 9.8px at 0.35, 4.7px at 0.167 (the
 * gap report's six zoom-outs). At the `line` rung — and only there — the title
 * may grow further, to the contract's far-chip size, so the card keeps a
 * READABLE name. Bounded above so a deliberate zoom-out to the instance floor
 * cannot inflate a title past twice the landing bound.
 *
 * Only the `line` rung's title reads it (`BaseNode`); every other surface stays
 * on `labelCounterScale`.
 */
export const FAR_TITLE_PX = 9
export const FAR_TITLE_MAX_SCALE = 2 * MAX_LABEL_COUNTER_SCALE

export function farTitleScale(zoom: number): number {
  const base = labelCounterScale(zoom)
  if (typeof zoom !== 'number' || !Number.isFinite(zoom) || zoom <= 0) return base
  return Math.min(FAR_TITLE_MAX_SCALE, Math.max(base, FAR_TITLE_PX / (CANVAS_TYPE_PX.nodeTitle * zoom)))
}

/** The CSS custom property that carries `farTitleScale` (set beside `CANVAS_LABEL_SCALE_VAR`). */
export const CANVAS_FAR_TITLE_SCALE_VAR = '--canvas-far-title-scale'

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
 * ⭐⭐ THE MARK ON A CARD BODY THAT IS COLLAPSED BY LEVEL-OF-DETAIL — named here
 * for the same reason the label-scale marker is: it has a WRITER and a READER in
 * different modules, and a literal in each is a hand-maintained mirror (trap 12).
 *
 * WRITER: `BaseNode` puts it on the body wrapper whenever `lodBodyBlanked`, i.e.
 * at the `line` rung with a reduced line to stand in for the body. It is paired
 * with `LOD_BLANKED_BODY_STYLE`, whose `height` is ONE LINE rather than the
 * body's own — the card is genuinely short at that rung, not merely invisible.
 *
 * READER: `measureNodeHeightsAtLabelBound` must UNDO that collapse for the
 * duration of its read. Its contract is "the height this card has AT THE LABEL
 * BOUND", and the bound is the scale at `LABEL_LEGIBLE_ZOOM` — a zoom at which
 * the body is VISIBLE and at full height. Measuring a collapsed body and calling
 * the answer "the height at the bound" is not an approximation of that contract,
 * it is a different number.
 *
 * ⚠ THE ATTRIBUTE IS THE CONTRACT, NOT ITS VALUE. Several specs assert the
 * rendered value `"true"`; the selector below matches on PRESENCE, so a future
 * value change cannot silently unbind the reader.
 */
export const LOD_BLANKED_BODY_ATTR = 'data-lod-hidden'

/** The selector that finds a collapsed card body. Derived, never restated. */
export const LOD_BLANKED_BODY_SELECTOR = `[${LOD_BLANKED_BODY_ATTR}]`

/**
 * ⭐ v3.1 WS1 #25: the mark on a title drawn as the FAR-rung identity chip
 * (clamped, at `CANVAS_FAR_TITLE_SCALE_VAR`). Same writer/reader pair as the
 * blanked body: `BaseNode` writes it at the `line` rung, and
 * `measureNodeHeightsAtLabelBound` lifts the clamp and pins the far scale to
 * the bound while it reads, so a layout that runs while zoomed out still
 * reserves the title's full height at the landing rung.
 */
export const LOD_FAR_TITLE_ATTR = 'data-lod-far-title'

/** The selector that finds a far-rung title. Derived, never restated. */
export const LOD_FAR_TITLE_SELECTOR = `[${LOD_FAR_TITLE_ATTR}]`

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

/* ── the semantic-zoom LADDER ──────────────────────────────────────────────── */

/**
 * ⭐ WHY THERE IS A THIRD RUNG (Paul, 1 Sep 2026, on the deployed build):
 * *"the canvas gets LESS readable as the model gets bigger."*
 *
 * Level-of-detail was a BOOLEAN, so the canvas had two states: the whole card,
 * or a card with its body blanked. Measured across all ten shipped starter ×
 * viewport combinations, "Show whole model" parks between zoom 0.26 and 0.38 and
 * never above 0.44 — entirely inside the blanked half. So the view a user asks
 * for in order to see the SHAPE of their model is the least informative view the
 * product can render, and a boolean has nowhere to put "smaller, but not blank".
 *
 * The rungs, from the top:
 *   `full`   — everything the card has.
 *   `quiet`  — labels are legible but a 14px mark is not; the band where detail
 *              should thin out rather than vanish.
 *   `line`   — below the legibility floor: body hidden, title and one reduced
 *              line only. This is exactly the old `lodActive === true`.
 *
 * ⚠ `quiet` IS DELIBERATELY UNSPENT AT THIS TIP. It behaves identically to
 * `full`, and `BaseNode.lodQuietIsNoOp.spec.tsx` proves that by comparing the
 * rendered DOM. Creating the rung and spending it are two changes on purpose:
 * the second is visible on every canvas and is gated on a design veto, and
 * shipping them together would make an invisible refactor unreviewable.
 */

/**
 * The smallest text the canvas is allowed to render, in CSS pixels.
 *
 * `DESIGN_SYSTEM.md` § Typography → Canvas Nodes gives `edgeLabel` as 10px — the
 * smallest canvas token there is — and § Typography → Rules states it as a
 * range: *"Panel and canvas contexts use 10–12px for information density"*. Ten
 * is the floor of that range.
 */
export const CANVAS_TEXT_FLOOR_PX = 10

/**
 * A canvas node badge, in CSS pixels.
 *
 * `DESIGN_SYSTEM.md` § Iconography → Sizing: *"Canvas node badge / panel inline
 * | 14px | `w-3.5 h-3.5`"*.
 */
export const CANVAS_BADGE_ICON_PX = 14

/**
 * The zoom at which a canvas badge shrinks to the canvas text floor.
 *
 * ⭐ NOBODY CHOSE THIS NUMBER, AND THAT IS THE WHOLE POINT. A 14px mark drawn at
 * zoom z occupies 14z screen pixels; it reaches the 10px floor at exactly 10/14
 * ≈ 0.714. Written as the quotient rather than as its value so the number cannot
 * drift from its reason — the estate's dominant defect is a hand-maintained
 * mirror, and a rounded `0.714` sitting beside a comment explaining where 0.714
 * came from is precisely that (CLAUDE.md trap 12).
 *
 * ⚠ IT MUST STAY IDENTIFIER-LED. `zoomLegibilitySingleSource.spec.ts` permits
 * exactly two bare zoom literals under `src/canvas`, both in this file; this
 * constant is legal only because it is genuinely derived. That spec now carries
 * the detector-contract case proving a bare-literal spelling of this same name
 * WOULD be caught, and pins the scan's known blind spot (a TRAILING literal,
 * `X * 0.714`, escapes it) as exactly itself.
 */
export const ICON_LEGIBLE_ZOOM = CANVAS_TEXT_FLOOR_PX / CANVAS_BADGE_ICON_PX

/** A rung of the semantic-zoom ladder. See the block comment above. */
export type LodRung = 'full' | 'quiet' | 'line'

/**
 * Which rung a zoom sits on.
 *
 * ⚠ NaN RESOLVES TO `line`, AND THAT IS A PORT RATHER THAN A NEW OPINION. The
 * predicate this replaces was `!(zoom >= LABEL_LEGIBLE_ZOOM)`, and `NaN >= 0.5`
 * is false — so a torn-down or not-yet-measured viewport already read as
 * level-of-detail active. Expressing the floor test in that same negated form
 * keeps the behaviour bit-for-bit; `zoomLadder.spec.ts` asserts the agreement
 * with `isLodZoom` across the range rather than asserting `'line'` outright, so
 * the two cannot drift apart silently.
 */
/**
 * ⭐⭐⭐ THE LEVEL-OF-DETAIL CLIFF IS NO LONGER THE LEGIBILITY FLOOR.
 *
 * These were ONE number answering TWO questions, which is this estate's
 * signature defect (CLAUDE.md trap 21):
 *
 *   Q1  "is rendered text still at its declared size?"  → LABEL_LEGIBLE_ZOOM
 *       This is the COUNTER-SCALE question. It governs `labelCounterScale`,
 *       `isLodZoom` and the product's own auto-fit floor. **Unmoved.**
 *   Q2  "should a card stop showing its body?"          → LOD_BODY_HIDDEN_ZOOM
 *       This is the PRESENTATION question, and it is what the founder
 *       experiences as the board flipping to coloured blocks.
 *
 * ⛔ WHY THEY HAD TO SEPARATE, MEASURED RATHER THAN ARGUED. `fitBoundsFor`
 * floors the product's own automatic fit at `LABEL_LEGIBLE_ZOOM`, and while the
 * two numbers were the same value the auto-fit PARKED THE CAMERA EXACTLY ON THE
 * CLIFF — measured 0.5 in 10 of 10 committed starter × viewport rows in
 * `evidence/zoom-ladder-2026-09-02/after-ladder.json`. Downward travel from the
 * default camera to the flip was NIL. One trackpad nudge, one wheel notch, or
 * one press of the toolbar's zoom-out (÷1.2) reduced the whole board.
 *
 * The founder hit this in manual testing on 19 Sep and put it plainly: *"you
 * only have to zoom in a little bit for the graph to change to the small
 * coloured option. Is that really an optimal user experience?"* It was not.
 *
 * ⚠ THE FLOOR ITSELF IS DELIBERATELY NOT RAISED, and the direction matters.
 * Raising the auto-fit floor would keep the camera clear of the cliff by
 * REFUSING TO FIT LARGE MODELS — the fit is already clamped at 0.5 precisely
 * where a model is too big to show whole, so a higher floor clips exactly the
 * boards that need the overview most. Lowering the CLIFF costs nothing and buys
 * the same margin.
 *
 * ⚠ `zoomLadder.spec.ts` asserted these two agree across the range, with the
 * note "the floor is not this PR's to move". That guard did its job: it made
 * this a deliberate, argued change instead of a silent one. It is updated in
 * the same commit to pin the SEPARATION rather than the agreement.
 */
/**
 * The zoom below which a card hides its body: the point at which its body text
 * falls under the design system's floor.
 *
 * ⭐⭐ DERIVED, NOT PICKED — AND THE FIRST VERSION OF THIS WAS PICKED.
 * It read `LABEL_LEGIBLE_ZOOM * 0.75`, a ratio chosen because it looked like
 * enough headroom, in a module whose whole argument is that thresholds must be
 * derived. Review caught it. The honest cliff is the one the type system already
 * implies:
 *
 *   below `LABEL_LEGIBLE_ZOOM` the counter-scale has capped at
 *   `MAX_LABEL_COUNTER_SCALE`, so rendered body text is
 *   `nodeLabel * MAX_LABEL_COUNTER_SCALE * zoom` — which reaches
 *   `CANVAS_TEXT_FLOOR_PX` at exactly this zoom.
 *
 * So the card stops showing its body precisely when that body stops being
 * legible by the DS's own definition, and not one notch earlier. Measured:
 * 0.41667, which renders `nodeLabel` at exactly 10.00px.
 *
 * ⭐ AND IT LANDS EXACTLY ON THE TOOLBAR'S OWN STEP. The product's auto-fit
 * floors at `LABEL_LEGIBLE_ZOOM` and the zoom-out button steps by 1.2, and
 * `CLIFF`, `0.5 / 1.2` and `0.5 * (1 / 1.2)` — the last being what xyflow's
 * `scaleBy` actually computes — are the SAME DOUBLE to full precision.
 *
 * ⚠ SO IT TAKES TWO PRESSES, NOT ONE, and an earlier version of this comment
 * said one. The first press lands ON the cliff, where `zoom >= floor` holds, so
 * the body stays and text is at exactly 10.00px. The behaviour is better than
 * the claim was; the claim was still wrong and is corrected rather than quietly
 * improved.
 *
 * ⛔ AND DO NOT LEAN ON THE COINCIDENCE. It holds only while body text is 12px:
 * `nodeLabel` moved 11 -> 12 four days ago, and at 11 the cliff would be 0.4545
 * and one press WOULD cross. The derivation is the load-bearing thing here — the
 * alignment with the button step is a pleasant consequence, not a design.
 *
 * ⛔ WHY THE FLOOR ITSELF IS NOT MOVED. `fitBoundsFor('product')` floors the
 * product's own fit at `LABEL_LEGIBLE_ZOOM`, and it is clamped there exactly
 * where a model is too big to show whole — so raising it would clip the boards
 * that most need an overview. Lowering the CLIFF costs nothing and buys the
 * travel. The counter-scale question (`isLodZoom`, `labelsRenderedAtZoom`) is a
 * DIFFERENT question and is untouched (trap 21).
 *
 * ⚠ WHAT THIS CHANGES, STATED: across the WHOLE band [0.41667, 0.5) a card now
 * shows its body where it previously did not — body text renders 10.00px at the
 * cliff and 12.00px at the floor, legible throughout. An earlier version of this
 * sentence said "0.44-0.4999" and silently omitted [0.41667, 0.44), which also
 * changes; the omission made the blast radius look smaller than it is.
 *
 * ⚠ WHO PARKS THERE. `fitBoundsFor` splits fits into two CLASSES, but there
 * are THREE paths, and the third is the one that matters:
 *   · PRODUCT, via `useFitViewOnLayoutVersion` — spreads `fitBoundsFor('product')`,
 *     so it is FLOORED at `LABEL_LEGIBLE_ZOOM` (0.5) and cannot land here.
 *   · USER, via `fitBoundsFor('user')` → `{}` — unbounded by design, so "show me
 *     the whole model" can.
 *   · ⛔ PRODUCT, via the canvas element's own bare `fitView` prop
 *     (`ReactFlowGraph.tsx`, `<ReactFlow … fitView minZoom={0.1} maxZoom={4}>`)
 *     — it passes NO `fitViewOptions`, so it never consults `fitBoundsFor` at
 *     all and is bounded only by `minZoom={0.1}`. **A product fit CAN park
 *     here, by that path.** `useFitViewOnLayoutVersion` names the hazard in its
 *     own prose, and nothing guards it: `zoomLegibilitySingleSource` bans
 *     hand-set legibility CONSTANTS, not unbounded fits.
 *
 * ⛔ TWO VERSIONS OF THIS SENTENCE HAVE NOW BEEN WRONG, IN OPPOSITE DIRECTIONS,
 * AND BOTH ARE KEPT BECAUSE THE PAIR IS THE LESSON.
 *   · It first read "Real fits park inside it — 0.4456, 0.4509, 0.488, 0.49 and
 *     0.4935", merging four provenances into one claim.
 *   · The correction then read "a PRODUCT fit CANNOT park in this band", which
 *     is true of the hook and FALSE of the element's own `fitView`. Fixing an
 *     over-broad claim with its over-broad inverse is this estate's trap 22b at
 *     the level of a comment.
 *
 * THE FOUR CLASSES BEHIND THE FIVE FIGURES, each named rather than pooled:
 *   · 0.4456 / 0.4509 — the ORIGINAL DEFECT measurements (this file's header,
 *     :8 and :11). Pre-floor product fits; the hook path cannot reproduce them.
 *   · 0.4935 — the FRESH-BOARD DEFAULT (`BaseNode.tsx`,
 *     `measureNodeHeightsAtLabelBound.ts`), i.e. product class. ⚠ And not a
 *     camera reading at all: it is a computed pane/layout ratio.
 *   · 0.488 — the USER path, "Show whole model" (`lodMetricLine.ts`).
 *   · 0.49 — a DEPLOYED measurement: 14 of 16 cards rendered an empty box at
 *     that zoom (`lodMetricLine.ts`, corroborated in `cardCopyCensus`).
 *
 * So the band is reached on the product path AND by the founder's own zoom-out
 * gesture — which is the complaint — and hiding the body here was the
 * over-eager half of it. Below 0.41667 nothing changes.
 */
export const LOD_BODY_HIDDEN_ZOOM = CANVAS_TEXT_FLOOR_PX / (CANVAS_TYPE_PX.nodeLabel * MAX_LABEL_COUNTER_SCALE)

/**
 * How far past the cliff a zoom must climb before the body comes BACK.
 *
 * ⭐ WITHOUT THIS THE RUNG FLAPS. `LodSync` recomputes the rung from the raw
 * viewport on every tick, so a single sharp comparison means a camera resting on
 * the boundary toggles the entire board on sub-pixel jitter — and a trackpad
 * pinch delivers a stream of values, not one. An absence sweep over `src/**`
 * found `hysteresis|deadband|dead-band` → 1 hit, unrelated; contrast controls in
 * the same sweep: `debounce` → 109 files, `throttle` → present. The codebase
 * knows how to do this and simply had not done it here.
 *
 * Expressed as a ratio so it cannot drift from the cliff it guards.
 */
/**
 * ⚠ ONE CONSTANT, TWO DEAD-BANDS, AND THEY DO NOT SHARE A SAFE RANGE.
 * This margin now sets re-entry at BOTH the body cliff and the icon floor.
 * Mutation-measured: at 1.30 a test on EACH boundary REDs, for different
 * reasons. The harm is unreachable today because the body pin bites first, but
 * a future change that relaxes the body pin would silently widen the icon
 * dead-band too. Split it before that happens, not after.
 *
 * ⚠ AND THE SUITE BOUNDS THIS, IT DOES NOT PIN IT. The arms assert the
 * dead-band EXISTS; the value survives anywhere in roughly [1.001, 1.111).
 * Bounded is not pinned and should not be described as pinned.
 */
const LOD_REENTRY_MARGIN = 1.08

/** The zoom at or above which a hidden body is restored. */
export const LOD_BODY_RESTORED_ZOOM = LOD_BODY_HIDDEN_ZOOM * LOD_REENTRY_MARGIN

/**
 * Which rung is this zoom on?
 *
 * ⚠ `previous` IS THE HYSTERESIS, AND IT IS OPTIONAL ON PURPOSE. Called with one
 * argument this is the old pure function with the new cliff — which is what
 * every existing caller and spec that asks "what rung is 0.42?" still wants.
 * `LodSync` passes the live previous rung, so only the SEQUENCE seen by a real
 * camera gets the dead-band. A stateless caller cannot accidentally inherit a
 * stale opinion from a render it did not perform.
 *
 * ⚠ NaN still resolves to `line`, unchanged: `NaN >= x` is false for every x, so
 * a torn-down or not-yet-measured viewport reads as reduced exactly as before.
 */
/**
 * ⭐⭐⭐ THE `full` FLOOR IS THE LANDING FLOOR, NOT THE ICON-LEGIBILITY QUOTIENT
 * (gap-audit row 3, `canvas/gap-landing-normal`, Paul confirmed 24 Sep 2026:
 * "the landing view counts as Normal zoom").
 *
 * ⛔ THIS WAS `ICON_LEGIBLE_ZOOM` (10/14 ≈ 0.714), AND THAT DERIVATION NEVER
 * DESCRIBED THE GLYPHS IT WAS GATING. It states "a 14px mark at zoom z occupies
 * 14z screen pixels" — true of an UNSCALED glyph, and false of every glyph the
 * gate actually controls: the coaching icon, the rail's evidence/behaviour
 * icons, the corner coaching marker and `FactorNode`'s driver cue are all
 * `CANVAS_GLYPH_SIZE_CLASSES[N]` — `calc(Npx * var(--canvas-label-scale,1))`,
 * counter-scaled by `labelCounterScale`. That counter-scale is capped at
 * `MAX_LABEL_COUNTER_SCALE` (`1/LABEL_LEGIBLE_ZOOM`) reached exactly at the
 * landing floor, so a glyph's RENDERED size there is
 * `declaredPx * MAX_LABEL_COUNTER_SCALE * LABEL_LEGIBLE_ZOOM = declaredPx` — its
 * full declared size, not the halved size the old threshold assumed. The gate
 * was never protecting a legibility the counter-scale had not already bought.
 *
 * ⭐ MEASURED CONSEQUENCE: the landing fit is clamped to
 * `[LABEL_LEGIBLE_ZOOM, 1]` (`fitBoundsFor('product')`), and fresh models land
 * at ~0.5–0.53 — inside the OLD `quiet` rung, which started only at
 * `ICON_LEGIBLE_ZOOM`. So first sight of every model carried no coaching icon,
 * no rail data icons and no driver cue — the gap this closes.
 *
 * `ICON_LEGIBLE_ZOOM` is untouched and still a true, derived design-system
 * fact; it is simply no longer the question this gate asks.
 */
export function resolveLodRung(zoom: number, previous?: LodRung): LodRung {
  const floor = previous === 'line' ? LOD_BODY_RESTORED_ZOOM : LOD_BODY_HIDDEN_ZOOM
  if (!(zoom >= floor)) return 'line'

  /**
   * ⭐ THE UPPER BOUNDARY KEEPS ITS OWN DEAD-BAND, ACROSS THE NEW FLOOR.
   *
   * `quiet`'s action chips unmount there, so a camera resting on the boundary
   * must not flap the chips on sub-pixel jitter. Same shape as the body cliff:
   * coming DOWN from `full`, the chips stay until the zoom clears the re-entry
   * margin below the (now lower) Normal floor.
   */
  const normalRungFloor = previous === 'full' ? LABEL_LEGIBLE_ZOOM / LOD_REENTRY_MARGIN : LABEL_LEGIBLE_ZOOM
  return zoom >= normalRungFloor ? 'full' : 'quiet'
}

/**
 * ⭐ THE LARGEST LABEL SCALE THE NORMAL (`full`) RUNG EVER DRAWS AT — its dead-band
 * exit. Coming DOWN from `full` the rung now holds until the zoom falls below
 * `LABEL_LEGIBLE_ZOOM / LOD_REENTRY_MARGIN` (≈0.463) — moved with the `full`
 * floor itself (`resolveLodRung`, gap-audit row 3, 24 Sep 2026) — so its scale
 * peaks at exactly `MAX_LABEL_COUNTER_SCALE`. This is a DELIBERATE reversal of
 * this constant's own former claim.
 *
 * ⛔ IT USED TO PEAK AT ≈1.51, STRICTLY BELOW `MAX_LABEL_COUNTER_SCALE`, WITH THE
 * COMMENT "`full` is NEVER drawn at `MAX_LABEL_COUNTER_SCALE`" — true while the
 * `full` floor was `ICON_LEGIBLE_ZOOM` (0.714), strictly above the landing floor
 * where the counter-scale caps. Now that `full` starts AT the landing floor
 * (`LABEL_LEGIBLE_ZOOM`), `full` DOES draw at the cap — every card at rest on
 * the landing view does, by construction — so a bound that stayed below it would
 * under-reserve for the state that is now the COMMON one, not a hypothetical.
 *
 * `measureNodeHeightsAtLabelBound` reads every card at BOTH rungs' own bound —
 * the landing rung at `MAX_LABEL_COUNTER_SCALE` with its landing padding, Normal
 * here with its Normal padding — and reserves the larger, so the reservation no
 * longer depends on which rung the camera happened to be at when the layout ran
 * (measured 24 Sep: the landing layout ran at zoom 2.85, Normal, ~0.9s before the
 * fit reached 0.53, and reserved the Normal band at scale 2 under every card —
 * 64–109-unit row gaps against the intended 48). That mechanism is UNCHANGED by
 * this file; only the scale it reads Normal's own padding at has moved, to the
 * value that state can now actually reach.
 */
export const MAX_NORMAL_RUNG_LABEL_SCALE = labelCounterScale(LABEL_LEGIBLE_ZOOM / LOD_REENTRY_MARGIN)

/**
 * The card root's padding at each rung, as JSON `{landing, normal}` of the four
 * padding longhands — written by `BaseNode`, read by the measurer. One attribute,
 * so the two rungs' boxes cannot be declared by two hands.
 */
export const NODE_RUNG_PADDING_ATTR = 'data-rung-padding'

/**
 * Whether a card hides its body at this rung — the ONE predicate every surface
 * that speaks about the blanked state must consume.
 *
 * ⛔ IT IS A FUNCTION SO THAT IT CANNOT BE RESTATED. `CanvasLodNotice` tells the
 * user the cards are showing less; `BaseNode` is what makes that true. Those two
 * were bound to one shared boolean, and `CanvasLodNotice.spec.tsx` exists
 * because a notice with its own zoom predicate could claim a state the nodes are
 * not in. Splitting the boolean into three rungs is exactly the moment that
 * binding would break by accident, so the shared thing is now named.
 */
export function lodBodyHiddenAt(rung: LodRung): boolean {
  return rung === 'line'
}

/**
 * The store selector both surfaces use, defaulting an absent rung to `full`.
 *
 * Undefined-safe by construction: around ten spec store doubles set this slice
 * by hand, and a double that omits it must render an ORDINARY card rather than a
 * blanked one. Typed structurally so this module stays free of any store import.
 */
export function selectLodBodyHidden(state: { lodRung?: LodRung }): boolean {
  return lodBodyHiddenAt(state.lodRung ?? 'full')
}

/**
 * ⭐⭐⭐ THE `quiet` RUNG, SPENT AT LAST — and what it buys is the reason this
 * graph reads as soup on the camera the product itself parks at.
 *
 * ## The measured chain (staging `c4ffd477`, 15 Sep 2026)
 *
 * 1. The ladder has three rungs. **Only `line` spent anything**: `lodBodyHiddenAt`
 *    is true at `line` alone, and `zoomLadder.spec.ts` says so in writing —
 *    *"an enum that makes a middle rung EXIST. It does not yet spend it."*
 * 2. `line` requires `zoom < LABEL_LEGIBLE_ZOOM`, i.e. **below 0.5**.
 * 3. `useFitViewOnLayoutVersion` passes `minZoom: LABEL_LEGIBLE_ZOOM`, and
 *    xyflow's `getViewportForBounds` does `clamp(zoom, minZoom, maxZoom)`.
 *    **The auto-fit therefore floors at exactly 0.5.**
 * 4. `quiet` is `[0.5, ICON_LEGIBLE_ZOOM)` = `[0.5, 0.714)`.
 *
 * ⇒ **The product's own default camera parks squarely inside the one rung that
 * changed nothing.** Every card rendered its full body, always. Neither half was
 * wrong — the LOD is correct, and the 0.5 floor is correct because it is what
 * keeps text legible. They were built by different lanes answering different
 * questions, and nothing connected them. That is trap 21 at the scale of the
 * whole visual system.
 *
 * ⛔ POINTS 3–4 NO LONGER DESCRIBE WHERE THE CAMERA PARKS (gap-audit row 3, 24
 * Sep 2026: "the landing view counts as Normal zoom"). `resolveLodRung`'s
 * `full` floor moved from `ICON_LEGIBLE_ZOOM` to `LABEL_LEGIBLE_ZOOM`, so the
 * auto-fit's 0.5 floor now parks in `full`, not `quiet`; `quiet` is
 * `[LOD_BODY_HIDDEN_ZOOM, LABEL_LEGIBLE_ZOOM)` and is reached only by zooming
 * OUT of the landing view. Kept here as the measured reasoning that made
 * `quiet` worth spending on the lens in the first place — that argument does
 * not depend on WHICH zoom band `quiet` occupies, only on `quiet` existing and
 * being reachable, which it still is (`zoomLadder.spec.ts`,
 * `theLensSpendsTheQuietRung.spec.ts`).
 *
 * ## Why the LENS is the right thing to spend it on
 *
 * Detail was a function of PIXEL SCALE. It should be a function of **relevance
 * to the question being asked**, and a lens IS a declared question — the user
 * picked it. So at `quiet`, a card the active lens has already set aside drops
 * its body and keeps its name.
 *
 * ⛔ **THE TITLE NEVER GOES.** Paul, on the deployed build, 30 Aug 2026: *"when I
 * zoom out of the graph, the content in it shouldn't disappear — it's a terrible
 * user experience."* That ruling is about ANONYMITY, and it stands: this hides a
 * body on a card the reader has deliberately de-emphasised, never a name. See
 * `BaseNode`'s `lodHideTitle = false` for the same ruling, applied there.
 *
 * ⚠ AND IT IS DELIBERATELY NOT A SECOND WAY TO BLANK A CARD. `CanvasLodNotice`
 * tells the user the cards are showing less and `BaseNode` is what makes that
 * true; those two are bound to ONE shared thing on purpose, because a notice
 * with its own predicate can claim a state the nodes are not in. This selector
 * is that one shared thing for the lens case, and both surfaces consume it.
 */
export function lensDetailSpentAt(rung: LodRung): boolean {
  return rung === 'quiet'
}

/**
 * Whether the active lens is currently standing in for zoom as the arbiter of
 * detail — true only at `quiet`, and only when the lens has actually set some
 * cards aside.
 *
 * ⚠ IT READS `_dimmedNodeIds.size`, NOT THE FLAG. With the Graph Lens off,
 * nothing populates that set, so the answer is false for the right reason. That
 * is a PRECONDITION rather than an assumption, and
 * `theLensSpendsTheQuietRung.spec.ts` pins it directly — if a future change ever
 * populates the set with the lens disabled, that spec REDs instead of this
 * silently switching on.
 */
export function selectLensDetailActive(state: {
  lodRung?: LodRung
  lens?: { _dimmedNodeIds?: ReadonlySet<string> } | null
}): boolean {
  if (!lensDetailSpentAt(state.lodRung ?? 'full')) return false
  return (state.lens?._dimmedNodeIds?.size ?? 0) > 0
}

/**
 * Whether a card shows its in-card controls at this rung.
 *
 * ⛔⛔ DECLARED, AND MOUNTED BY NOTHING AT THIS TIP. This is the named place the
 * veto-gated follow-up hangs the quiet-rung behaviour on; it exists now so that
 * PR starts from a definition instead of inventing one mid-flight. It is NOT
 * wired to `BaseNode`'s quick-action gate, deliberately — doing so would change
 * what a user sees across `quiet`'s zoom band, which is the one thing this
 * change promises not to do. (That band moved with `resolveLodRung`'s `full`
 * floor, gap-audit row 3, 24 Sep 2026 — it is no longer `[0.5, 0.714)`, but the
 * promise is the same: `quiet` renders identically to `full` until this is
 * spent.)
 *
 * ⚠ SO ITS UNIT SPEC IS EVIDENCE ABOUT THIS FUNCTION AND ABOUT NO SCREEN
 * (CLAUDE.md trap 13b — a green test about code no mount reaches is a guard
 * agreeing with itself). Stated here rather than left for a later reader to
 * discover, because the danger is precisely that a passing spec reads as
 * evidence the capability ships.
 */
export function cardControlsVisibleAt(rung: LodRung): boolean {
  return rung === 'full'
}

/**
 * The canvas element's OWN mount `fitView` (`ReactFlowGraph.tsx`), bounded as
 * the product fit it is (26 Sep 2026, #70 5841781894). It used to pass no
 * options, so the instance's `maxZoom={4}` was its only ceiling. Every first
 * draft's pre-layout arrangement was then framed at 253% (served probes,
 * c95694de and c7234091), and a layout that never ran left it there. That is
 * the third path the LOD note below names. The degenerate-box default applies
 * because a mount fit is taken before any layout has run.
 */
// ⚠ LAST IN THE MODULE, deliberately: `fitBoundsFor` reads `AUTO_FIT_MAX_ZOOM`
// and `MAX_LABEL_COUNTER_SCALE`, which are declared above, so evaluating this
// any earlier is a temporal-dead-zone error in every importer.
export const CANVAS_MOUNT_FIT_OPTIONS = fitBoundsFor('product')
