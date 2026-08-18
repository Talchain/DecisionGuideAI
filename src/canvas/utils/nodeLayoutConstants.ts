/**
 * Shared constants for the canvas layout pipeline.
 *
 * One source of truth for node dimensions, spacing, the canonical semantic
 * tier mapping, and the bounded measurement-failure fallback duration.
 * Imported by `layout.ts`, `BaseNode.tsx`, the lifecycle hook in
 * `ReactFlowGraph.tsx`, and the layout test suite.
 */

import { MAX_LABEL_COUNTER_SCALE } from './zoomLegibility'

// ─── Dimensions ──────────────────────────────────────────────────────────────

/**
 * ⭐⭐ NODE GEOMETRY AND THE CANVAS LABEL SCALE ARE ONE DECISION. Read this
 * before changing any width in this file, or `LABEL_LEGIBLE_ZOOM`.
 *
 * Canvas label text carries a counter-scale (`--canvas-label-scale`) so it
 * renders at its DECLARED size instead of `declared × zoom`. That scale is
 * bounded by `MAX_LABEL_COUNTER_SCALE`, and the bound is reached at exactly the
 * zoom a post-draft auto-fit parks at. So at the zoom the product itself
 * chooses, node title text is `MAX_LABEL_COUNTER_SCALE ×` larger than the
 * declared 13px — and any width tuned against 13px holds that much less text.
 *
 * `#758` scaled the font and not the geometry, and the two drifted apart in a
 * single deploy: measured at the settle zoom (0.5000, scale 2, title rendering
 * at 26px), 59 of 174 node titles across the five shipped starters broke
 * MID-WORD. The two text-derived widths below therefore carry the scale
 * explicitly, so the drift cannot recur silently — change `LABEL_LEGIBLE_ZOOM`
 * and both move.
 *
 * NOT EVERY WIDTH SCALES, AND THE ASYMMETRY IS DELIBERATE:
 *   - the FLOORS below are text-derived (they exist to hold a word) and MUST
 *     follow the scale;
 *   - `NODE_CARD_MAX_W` is a viewport constraint, not a text measure. Doubling
 *     it would double the laid-out graph, and since the auto-fit is already
 *     clamped at `LABEL_LEGIBLE_ZOOM` for a post-draft model, that buys no
 *     legibility and only crops the model — the same trade `zoomLegibility.ts`
 *     rejects for the zoom floor, and the trade a prior lane already paid for
 *     with panel width and got nothing. It stays fixed and is GUARDED instead:
 *     `nodeLabelFit.spec.ts` REDs if the cap ever stops affording the floor.
 */

/** Horizontal padding inside the rendered card (12px each side, see BaseNode). */
export const NODE_CARD_PADDING_X = 24

/** Shape-indicator glyph width in the title's flex row (see BaseNode). */
export const NODE_HEADER_ICON_PX = 14

/** Gap between the shape indicator and the title in that row (see BaseNode). */
export const NODE_HEADER_GAP_PX = 6

/**
 * Horizontal space the title row gives up to the shape indicator before any
 * text is laid out. Derived, so the two literals above have exactly one home.
 */
export const NODE_HEADER_RESERVE_PX = NODE_HEADER_ICON_PX + NODE_HEADER_GAP_PX

/**
 * Width of the widest single word the product's own content contains, at the
 * DECLARED node-title size (Design System v5 §2.3: Inter 600, 13px).
 *
 * MEASURED, not estimated — in Chromium against the LIVE font of a mounted node
 * title, over all 194 unbreakable runs in the five shipped starters
 * (`src/canvas/starters/data/`), i.e. a corpus from outside this change's
 * author. The widest is "Cannibalization" at **97.77px**; next are
 * "Concentration" 90.19 and "Improvement" 83.55. Rounded up to 100.
 *
 * ⚠ This supersedes a hand-set `96`, whose comment claimed "fits a
 * ~12-character word" — under-derived, not merely unscaled.
 *
 * ⚠ THE MARGIN IS 2.23px AND THAT IS DELIBERATE. Every pixel here is doubled by
 * the counter-scale and widens every compressed card, so headroom is not free.
 * Ordinary business words already exceed it — "Recommendation" 110.47px,
 * "Commoditisation" 107.81px — and are simply not in the product's content
 * today. `e2e/visual/nodeLabelFit.visual.spec.ts` MEASURES the corpus against
 * this bound and REDs if one arrives; it carries those words as a negative
 * control so it is shown to discriminate. Do not guard this by counting
 * characters: "Commoditisation" is exactly as long as "Cannibalization".
 */
export const NODE_TITLE_WIDEST_WORD_PX = 100

