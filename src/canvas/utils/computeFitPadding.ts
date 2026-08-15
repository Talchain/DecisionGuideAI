/**
 * Panel-aware fitView padding for the decision-graph canvas.
 *
 * The `.react-flow` pane fills its container, but product chrome floats on top
 * of it (`position: fixed`): the OutputsDock on the right and the LeftSidebar
 * ("Canvas tools") on the left. React Flow's `fitView` frames the graph against
 * the *full* container, so a wide graph runs underneath those panels. This
 * helper returns per-side padding that reserves whatever those panels actually
 * occlude, so `fitView` frames the graph into the genuinely-visible canvas.
 *
 * Why px strings (xyflow v12 semantics): `fitView` padding as a bare number is
 * a *fraction* of the viewport — `0.2` resolves to `floor((V - V/1.2) * 0.5)`
 * ≈ 8.33% of V, NOT 20%. Only `'<n>px'` strings are pixels, and in the per-side
 * object form any omitted side defaults to 0. So we must return all four sides
 * as `'<n>px'` strings — a bare `{ right: 428 }` is read as a fraction and
 * collapses to ~half the pane (`floor((V - V/429) * 0.5)` ≈ 0.499·V), not 428px.
 *
 * Margin model — each side gets `max(baseMargin, occluderOverlap + GAP)`, then a
 * defensive clamp:
 *  - `baseMargin` is the breathing room when nothing occludes a side. It uses
 *    xyflow's own bare-number formula so it is expressed in the same units the
 *    rest of the codebase reasons about. See `BASE_RATIO` for why it was
 *    lowered from `0.2` on 15 Aug 2026 and what that changes.
 *  - Because the base is now smaller than the collapsed rail (~40px + 12px
 *    right gap) and the left sidebar (~52px) at laptop widths, those panels
 *    reserve their own overlap rather than hiding inside a larger base. That
 *    is the intended behaviour of this function — it clears the panel — it is
 *    simply no longer a no-op at those sizes.
 *  - Only an *expanded* panel (e.g. the ~416px OutputsDock) meaningfully exceeds
 *    `baseMargin` and pushes that side in, framing the graph clear of the panel.
 *  - A final clamp caps total per-axis padding at `MAX_PADDING_FRACTION` of the
 *    pane, so a huge panel on a tiny viewport can never consume the whole fitting
 *    area (which would make React Flow zoom pathologically).
 *
 * Overlap is measured against the live `.react-flow` rect (NOT window-relative
 * like FloatingOlumiPanel.measureDockInset), so it stays correct if the canvas
 * is offset or embedded.
 *
 * Scope caveat: with no `flowEl` argument this defaults to the FIRST `.react-flow`
 * in the document — correct for the single live main canvas (where the wired fit
 * sites run). Multi-canvas surfaces (comparison mode) use their own separate
 * fitView calls and are untouched; if a future caller needs a specific canvas,
 * pass its element explicitly.
 */

/**
 * Breathing margin around the graph, expressed in xyflow's bare-number padding
 * units (see the header note: `r` resolves to ~`r/(2(1+r))` of the dimension,
 * so `0.08` ≈ 3.7% per side, not 8%).
 *
 * ⚠ WAS `0.2` (≈8.33% per side). Measured 15 Aug 2026 at 1280x800 with the
 * committed CEE draft capture (17 nodes / 37 edges): `0.2` reserved 106px per
 * side horizontally and 66px vertically, leaving a 730x668 fitting box out of
 * a 1280x800 pane — 43% of the width gone before the dock's own reservation
 * was even counted. The drafted graph rendered at the `minZoom` legibility
 * floor with its left edge clipped under the floating Olumi panel.
 *
 * `0.08` keeps a genuine margin (47px horizontally / 29px vertically at
 * 1280x800) while returning ~170px of fitting box. It does NOT change how an
 * occluding panel is handled — each side is still
 * `max(baseMargin, occluderOverlap + GAP)`, so the dock and sidebar reserve
 * exactly what they occlude. The visible consequence of the lower base is that
 * the collapsed rail and the left sidebar now EXCEED it and reserve their own
 * overlap (68px for a 52px sidebar) instead of hiding inside a larger base —
 * which is the correct behaviour, just no longer "inert".
 */
