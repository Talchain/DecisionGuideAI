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
//
// Exported because StyledEdge's rendered label must stay INSIDE this box for
// the assumption to hold: the label div is capped at `maxWidth: 2 ×
// LABEL_HALF_WIDTH` with nowrap + ellipsis, so however long the label text
// is, it can never exceed the width the resolver clears for. A spec pins the
// render against these constants — widening the label without widening the
// box here would silently under-clear every dodge.
export const LABEL_HALF_WIDTH = 80
export const LABEL_HALF_HEIGHT = 11

function labelIntersectsRect(cx: number, cy: number, r: NodeRect): boolean {
  return (
    cx + LABEL_HALF_WIDTH > r.x &&
    cx - LABEL_HALF_WIDTH < r.x + r.width &&
    cy + LABEL_HALF_HEIGHT > r.y &&
    cy - LABEL_HALF_HEIGHT < r.y + r.height
  )
}

/** An edge whose persistent label participates in the placement pass. */
export interface PlacementEdge {
  id: string
  sourceRect: NodeRect
  targetRect: NodeRect
}

// Task 9c proximity nudge: when a label anchor sits within NODE_PROXIMITY px
// of either endpoint card's centre, nudge it NUDGE_DISTANCE px perpendicular
// to the edge direction before resolution.
const NODE_PROXIMITY = 40
const NUDGE_DISTANCE = 20

/**
 * C2 review (findings 3 + 4): one deterministic pass from node rects to each
 * persistent label's TOTAL offset (proximity nudge + collision stack).
 *
 * Anchor basis (finding 3): every node component places its source handle at
 * bottom-centre and its target handle at top-centre, so the bezier label
 * point (labelX/labelY — where StyledEdge renders the label) is the midpoint
 * of those two HANDLE points. The previous basis — midpoint of the node
 * CENTRES — diverges from the render anchor by (sourceHeight −
 * targetHeight)/4, so unequal-height cards were collision-tested at a point
 * the label does not occupy. Deriving the anchor from node rects (rather
 * than each edge's own props) keeps the pass consistent: every edge computes
 * the SAME anchor for every label and therefore the same global assignment.
 *
 * Nudge order (finding 4): the Task 9c ±NUDGE_DISTANCE perpendicular nudge
 * is applied BEFORE resolution — the resolver sees nudged anchors — so it
 * can never push a card-cleared label back under a card. The nudge survives
 * in the returned total offset.
 */
export function resolvePersistentLabelPlacements(
  edges: readonly PlacementEdge[],
  nodeRects: readonly NodeRect[] = [],
): Map<string, LabelOffset> {
  const nudges = new Map<string, LabelOffset>()
  const points: LabelPoint[] = []
  for (const e of edges) {
    // Handle points: source bottom-centre → target top-centre
    const shx = e.sourceRect.x + e.sourceRect.width / 2
    const shy = e.sourceRect.y + e.sourceRect.height
    const thx = e.targetRect.x + e.targetRect.width / 2
    const thy = e.targetRect.y
    // Render anchor = midpoint of the handle points
    const ax = (shx + thx) / 2
    const ay = (shy + thy) / 2
    // Task 9c proximity nudge, keyed off the true anchor
    const scy = e.sourceRect.y + e.sourceRect.height / 2
    const tcy = e.targetRect.y + e.targetRect.height / 2
    let ndx = 0
    let ndy = 0
    if (
      Math.hypot(ax - shx, ay - scy) < NODE_PROXIMITY ||
      Math.hypot(ax - thx, ay - tcy) < NODE_PROXIMITY
    ) {
      const ex = thx - shx
      const ey = thy - shy
      const len = Math.hypot(ex, ey) || 1
      ndx = (-ey / len) * NUDGE_DISTANCE
      ndy = (ex / len) * NUDGE_DISTANCE
    }
    nudges.set(e.id, { dx: ndx, dy: ndy })
    points.push({ id: e.id, x: ax + ndx, y: ay + ndy })
  }
  const resolved = resolveLabelCollisionOffsets(points, nodeRects)
  const out = new Map<string, LabelOffset>()
  for (const e of edges) {
    const nudge = nudges.get(e.id)!
    const stack = resolved.get(e.id)!
    // (+ 0 is unnecessary: −0 from the perpendicular maths normalises to +0
    // through the addition below)
    out.set(e.id, { dx: nudge.dx + stack.dx, dy: nudge.dy + stack.dy })
  }
  return out
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
