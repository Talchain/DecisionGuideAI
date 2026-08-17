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
 * MEASURED, not estimated — in Chromium against the real loaded font, over the
 * 87 node labels in the five shipped starters (`src/canvas/starters/data/`),
 * i.e. a corpus from outside this change's author. The widest is
 * "Cannibalization" at **96.06px**; next are "Concentration" 88.13 and
 * "International" 78.02. Rounded up to 100 for headroom.
 *
 * ⚠ This supersedes a hand-set `96`, whose comment claimed "fits a
 * ~12-character word". That was 0.06px short of its own widest real word even
 * at 1× — the value was under-derived, not merely unscaled.
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
 */
export const NODE_SINGLE_ROW_FAIR_SHARE_W = 140

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