const BASE_RATIO = 0.08
/** Breathing gap between the graph and an occluding panel edge. */
const GAP = 16
/** Never let combined per-axis padding exceed this fraction of the pane (keeps a fitting area). */
const MAX_PADDING_FRACTION = 0.8

/** A pixel padding string, e.g. `'120px'` — matches xyflow's `PaddingWithUnit`. */
type PxString = `${number}px`

export interface FitPadding {
  top: PxString
  right: PxString
  bottom: PxString
  left: PxString
}

/** Reproduces xyflow's bare-number padding → px, so the no-occluder case matches the old behaviour. */
function baseMargin(dimension: number): number {
  if (!Number.isFinite(dimension) || dimension <= 0) return 0
  return Math.max(0, Math.floor((dimension - dimension / (1 + BASE_RATIO)) * 0.5))
}

/**
 * Cap a pair of opposing paddings so their sum can't exceed `max`, scaling both
 * down proportionally when it would. Guarantees the pane keeps a fitting area.
 */
function capPair(a: number, b: number, max: number): [number, number] {
  const total = a + b
  if (total <= max || total <= 0) return [a, b]
  const k = max / total
  return [Math.floor(a * k), Math.floor(b * k)]
}

function rectOf(selector: string): DOMRect | null {
  if (typeof document === 'undefined') return null
  const el = document.querySelector(selector) as HTMLElement | null
  if (!el) return null
  const rect = el.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return null
  return rect
}

/**
 * Compute panel-aware `fitView` padding for the given flow element (defaults to
 * the live `.react-flow` element). Returns `'<n>px'` strings for all four sides.
 */
export function computeFitPadding(flowEl?: Element | null): FitPadding {
  const el =
    flowEl ?? (typeof document !== 'undefined' ? document.querySelector('.react-flow') : null)
  const flowRect = el?.getBoundingClientRect()

  // Base margin uses the flow rect when available, else the window — this keeps
  // a sensible result in tests / before the canvas has mounted.
  const width = flowRect?.width ?? (typeof window !== 'undefined' ? window.innerWidth : 0)
  const height = flowRect?.height ?? (typeof window !== 'undefined' ? window.innerHeight : 0)
  const baseX = baseMargin(width)
  const baseY = baseMargin(height)

  let right = baseX
  let left = baseX
  // Top bar sits above `.react-flow` in the flex layout, so it never overlaps
  // the flow rect — top/bottom keep the base margin.
  let top = baseY
  let bottom = baseY

  if (flowRect) {
    // Right edge — OutputsDock (rail when collapsed, full panel when expanded).
    // Overlap = flowRect.right − dock.left, so it naturally includes the dock's
    // own right gap (the dock is positioned `right: 12`).
    const dock = rectOf('aside[aria-label="Outputs dock"]')
    if (dock) {
      const overlap = Math.max(0, flowRect.right - dock.left)
      if (overlap > 0) right = Math.max(right, overlap + GAP)
    }
    // Left edge — LeftSidebar ("Canvas tools").
    const sidebar = rectOf('nav[aria-label="Canvas tools"]')
    if (sidebar) {
      const overlap = Math.max(0, sidebar.right - flowRect.left)
      if (overlap > 0) left = Math.max(left, overlap + GAP)
    }
  }

  // Defensive clamp: never reserve so much padding that the pane is left with no
  // room to fit into (a huge panel on a tiny viewport would otherwise blow up zoom).
  if (width > 0) [left, right] = capPair(left, right, Math.floor(width * MAX_PADDING_FRACTION))
  if (height > 0) [top, bottom] = capPair(top, bottom, Math.floor(height * MAX_PADDING_FRACTION))

  return {
    top: `${top}px`,
    right: `${right}px`,
    bottom: `${bottom}px`,
    left: `${left}px`,
  }
}
