/**
 * Shared constants for the canvas layout pipeline.
 *
 * One source of truth for node dimensions, spacing, the canonical semantic
 * tier mapping, and the bounded measurement-failure fallback duration.
 * Imported by `layout.ts`, `BaseNode.tsx`, the lifecycle hook in
 * `ReactFlowGraph.tsx`, and the layout test suite.
 */

// ─── Dimensions ──────────────────────────────────────────────────────────────

/**
 * Layout-algorithm lower bound. Not a visual minimum — nodes at this width
 * will have heavy text wrapping. Only reached when the widest tier cannot fit
 * in one row at any wider width and multi-row splitting is preferred.
 */
export const NODE_LAYOUT_MIN_W = 140

/** Maximum rendered card width. Used by BaseNode and as the ELK pinned width. */
export const NODE_CARD_MAX_W = 256

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

/** Minimum horizontal gap between nodes in the same tier. */
export const MIN_GAP = 30

/**
 * Post-layout safety gap. Smaller than `MIN_GAP` because it only fires when
 * ELK / multi-row splitting leaves two same-row nodes closer than this
 * threshold (rare; rounding-induced).
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
