/** Geometry-only ordering for Simple. Each link is one visible connector. */
export type SimpleLink = { readonly from: string; readonly to: string; readonly group?: true }
type Point = { x: number; y: number }
type Bounds = { left: number; top: number; right: number; bottom: number }
type Place = Point & { w: number }
type Box = Place & { h: number }
type CardBox = Box & { id: string }

function passesThrough(a: Point, b: Point, box: Box): boolean {
  if (a.x === b.x && a.y === b.y) return false
  if (Math.max(a.x, b.x) <= box.x || Math.min(a.x, b.x) >= box.x + box.w ||
      Math.max(a.y, b.y) <= box.y || Math.min(a.y, b.y) >= box.y + box.h) return false
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
const SAMPLES = 128
const sampleWeights = Array.from({ length: SAMPLES + 1 }, (_, i) => {
  const t = i / SAMPLES
  return { blend: t * t * (3 - 2 * t), bend: 3 * t * (1 - t) * (1 - 2 * t) }
})

type SampledAxis = { levels: Float64Array; values: Float64Array; slopes: Float64Array }

function sampledAxis(points: readonly Point[], axis: keyof Point, forward: boolean): SampledAxis {
  const value = axis === 'x' ? 'y' : 'x'
  const levels = new Float64Array(SAMPLES + 1), values = new Float64Array(SAMPLES + 1), slopes = new Float64Array(SAMPLES)
  for (let i = 0; i <= SAMPLES; i++) {
    const p = points[forward ? i : SAMPLES - i]!
    levels[i] = p[axis]
    values[i] = p[value]
    if (i > 0) slopes[i - 1] = (values[i]! - values[i - 1]!) / (levels[i]! - levels[i - 1]!)
  }
  return { levels, values, slopes }
}

function bezier(from: Box, to: Box, group: boolean) {
  // GroupLinkEdge always uses the bottom and top handles, even when the target lies above.
  const up = !group && to.y + to.h <= from.y
  const s = { x: from.x + from.w / 2, y: up ? from.y : from.y + from.h }
  const t = { x: to.x + to.w / 2, y: up ? to.y + to.h : to.y }
  const offset = up ? -controlOffset(s.y - t.y) : controlOffset(t.y - s.y)
  const dx = t.x - s.x, dy = t.y - s.y
  const points = sampleWeights.map(({ blend, bend }) => ({ x: s.x + dx * blend, y: s.y + dy * blend + offset * bend }))
  const bounds = {
    left: Math.min(s.x, t.x), right: Math.max(s.x, t.x),
    top: Math.min(s.y, t.y), bottom: Math.max(s.y, t.y),
  }
  // Bottom-to-top handles with negative separation turn back in y.
  const monotoneY = dy > 0 || (up && dy < 0)
  if (!monotoneY) {
    for (const { y } of points) {
      bounds.top = Math.min(bounds.top, y)
      bounds.bottom = Math.max(bounds.bottom, y)
    }
  }
  return {
    from, to, bounds, points,
    byY: monotoneY ? sampledAxis(points, 'y', dy > 0) : null,
    byX: dx === 0 ? null : sampledAxis(points, 'x', dx > 0),
  }
}

const overlaps = (a: Bounds, b: Bounds): boolean =>
  a.left <= b.right && b.left <= a.right && a.top <= b.bottom && b.top <= a.bottom

const valueAt = ({ levels, values, slopes }: SampledAxis, i: number, level: number): number =>
  values[i]! + slopes[i]! * (level - levels[i]!)

/** Merge the two sampled paths' levels. Between consecutive levels the difference is linear. */
function crossingsAlong(a: SampledAxis, b: SampledAxis): number {
  let level = Math.max(a.levels[0]!, b.levels[0]!)
  const end = Math.min(a.levels[SAMPLES]!, b.levels[SAMPLES]!)
  if (level >= end) return 0
  let i = 0, j = 0, previous = 0, crossings = 0
  while (a.levels[i + 1]! < level) i++
  while (b.levels[j + 1]! < level) j++
  while (true) {
    const current = sign(valueAt(a, i, level) - valueAt(b, j, level))
    if (current !== 0) {
      if (current === -previous) crossings++
      previous = current
    }
    if (level === end) return crossings
    if (a.levels[i + 1] === level) i++
    if (b.levels[j + 1] === level) j++
    level = Math.min(a.levels[i + 1]!, b.levels[j + 1]!)
  }
}

// Ignore round-off near zero. A touch leaves the same sign on either side.
const sign = (delta: number): number => delta > 1e-9 ? 1 : delta < -1e-9 ? -1 : 0

function verticalCrossings(vertical: readonly Point[], other: SampledAxis): number {
  const x = vertical[0]!.x
  if (x <= other.levels[0]! || x >= other.levels[SAMPLES]!) return 0
  let i = 0
  while (other.levels[i + 1]! < x) i++
  const y = valueAt(other, i, x)
  let previous = 0, crossings = 0
  for (const point of vertical) {
    const current = sign(point.y - y)
    if (current === 0) continue
    if (current === -previous) crossings++
    previous = current
  }
  return crossings
}

function curveCrossings(a: ReturnType<typeof bezier>, b: ReturnType<typeof bezier>): number {
  if (a.byY !== null && b.byY !== null) return crossingsAlong(a.byY, b.byY)
  // When a curve doubles back in y, intersect the dense polylines along x instead.
  if (a.byX === null) return b.byX === null ? 0 : verticalCrossings(a.points, b.byX)
  if (b.byX === null) return verticalCrossings(b.points, a.byX)
  return crossingsAlong(a.byX, b.byX)
}

export function simpleCrossingCounts(cards: readonly CardBox[], links: readonly SimpleLink[]) {
  const byId = new Map(cards.map((card) => [card.id, card]))
  const lines = links.flatMap((link) => {
    const from = byId.get(link.from), to = byId.get(link.to)
    return from === undefined || to === undefined ? [] : [bezier(from, to, link.group === true)]
  })
  const boxes = cards.map((card) => ({ card, bounds: { left: card.x, right: card.x + card.w, top: card.y, bottom: card.y + card.h } }))
  let crossings = 0, cardHits = 0
  for (const [i, line] of lines.entries()) {
    for (let j = i + 1; j < lines.length; j++) {
      const other = lines[j]!
      if (!overlaps(line.bounds, other.bounds)) continue
      crossings += curveCrossings(line, other)
    }
    for (const { card, bounds } of boxes) {
      if (card === line.from || card === line.to || !overlaps(line.bounds, bounds)) continue
      if (line.points.some((point, index) => index > 0 && passesThrough(line.points[index - 1]!, point, card))) cardHits++
    }
  }
  return { crossings, cardHits }
}

type Band = {
  readonly ids: readonly string[]
  readonly fixed?: boolean
}
export type SimpleOrder = readonly (readonly string[])[]
type Counts = ReturnType<typeof simpleCrossingCounts>
const totalCrossings = (counts: readonly Counts[]) => counts.reduce((sum, { crossings }) => sum + crossings, 0)

/** Sweep the band sequences and keep only orders that improve the reference layouts together. */
export function orderSimpleBands(
  bands: readonly Band[],
  links: readonly SimpleLink[],
  stableIds: readonly string[],
  score: (order: SimpleOrder) => readonly Counts[],
): SimpleOrder {
  const base = bands.map((band) => band.ids)
  if (links.length < 2) return base
  const ceiling = score(base)
  let bestTotal = totalCrossings(ceiling)
  if (bestTotal === 0) return base

  const rank = new Map(stableIds.map((id, i) => [id, i]))
  const byRank = (a: string, b: string) => rank.get(a)! - rank.get(b)!
  const bandOf = new Map(bands.flatMap(({ ids }, i) => ids.map((id) => [id, i] as const)))
  const neighbours = new Map(stableIds.map((id) => [id, [] as string[]]))
  for (const { from, to } of links) {
    if (!bandOf.has(from) || !bandOf.has(to) || bandOf.get(from) === bandOf.get(to)) continue
    neighbours.get(from)!.push(to)
    neighbours.get(to)!.push(from)
  }
  // Fix the summation order so link order cannot perturb floating-point ties.
  for (const ids of neighbours.values()) ids.sort(byRank)
  const at = new Map<string, number>()
  const assign = (ids: readonly string[]) => ids.forEach((id, i) => at.set(id, (i + 0.5) / ids.length))
  const compareOrders = (a: SimpleOrder, b: SimpleOrder): number => {
    for (const [i, ids] of a.entries()) {
      for (const [j, id] of ids.entries()) {
        const comparison = byRank(id, b[i]![j]!)
        if (comparison !== 0) return comparison
      }
    }
    return 0
  }

  let bestOrder = base
  const baseTotal = bestTotal
  for (let round = 0; round < 2; round++) {
    const order = [...bestOrder]
    order.forEach(assign)
    let accepted = false
    for (const direction of [1, -1]) {
      for (let i = direction === 1 ? 0 : bands.length - 1; i >= 0 && i < bands.length; i += direction) {
        const band = bands[i]!
        if (band.fixed || band.ids.length < 2) continue
        const targets = order[i]!.map((id) => {
          let weight = 0, ordinal = 0
          for (const other of neighbours.get(id) ?? []) {
            const distance = i - bandOf.get(other)!
            const w = (distance * direction > 0 ? 2 : 1) / (1 + Math.abs(distance))
            weight += w
            ordinal += w * at.get(other)!
          }
          return { id, ordinal: weight === 0 ? at.get(id)! : ordinal / weight }
        })
        targets.sort((a, b) => a.ordinal - b.ordinal || byRank(a.id, b.id))
        order[i] = targets.map(({ id }) => id)
        assign(order[i]!)
      }
      const counts = score(order), total = totalCrossings(counts)
      if (total >= baseTotal || total > bestTotal) continue
      if (counts.some(({ crossings, cardHits }, i) => crossings > ceiling[i]!.crossings || cardHits > ceiling[i]!.cardHits)) continue
      if (total === bestTotal && compareOrders(order, bestOrder) >= 0) continue
      bestTotal = total
      bestOrder = [...order]
      accepted = true
    }
    if (!accepted) break
  }
  return bestOrder
}
