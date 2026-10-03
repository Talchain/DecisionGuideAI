/**
 * ⭐⭐ A CLICK SELECTS THE LINE NEAREST THE POINTER, NOT THE TOPMOST HIT AREA
 * (edit-values F8, 27 Sep 2026).
 *
 * Every link carries a transparent 28-unit hit stroke (`EDGE_HIT_AREA_WIDTH`), and
 * xyflow paints each edge in array order, so a LATER link's hit stroke covers any
 * earlier link's visible line within 14 units of it. At the landing zoom sibling
 * links share a thin inter-tier gutter 0–14 units apart, and on build-vs-buy 8 of
 * 37 links had no clickable point at all: a click on "Engineering Capacity →
 * On-Time Delivery" (e-9), where its line was 4.7–8.2 px from its neighbour's,
 * opened "Engineering Capacity → Engineering Overload" (e-10) in the inspector —
 * where the person then edits a strength, on the wrong link. xyflow selects
 * whichever edge element received the event (`EdgeWrapper.onEdgeClick →
 * addSelectedEdges([id])`); nothing asked which LINE the pointer was on.
 *
 * This answers that question. Every edge whose hit area is under the pointer is
 * a claimant (`elementsFromPoint` returns them all, top to bottom); the one whose
 * DRAWN path (`.react-flow__edge-path`) is nearest the pointer, in screen px, wins.
 * The generous hit target stays — a lone link is still easy to hit — and among
 * overlapping targets the line the person pointed at is the one they get.
 *
 * ⚠ The clicked edge keeps the click on a near-tie (`TIE_PX`): the pick never
 * flips between two lines the pointer is equally close to.
 */

/** Within this many screen px of the nearest, the clicked edge keeps the click. */
const TIE_PX = 0.5

/** Coarse sampling pitch along a path, in screen px, before local refinement. */
const COARSE_PITCH_PX = 4
const MAX_COARSE_SAMPLES = 600
const REFINE_SAMPLES = 16

export interface EdgeClaimant {
  id: string
  /** Screen distance from the pointer to the edge's drawn path, px. */
  distance: number
}

/**
 * The winner among claimants: the smallest distance, except that the clicked
 * edge keeps the click on a near-tie. Pure; the DOM glue is below.
 */
export function pickNearestEdge(claimants: readonly EdgeClaimant[], clickedId: string): string {
  const finite = claimants.filter((c) => Number.isFinite(c.distance))
  if (finite.length === 0) return clickedId
  let best = finite[0]!
  for (const c of finite) if (c.distance < best.distance) best = c
  const clicked = finite.find((c) => c.id === clickedId)
  if (clicked && clicked.distance - best.distance <= TIE_PX) return clickedId
  return best.id
}

type Geometry = SVGGeometryElement & {
  getTotalLength(): number
  getPointAtLength(l: number): DOMPointReadOnly
  getScreenCTM(): DOMMatrix | null
}

/** Screen distance from (x, y) to a drawn path, px; Infinity if it cannot be measured. */
export function screenDistanceToPath(path: Element, x: number, y: number): number {
  const g = path as Geometry
  if (typeof g.getTotalLength !== 'function' || typeof g.getPointAtLength !== 'function') return Infinity
  const ctm = typeof g.getScreenCTM === 'function' ? g.getScreenCTM() : null
  if (!ctm) return Infinity
  const total = g.getTotalLength()
  if (!Number.isFinite(total) || total <= 0) return Infinity
  const screenScale = Math.hypot(ctm.a, ctm.b) || 1
  const at = (l: number): number => {
    const p = g.getPointAtLength(Math.max(0, Math.min(total, l)))
    const sx = ctm.a * p.x + ctm.c * p.y + ctm.e
    const sy = ctm.b * p.x + ctm.d * p.y + ctm.f
    return Math.hypot(sx - x, sy - y)
  }
  const n = Math.max(8, Math.min(MAX_COARSE_SAMPLES, Math.ceil((total * screenScale) / COARSE_PITCH_PX)))
  const step = total / n
  let bestL = 0
  let best = Infinity
  for (let i = 0; i <= n; i++) {
    const d = at(i * step)
    if (d < best) {
      best = d
      bestL = i * step
    }
  }
  // Refine between the neighbouring coarse samples.
  const lo = bestL - step
  const fine = (2 * step) / REFINE_SAMPLES
  for (let j = 0; j <= REFINE_SAMPLES; j++) {
    const d = at(lo + j * fine)
    if (d < best) best = d
  }
  return best
}

/**
 * The id of the edge whose drawn line is nearest the pointer, among every edge
 * whose hit area is under it; `clickedId` when nothing better can be measured.
 */
export function resolveNearestEdgeAtPoint(
  clientX: number,
  clientY: number,
  clickedId: string,
  doc: Document = document,
): string {
  if (typeof doc.elementsFromPoint !== 'function') return clickedId
  const seen = new Set<string>()
  const claimants: EdgeClaimant[] = []
  for (const el of doc.elementsFromPoint(clientX, clientY)) {
    const group = el.closest('.react-flow__edge')
    const id = group?.getAttribute('data-id')
    if (!group || !id || seen.has(id)) continue
    seen.add(id)
    const path = group.querySelector('path.react-flow__edge-path')
    claimants.push({ id, distance: path ? screenDistanceToPath(path, clientX, clientY) : Infinity })
  }
  if (!seen.has(clickedId)) return clickedId
  return pickNearestEdge(claimants, clickedId)
}

/**
 * The `.react-flow__edge` group of edge `id` among the hit areas under the
 * pointer, or null. Read from the point, not by a document-wide query, so it is
 * the copy on the canvas the pointer is on (`ComparisonCanvasLayout` mounts the
 * same edge ids once per scenario).
 */
export function edgeGroupAtPoint(
  clientX: number,
  clientY: number,
  id: string,
  doc: Document = document,
): Element | null {
  if (typeof doc.elementsFromPoint !== 'function') return null
  for (const el of doc.elementsFromPoint(clientX, clientY)) {
    const group = el.closest('.react-flow__edge')
    if (group && group.getAttribute('data-id') === id) return group
  }
  return null
}
