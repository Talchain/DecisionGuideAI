/**
 * ⭐ F8 (27 Sep 2026), the HOVER half: the edge that shows the hover highlight and
 * tooltip is the one whose drawn line is nearest the pointer — the same rule a
 * click and a right-click follow (`edgePointerTarget.ts`) — not whichever edge's
 * hit area happens to be painted on top.
 *
 * Each mounted `StyledEdge` registers a SEAT here: its edge id, its own
 * enter/leave behaviour and its own element. Pointer events still arrive at the
 * TOPMOST group; that group hands the pointer to the arbiter, which resolves the
 * nearest line and moves the hover to that line's seat, leaving the previous
 * owner. One owner at a time, so two neighbours never both claim the pointer.
 *
 * ⚠ SEATS, NOT EDGE IDS. `ComparisonCanvasLayout` mounts one `MiniCanvas` per
 * scenario over a shared edge list, so one edge id is mounted several times at
 * once. The nearest line is looked up on the RECEIVING edge's own canvas (its
 * `.react-flow` root) — a registry keyed by id alone handed the hover to
 * whichever copy registered last, on another canvas (review r08 note 4).
 *
 * Where geometry cannot be measured (jsdom, a keyboard-only session) the nearest
 * resolves to the receiving edge, and behaviour is exactly the per-edge
 * enter/leave it replaced.
 */
import { resolveNearestEdgeAtPoint } from './nearestEdgeAtPoint'

export interface EdgeHoverBehaviour {
  enter(): void
  leave(): void
}

/** One mounted edge: its id, its behaviour (a ref, re-read on every call) and its element. */
export interface EdgeHoverSeat {
  readonly id: string
  readonly behaviour: { readonly current: EdgeHoverBehaviour }
  readonly element: { readonly current: Element | null }
}

const seats = new Set<EdgeHoverSeat>()
let owner: EdgeHoverSeat | null = null

let pending: { seat: EdgeHoverSeat; x: number; y: number } | null = null
let frame: number | null = null

/** Register a mounted edge's seat; returns the unregister function. */
export function registerEdgeHover(seat: EdgeHoverSeat): () => void {
  seats.add(seat)
  return () => {
    seats.delete(seat)
    if (owner === seat) owner = null
    if (pending?.seat === seat) pending = null
  }
}

/** The canvas a seat is mounted on: its `.react-flow` root, or null outside one. */
function canvasOf(seat: EdgeHoverSeat): Element | null {
  return seat.element.current?.closest('.react-flow') ?? null
}

/** Edge `id`'s seat on the SAME canvas as `receiving`, or null. */
function seatOnCanvasOf(receiving: EdgeHoverSeat, id: string): EdgeHoverSeat | null {
  if (id === receiving.id) return receiving
  const canvas = canvasOf(receiving)
  for (const seat of seats) if (seat.id === id && canvasOf(seat) === canvas) return seat
  return null
}

function moveOwnerTo(next: EdgeHoverSeat | null): void {
  if (next === owner) return
  const previous = owner
  owner = next
  if (previous !== null) previous.behaviour.current.leave()
  if (next !== null) next.behaviour.current.enter()
}

/**
 * The pointer entered or moved over `receiving`'s hit area at (x, y): hand
 * the hover to the nearest line on the same canvas.
 */
export function routeEdgeHover(receiving: EdgeHoverSeat, x: number, y: number): void {
  const nearest = resolveNearestEdgeAtPoint(x, y, receiving.id)
  moveOwnerTo(seatOnCanvasOf(receiving, nearest) ?? receiving)
}

/**
 * The pointer is on something that names its edge outright (the edge's label
 * chip): that edge owns the hover, with no geometry. A chip can sit over a
 * neighbour's line, and the nearest-line rule must not hand ITS hover away.
 */
export function claimEdgeHover(seat: EdgeHoverSeat): void {
  pending = null
  moveOwnerTo(seats.has(seat) ? seat : null)
}

/** A pointer MOVE: routed at most once per animation frame. */
export function routeEdgeHoverOnMove(receiving: EdgeHoverSeat, x: number, y: number): void {
  pending = { seat: receiving, x, y }
  if (frame !== null) return
  const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : null
  if (!raf) {
    routeEdgeHover(receiving, x, y)
    pending = null
    return
  }
  frame = raf(() => {
    frame = null
    const p = pending
    pending = null
    // The pointer may have left every edge since this was scheduled.
    if (p && owner !== null) routeEdgeHover(p.seat, p.x, p.y)
  })
}

/** The pointer left the receiving hit area: whoever owns the hover lets go. */
export function endEdgeHover(): void {
  pending = null
  moveOwnerTo(null)
}
