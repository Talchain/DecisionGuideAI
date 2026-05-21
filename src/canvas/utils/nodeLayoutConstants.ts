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
export const NODE_LAYOUT_MIN_W = 200

/** Maximum rendered card width. Used by BaseNode and as the ELK pinned width. */
export const NODE_CARD_MAX_W = 320

/**
 * First-load heuristic for the analysis panel (OutputsDock) width when
 * expanded. Matches the CSS variable `--dock-right-expanded: 26rem` in
 * `src/index.css` (26 × 16 = 416px at the default 16px base font).
 *
 * Used by `layoutGraph`'s first-load branch only (when called with
 * `{ isFirstLoad: true }`): subsequent auto-arranges deliberately ignore all
 * panels because the user may have moved or hidden them.
 *
 * --- KNOWN LIMITATIONS (deliberate trade-off, not bugs) ---
 *
 * This constant is a SINGLE FIXED VALUE — a heuristic, not a measurement.
 * It does NOT reflect:
 *
 *   1. The dock's persisted closed state. When the user has previously
 *      closed the dock, OutputsDock renders a 40px rail instead of the
 *      416px expanded panel. The first-load subtraction over-corrects in
 *      that case, compressing cards more than necessary.
 *
 *   2. User-resized dock width. OutputsDock has a left-edge
 *      `cursor-col-resize` handle and persists the chosen width to
 *      `localStorage.panel.results.width` (see OutputsDock.tsx). This
 *      constant ignores any persisted resize — a user who has dragged
 *      the dock wider or narrower still gets the 416px subtraction.
 *
 *   3. The dock's 12px right offset (`right: 12` in its asideStyle).
 *      The actual horizontal space the dock occupies in the viewport is
 *      `12 + 416 = 428px`, but we subtract only 416. Slight under-correction
 *      for the open-dock case.
 *
 * Resolving any of these requires either DOM querying (rejected in PR #172
 * because the floating-first v2 Olumi panel has a different selector and a
 * draggable position) OR reading the persisted dock state from the canvas
 * store (a larger architectural change — would need a separate brief).
 *
 * For now, this heuristic is acceptable because:
 *   - On a fresh CEE draft (applyDraftResult), the dock is typically open
 *     by default for first-time users.
 *   - The over-correction (closed dock) is graceful: cards compress to
 *     200px instead of 320px, but remain visible (no overflow).
 *   - The under-correction (12px offset) means the rightmost card may
 *     visually touch the dock's left edge by 12px — minor.
 */
export const ANALYSIS_PANEL_WIDTH = 416

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