/**
 * Minimum horizontal measure (px) reserved for a node's TITLE, at the largest
 * scale canvas label text can carry.
 *
 * `overflow-wrap: break-word` (Tailwind `break-words`) is a LAST-RESORT rule:
 * it splits a word mid-character as soon as that word cannot fit its line box.
 * It is therefore only as good as the measure it is given — which is why this
 * has to be a function of the font scale and not a constant tuned once.
 *
 * The header row is allowed to WRAP, so the header slot moves below the title
 * rather than the title being squeezed below a readable measure.
 */
export const NODE_TITLE_MIN_MEASURE_PX = NODE_TITLE_WIDEST_WORD_PX * MAX_LABEL_COUNTER_SCALE

/**
 * Layout-algorithm lower bound: the narrowest ELK card width. Not a visual
 * preference — it is exactly the width needed to give the title its measure
 * without the shape indicator having to wrap. Reached when the widest tier
 * cannot fit in one row at any wider width and multi-row splitting is preferred.
 *
 * The same derivation at counter-scale 1 yields 144px, against the 140px this
 * constant held before the scale was wired in — so the change here is the
 * SCALE COUPLING plus the 4px the old value was under-derived by, and nothing
 * hand-tuned. `nodeLabelFit.spec.ts` pins that.
 */
export const NODE_LAYOUT_MIN_W =
  NODE_TITLE_MIN_MEASURE_PX + NODE_HEADER_RESERVE_PX + NODE_CARD_PADDING_X

/** Maximum rendered card width. Used by BaseNode and as the ELK pinned width. */
export const NODE_CARD_MAX_W = 320

/**
 * Fair share of a row, per node in the widest tier, below which `layout.ts`
 * abandons the single-row plan and splits the tier across multiple rows.
 *
 * ⚠ POLICY, NOT A TEXT MEASURE — and deliberately NOT `NODE_LAYOUT_MIN_W`,
 * which it merely USED to equal, back when the card floor was also 140.
 *
 * Keeping them fused would have made this lane a layout change it is not
 * licensed to be. Measured (17 Aug 2026, five shipped starters × two
 * viewports): with the threshold fused to the scaled floor, two starters'
 * factor tiers flipped from the single-row branch into multi-row splitting,
 * and the pre-existing same-row overlap defect went with them — overlapping
 * node-pair AREA rose from 4,554 to 115,988 px² (headcount-allocation) and
 * 5,589 to 140,396 px² (pricing-model), while two more titles began to
 * ellipsise. Decoupled, both keep the branch they already had and neither
 * number moves.
 *
 * So this holds the shipped value: when the tier splits is unchanged by the
 * label scale; only HOW WIDE the cards are once it splits follows the scale.
 * `layout.spec.ts`'s branch regression-locks pin that this did not move.
 *
 * ⚠ RE-DERIVED 18 Aug 2026 at 6524caed — THE OVERLAP FIGURES ABOVE DO NOT
 * REPRODUCE, and the sentence they support ("the pre-existing multi-row overlap
 * defect") is not observable at this tip. The 17 Aug numbers are left standing
 * as the dated record of what was measured then; this note is APPENDED rather
 * than substituted, because a measurement is evidence and evidence is
 * append-only (CLAUDE.md trap 14b).
 *
 * What was measured, and how: `layoutGraph` driven with BROWSER-REAL node
 * heights (Chromium, `e2e/visual/harness.ts` seeding at 1280x800, captured to
 * `__tests__/__fixtures__/starter-node-heights.browser-capture-2026-08-18.json`)
 * over all five shipped starters x eight canvas widths x three node-spacing
 * settings — 120 cells spanning BOTH packing branches, including the forced
 * multi-row packings. Same-row overlap was 0 px² in every cell and the minimum
 * same-row neighbour gap was 44 px in every cell.
 *
 * Decisively: deleting the `applyCollisionGuard` call from `layoutGraph`
 * produced a BYTE-IDENTICAL node-position signature across 25 cells
 * (sha256/16 = a36fe11f1762b6b5 both before and after). `centreRowsOnSpine`
 * runs immediately before the guard and re-snaps every row to a uniform
 * `elkBoxW + gap` stride, so on every reachable input the guard's precondition
 * is already satisfied and it moves nothing.
 *
 * The guard is NOT dead, and that was shown by execution rather than asserted:
 * shrinking the stride by 30 px with the guard removed REDs 15 of the 22 cases
 * in `__tests__/layout.sameRowGap.spec.ts`, and the same shrink WITH the guard
 * in place stays fully green — the guard fires and restores the 44 px gap.
 * It is a working net that has never had to catch anything.
 *
 * Consequence for anyone briefed off the 17 Aug numbers: a spec written to
 * "assert the multi-row flip no longer overlaps" would pass at pristine and its
 * prescribed mutant ("disable the guard for one row → must RED") CANNOT BITE,
 * because removing an inert call changes nothing. Pin the PROPERTY and the
 * AUTHORITY instead — which is what `layout.sameRowGap.spec.ts` does.
 */
