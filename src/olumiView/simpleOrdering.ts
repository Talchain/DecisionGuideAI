/** Geometry-only ordering for Simple. Each link is one visible connector. */
export type SimpleLink = { readonly from: string; readonly to: string }
type Point = { x: number; y: number }
type Segment = readonly [Point, Point]
type Bounds = { left: number; top: number; right: number; bottom: number }
type Place = Point & { w: number }
type Box = Place & { h: number }
type CardBox = Box & { id: string }

const side = (a: Point, b: Point, p: Point) => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)
const crosses = ([a, b]: Segment, [c, d]: Segment): boolean =>
  side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0

function passesThrough([a, b]: Segment, box: Box): boolean {
  if (a.x === b.x && a.y === b.y) return false
  let enter = 0, leave = 1
  for (const [start, delta, low, high] of [[a.x, b.x - a.x, box.x, box.x + box.w], [a.y, b.y - a.y, box.y, box.y + box.h]] as const) {
    if (delta === 0) {
      if (start <= low || start >= high) return false
      continue
    }
    const t1 = (low - start) / delta, t2 = (high - start) / delta
    enter = Math.max(enter, Math.min(t1, t2))
    leave = Math.min(leave, Math.max(t1, t2))
  }
  return enter < leave
}

const controlOffset = (distance: number) => distance >= 0 ? 0.5 * distance : 0.25 * 25 * Math.sqrt(-distance)

// Match the instrument's 16 segments and React Flow's control offset, including upward and same-row links.
function bezier(from: Box, to: Box) {
  const up = to.y + to.h <= from.y
  const s = { x: from.x + from.w / 2, y: up ? from.y : from.y + from.h }
  const t = { x: to.x + to.w / 2, y: up ? to.y + to.h : to.y }
  const offset = up ? -controlOffset(s.y - t.y) : controlOffset(t.y - s.y)
  const c1 = { x: s.x, y: s.y + offset }, c2 = { x: t.x, y: t.y - offset }
  const points = Array.from({ length: 17 }, (_, i) => {
    const k = i / 16, u = 1 - k
    return {
      x: u * u * u * s.x + 3 * u * u * k * c1.x + 3 * u * k * k * c2.x + k * k * k * t.x,
      y: u * u * u * s.y + 3 * u * u * k * c1.y + 3 * u * k * k * c2.y + k * k * k * t.y,
    }
  })
  const bounds = {
    left: Math.min(...points.map((p) => p.x)), right: Math.max(...points.map((p) => p.x)),
    top: Math.min(...points.map((p) => p.y)), bottom: Math.max(...points.map((p) => p.y)),
  }
  const segments = points.slice(1).map((p, i): Segment => [points[i]!, p])
  return { from, to, bounds, segments }
}

const overlaps = (a: Bounds, b: Bounds): boolean =>
  a.left <= b.right && b.left <= a.right && a.top <= b.bottom && b.top <= a.bottom

export function simpleCrossingCounts(cards: readonly CardBox[], links: readonly SimpleLink[]) {
  const byId = new Map(cards.map((card) => [card.id, card]))
  const lines = links.flatMap((link) => {
    const from = byId.get(link.from), to = byId.get(link.to)
    return from === undefined || to === undefined ? [] : [bezier(from, to)]
  })
  const boxes = cards.map((card) => ({ card, bounds: { left: card.x, right: card.x + card.w, top: card.y, bottom: card.y + card.h } }))
  let crossings = 0, cardHits = 0
  for (const [i, line] of lines.entries()) {
    for (let j = i + 1; j < lines.length; j++) {
      const other = lines[j]!
      if (!overlaps(line.bounds, other.bounds)) continue
      for (const a of line.segments) {
        for (const b of other.segments) if (crosses(a, b)) crossings++
      }
    }
    for (const { card, bounds } of boxes) {
      if (card === line.from || card === line.to || !overlaps(line.bounds, bounds)) continue
      if (line.segments.some((segment) => passesThrough(segment, card))) cardHits++
    }
  }
  return { crossings, cardHits }
}

