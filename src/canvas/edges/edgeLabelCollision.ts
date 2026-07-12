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

const X_THRESHOLD = 90
const Y_THRESHOLD = 24
const STEP = 26
const MAX_STACK = 10 // guard: never loop unbounded on pathological input

export function resolveLabelCollisionOffsets(
  points: readonly LabelPoint[],
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
      placed.some(
        (q) => Math.abs(q.x - p.x) < X_THRESHOLD && Math.abs(q.y - (p.y + dy)) < Y_THRESHOLD,
      ) &&
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