export const NODE_SINGLE_ROW_FAIR_SHARE_W = 140

/**
 * ⭐⭐ THE CANONICAL LAYOUT WIDTH — the ONE budget the canonical model is packed
 * against, and the reason it is a CONSTANT and not a measurement.
 *
 * FOUNDER RULING R1 (18 Aug 2026, `ARCHITECTURE-BOARD.md` §0-RULINGS):
 *
 * > "Stable model, adaptive attention. The canonical graph layout must not
 * > change because viewport width changes. Therefore: remove viewport width as
 * > an authority over canonical row packing; establish ONE stable canonical
 * > layout; responsive behaviour happens through camera/focus/disclosure, not
 * > persisted re-layout."
 *
 * WHAT WAS WRONG. `layout.ts` solved `availableWidth = canvasSize.width * 0.85`,
 * where `canvasSize` was the live `.react-flow` pane rect. Two of that solver's
 * outputs — WHETHER the widest tier splits into rows, and HOW MANY nodes go in
 * each row — were therefore functions of the viewport. Measured at `06f745ba`,
 * RED-first, with named position digests: **three of the five shipped starters
 * produce THREE DIFFERENT canonical layouts across 1280 / 1440 / 1512 / 1920.**
 * The instability is INSIDE the laptop band, not below it. Two teammates on two
 * laptops were looking at two different shapes of the same shared model.
 *
 * ⭐ HOW THIS VALUE WAS DERIVED — it is not a taste call, and it is not free.
 *
 * The packing branch is a step function of the budget, re-derived here from the
 * constants in this file (`availableWidth` = AW):
 *
 *   single-row iff floor((AW - (T-1)*MIN_GAP) / T) >= NODE_SINGLE_ROW_FAIR_SHARE_W
 *                                                     + LAYOUT_PADDING_X
 *              iff AW >= 179*T - 15                      (T = widest tier count)
 *   otherwise  nodesPerRow = floor((AW + 20) / (NODE_LAYOUT_MIN_W + LAYOUT_PADDING_X + 20))
 *
 * So the budget only ever selects a (single-row cap, nodes-per-row) PAIR, and
 * the reachable pairs near laptop widths are few:
 *
 *   AW in [ 844, 1059)  cap T=5 (1776 units wide)   3 per row (820 units)
 *   AW in [1059, 1132)  cap T=6 (2140 units wide)   3 per row (820 units)  <- HERE
 *   AW in [1132, 1238)  cap T=6 (2140)              4 per row (1108)
 *   AW in [1238, 1417)  cap T=7 (2504)              4 per row (1108)
 *   AW in [1417, 1420)  cap T=8 (2868)              4 per row (1108)
 *
 * The shipped product's own values land in three different rows of that table:
 * 1280*0.85 = 1088 (band 2), 1440*0.85 = 1224 and 1512*0.85 = 1285 (bands 3-4),
 * 1920*0.85 = 1632 (below the table, single-row to T=9). That IS the defect.
 *
 * **1105 = 1300 x 0.85.** `1300` is the width `layout.ts` already used whenever
 * nothing measured the pane (its `FALLBACK_CANVAS`, now deleted with the rest of
 * the runtime authority) and the width the layout suite has used as its baseline
 * throughout (`TEST_CANVAS` / `STD_CANVAS` in `layout.spec.ts` and
 * `layout.semantic.spec.ts`). `0.85` is the shipped viewport-utilisation ratio.
 * It is therefore a reference width the layout code ALREADY contained, not a new
 * number chosen to flatter a screenshot.
 *
 * ⭐ AND THE PROPERTY THAT DECIDED IT, which is about EVIDENCE, not taste: 1105
 * sits in the same band as 1088 = 1280 x 0.85, so **the canonical shape this pin
 * produces is byte-identical to the shape the product ships TODAY at a 1280
 * viewport.** Every geometry measurement this programme holds was taken at 1280
 * (`DRAFT-GEOMETRY-CORPUS-2026-08-18.md`, 12 models; the decision's starter
 * arithmetic; the browser height capture in `__fixtures__/`). Pinning inside that
 * band keeps all of it valid and collapses 1440 / 1512 / 1920 onto the measured
 * case. Pinning into any other band would have invalidated the whole corpus and
 * re-opened the layout-design cycle R1 explicitly closes.
 *
 * MARGIN TO THE CLIFFS, stated because a constant on a cliff edge is a defect
 * waiting for a rounding change: the band is [1059, 1132). 1105 sits **46 above**
 * the lower edge and **27 below** the upper. `layoutViewportIndependence.guard.spec.ts`
 * pins both edges, so a future nudge across either REDs by name rather than
 * silently re-shaping every model.
 *
 * ⚠ WHAT THIS DOES NOT FIX, and it is the honest half. A 6-wide tier still packs
 * to 2140 units single-row, which does not clear the 0.50 legibility floor in the
 * 760px fit box at 1280. R1 rules that the answer to a constrained screen is
 * "readable subset + explicit 'showing X of Y' + obvious whole-model access" —
 * a PRESENTATION change — never a re-pack. Do not fix it here.
 *
 * ⚠⚠ FORBIDDEN, and this is the whole point of the constant: nothing may make
 * this budget a function of anything that varies at runtime — not the viewport,
 * not the pane rect, not the fit box, not panel state, not zoom, not node count.
 * That is not a stylistic preference: it is the difference between a shared model
 * and a per-screen rendering of one. Enforced at the bytes by
 * `layoutViewportIndependence.guard.spec.ts`.
 */