type Band = {
  readonly ids: readonly string[]
  /** One array of slot centres per row. Its length is the row's capacity. */
  readonly rows: readonly (readonly number[])[]
  readonly fixed?: boolean
}
type Slot = { row: number; x: number }
type Order = readonly (readonly string[])[]

/** Place and score the original order and up to four sweeps using the caller's actual geometry. */
export function orderSimpleBands<P extends Place>(
  bands: readonly Band[],
  links: readonly SimpleLink[],
  stableIds: readonly string[],
  place: (order: Order) => Map<string, P>,
  heightOf: (id: string) => number,
): Map<string, P> {
  const base = bands.map((band) => band.ids)
  const original = place(base)
  if (links.length < 2) return original
  const countsOf = (places: ReadonlyMap<string, P>) =>
    simpleCrossingCounts([...places].map(([id, p]) => ({ ...p, id, h: heightOf(id) })), links)
  const ceiling = countsOf(original)
  if (ceiling.crossings === 0) return original

  const rank = new Map(stableIds.map((id, i) => [id, i]))
  const byRank = (a: string, b: string) => rank.get(a)! - rank.get(b)!
  const bandOf = new Map(bands.flatMap(({ ids }, i) => ids.map((id) => [id, i] as const)))
  const neighbours = new Map(stableIds.map((id) => [id, [] as string[]]))
  for (const { from, to } of links) {
    if (bandOf.get(from) === bandOf.get(to)) continue
    neighbours.get(from)?.push(to)
    neighbours.get(to)?.push(from)
  }
  // Fix the summation order so link order cannot perturb floating-point ties.
  for (const ids of neighbours.values()) ids.sort(byRank)
  let row = 0
  const slots = bands.map((band) => band.rows.flatMap((xs) => {
    const index = row++
    return xs.map((x): Slot => ({ row: index, x }))
  }))
  const at = new Map<string, Slot>()
  const assign = (ids: readonly string[], i: number) => ids.forEach((id, j) => at.set(id, slots[i]![j]!))

  let best = original, bestCounts = ceiling, bestOrder = base
  for (let round = 0; round < 2; round++) {
    const order = [...bestOrder]
    order.forEach(assign)
    let accepted = false
    for (const direction of [1, -1]) {
      for (let i = direction === 1 ? 0 : bands.length - 1; i >= 0 && i < bands.length; i += direction) {
        const band = bands[i]!
        if (band.fixed || band.ids.length < 2) continue
        const targets = order[i]!.map((id) => {
          const current = at.get(id)!
          let weight = 0, row = 0, x = 0
          for (const other of neighbours.get(id) ?? []) {
            const neighbour = at.get(other)
            if (neighbour === undefined) continue
            const distance = current.row - neighbour.row
            const w = (distance * direction > 0 ? 2 : 1) / (1 + Math.abs(distance))
            weight += w
            row += w * neighbour.row
            x += w * neighbour.x
          }
          return { id, row: weight === 0 ? current.row : row / weight, x: weight === 0 ? current.x : x / weight }
        })
        targets.sort((a, b) => a.row - b.row || byRank(a.id, b.id))
        let start = 0
        const ids = band.rows.flatMap((row) => {
          const cells = targets.slice(start, start + row.length)
          start += row.length
          return cells.sort((a, b) => a.x - b.x || byRank(a.id, b.id)).map(({ id }) => id)
        })
        order[i] = ids
        assign(ids, i)
      }
      const candidate = place(order), counts = countsOf(candidate)
      if (counts.crossings >= ceiling.crossings || counts.cardHits > ceiling.cardHits) continue
      if (counts.crossings > bestCounts.crossings || (counts.crossings === bestCounts.crossings && counts.cardHits >= bestCounts.cardHits)) continue
      best = candidate
      bestCounts = counts
      bestOrder = [...order]
      accepted = true
    }
    if (!accepted) break
  }
  return best
}
