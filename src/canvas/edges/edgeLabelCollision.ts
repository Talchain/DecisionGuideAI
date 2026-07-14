/**
 * edgeLabelCollision — E3 (graph-visuals): keep persistent edge labels
 * readable when they land near each other (e.g. two labels at a crossing).
 *
 * Pure, deterministic resolver: given every persistent label's anchor point,
 * assign each a vertical offset so no two overlap. Labels are processed in
 * spatial order (top-to-bottom, then left-to-right, then id) so the topmost
 * label stays anchored and later ones stack downward — the same input set
 * always produces the same assignment, and every edge computes the SAME
 * global assignment (each edge feeds the same approximated anchor set in,
 * then applies its own offset).
 *
 * Collision box ≈ a rendered label (maxWidth 160px, ~22px tall with padding):
 * two anchors closer than the thresholds on BOTH axes overlap.
 *
 * E3 part 2 (C2): node cards are fixed obstacles too. React Flow paints the
 * node layer ABOVE the edge-label renderer (node wrappers carry inline
 * zIndex ≥ 0; `.react-flow__edgelabel-renderer` has none), so a label that
 * lands under a card is clipped invisibly rather than layered on top.
 * Callers pass every node's rect; a label whose box (the same 160×22
 * assumption, as half-extents around the anchor) intersects any rect stacks
 * downward by the same STEP until it clears both the node rects AND the
 * labels placed before it. With no node rects the resolver behaves exactly
 * as before.
 */
export interface LabelPoint {
  id: string
  x: number
  y: number
}

export interface LabelOffset {
  dx: number
  dy: number
}

/** A node card's bounding box in graph coordinates. */
export interface NodeRect {
  x: number
  y: number
  width: number
  height: number
}

const X_THRESHOLD = 90
const Y_THRESHOLD = 24
const STEP = 26
const MAX_STACK = 10 // guard: never loop unbounded on pathological input

// Label box half-extents — the rendered label's maxWidth 160px / ~22px tall
// (the same box the label-vs-label thresholds above approximate).
const LABEL_HALF_WIDTH = 80
const LABEL_HALF_HEIGHT = 11

function labelIntersectsRect(cx: number, cy: number, r: NodeRect): boolean {
  return (
    cx + LABEL_HALF_WIDTH > r.x &&
    cx - LABEL_HALF_WIDTH < r.x + r.width &&
    cy + LABEL_HALF_HEIGHT > r.y &&
    cy - LABEL_HALF_HEIGHT < r.y + r.height
  )
}

export function resolveLabelCollisionOffsets(
  points: readonly LabelPoint[],
  nodeRects: readonly NodeRect[] = [],
): Map<string, LabelOffset> {
  const sorted = [...points].sort(
    (a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id),
  )
  const placed: Array<{ x: number; y: number }> = []
  const out = new Map<string, LabelOffset>()
  for (const p of sorted) {
    let dy = 0
    let guard = 0
    while (
      (placed.some(
        (q) => Math.abs(q.x - p.x) < X_THRESHOLD && Math.abs(q.y - (p.y + dy)) < Y_THRESHOLD,
      ) ||
        nodeRects.some((r) => labelIntersectsRect(p.x, p.y + dy, r))) &&
      guard < MAX_STACK
    ) {
      dy += STEP
      guard++
    }
    placed.push({ x: p.x, y: p.y + dy })
    out.set(p.id, { dx: 0, dy })
  }
  return out
}