export const CANONICAL_LAYOUT_WIDTH = 1105

/** Horizontal padding added around the rendered card to form the ELK box. */
export const LAYOUT_PADDING_X = 24

/** Vertical padding added around the rendered card to form the ELK box. */
export const LAYOUT_PADDING_Y = 16

/** Maximum ELK box width (card + horizontal padding). */
export const LAYOUT_BOX_MAX_W = NODE_CARD_MAX_W + LAYOUT_PADDING_X

/** Minimum ELK box width (card + horizontal padding). */
export const LAYOUT_BOX_MIN_W = NODE_LAYOUT_MIN_W + LAYOUT_PADDING_X

/**
 * Default node height used when measurement has not yet completed.
 * Matches `NODE_REGISTRY.factor.defaultSize.height`.
 */
export const DEFAULT_NODE_HEIGHT = 100

// ─── Spacing ─────────────────────────────────────────────────────────────────

/**
 * Width-calc safety reserve used in `floor((availableWidth - (N-1)*MIN_GAP) / N)`
 * to decide whether a tier renders at NODE_CARD_MAX_W or compresses to
 * NODE_LAYOUT_MIN_W with multi-row splitting. NOT a visual floor on the
 * rendered gap — the actual rendered gap is `effectiveNodeSpacing` in
 * `layout.ts`, clamped by `Math.max(20, spacing)` and the post-layout
 * `applyCollisionGuard` (COLLISION_GAP). Lowering this value relaxes the
 * width-calc threshold (more tiers render at MAX_W).
 */
export const MIN_GAP = 15

/**
 * Post-layout safety gap. Fires when ELK / multi-row splitting leaves two
 * same-row nodes closer than this threshold (rare; rounding-induced).
 *
 * Note: now larger than `MIN_GAP` (15) after the MIN_GAP 30 → 15 change.
 * The historical `COLLISION_GAP < MIN_GAP` relation no longer holds and
 * is not required — the two constants serve unrelated concerns. MIN_GAP
 * is a width-calc safety reserve only; COLLISION_GAP matches the
 * rendered node-node gap (`Math.max(20, spacing)` in layout.ts).
 */
export const COLLISION_GAP = 20

/**
 * Minimum px from graph edge to canvas origin after global translation.
 * Prevents the laid-out graph from drifting into negative coordinates.
 */
export const CANVAS_MARGIN = 24

/**
 * Bounded measurement-failure safety fallback (ms). After this many ms,
 * the measure-then-layout effect proceeds with `DEFAULT_NODE_HEIGHT` for
 * any still-unmeasured node. The single timer in the layout flow.
 */
export const LAYOUT_MEASUREMENT_FALLBACK_MS = 500

// ─── Semantic tiers ──────────────────────────────────────────────────────────

/**
 * Canonical tier assignment for Olumi decision graphs.
 *
 * Y position is determined by tier order, not by ELK's longest-path DAG
 * traversal. Outcomes, risks, and goals occupy distinct tiers so they
 * never share a row.
 */
export const TIER_BY_KIND: Record<string, number> = {
  decision:   0,
  option:     1,
  factor:     2,
  action:     2,
  constraint: 2,
  outcome:    3,
  risk:       4,
  goal:       5,
}
