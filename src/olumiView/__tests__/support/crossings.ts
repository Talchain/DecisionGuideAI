import type { Box } from '../../../canvas/edges/linkRail'
import type { cardLinks } from '../../layout'

type Point = { x: number; y: number }
export type Segment = readonly [Point, Point]
type CardBox = Box & { id: string }

const side = (a: Point, b: Point, p: Point) => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)

/** Proper crossings exclude shared card endpoints, bend touches and collinear overlaps. */
const crosses = ([a, b]: Segment, [c, d]: Segment): boolean =>
  side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0

const segmentsOf = (points: readonly Point[]): Segment[] =>
  points.slice(1).map((point, i) => [points[i]!, point])

export const railSegments = (path: string): Segment[] =>
  segmentsOf([...path.matchAll(/[ML] ([^, ]+),([^ ]+)/g)].map(([, x, y]) => ({ x: Number(x), y: Number(y) })))

/** Clip the segment to the interior of the box. A tangent or a touch at an end is clear. */
export function passesThrough([a, b]: Segment, box: Box): boolean {
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

type Pair = { readonly from: string; readonly to: string }

/** Counts proper crossings between links and links passing through a card that is neither end. Every pair is drawn
 * bottom-centre to top-centre unless `pathOf` returns the rendered path. Pairs whose ends are not on the board are skipped. */
export function crossingCounts(
  cards: readonly CardBox[],
  links: ReturnType<typeof cardLinks> | readonly Pair[],
  pathOf: (link: Pair, from: CardBox, to: CardBox) => string | undefined = () => undefined,
): { crossings: number; cardHits: number } {
  const byId = new Map(cards.map((card) => [card.id, card]))
  const pairs: Pair[] = links.map((l) => ('link' in l ? l.link : l) as Pair).filter((l) => byId.has(l.from) && byId.has(l.to))
  const lines = pairs.map((link) => {
    const from = byId.get(link.from)!, to = byId.get(link.to)!
    const path = pathOf(link, from, to)
    const segments: Segment[] = path === undefined
      ? [[{ x: from.x + from.w / 2, y: from.y + from.h }, { x: to.x + to.w / 2, y: to.y }]]
      : railSegments(path)
    return { from, to, segments }
  })
  let crossings = 0, cardHits = 0
  for (const [i, line] of lines.entries()) {
    for (const segment of line.segments) {
      for (const { segments } of lines.slice(i + 1)) {
        for (const other of segments) if (crosses(segment, other)) crossings++
      }
    }
    // A link counts once for each card (not either end) that any of its segments passes through.
    cardHits += cards.filter((card) => card !== line.from && card !== line.to && line.segments.some((segment) => passesThrough(segment, card))).length
  }
  return { crossings, cardHits }
}

/** React Flow's control offset for a bezier handle (xyflow calculateControlOffset, curvature 0.25). */
const controlOffset = (distance: number) => (distance >= 0 ? 0.5 * distance : 0.25 * 25 * Math.sqrt(-distance))

/** A link as its edge draws it without a rail or size wire: a bezier from the source's bottom centre to the target's top centre. ViewLinkEdge
 *  (`allowUp`) instead runs from the source's top to the target's foot when the target lies wholly above; GroupLinkEdge never does. Sampled
 *  finely (256 segments by default) so the count is a high-resolution oracle, independent of production's own crossing method. */
export function bezierPolyline(from: Box, to: Box, samples = 256, allowUp = true): string {
  const up = allowUp && to.y + to.h <= from.y
  const s = { x: from.x + from.w / 2, y: up ? from.y : from.y + from.h }
  const t = { x: to.x + to.w / 2, y: up ? to.y + to.h : to.y }
  const c1 = { x: s.x, y: up ? s.y - controlOffset(s.y - t.y) : s.y + controlOffset(t.y - s.y) }
  const c2 = { x: t.x, y: up ? t.y + controlOffset(s.y - t.y) : t.y - controlOffset(t.y - s.y) }
  const at = (k: number) => {
    const u = 1 - k
    return { x: u * u * u * s.x + 3 * u * u * k * c1.x + 3 * u * k * k * c2.x + k * k * k * t.x, y: u * u * u * s.y + 3 * u * u * k * c1.y + 3 * u * k * k * c2.y + k * k * k * t.y }
  }
  return Array.from({ length: samples + 1 }, (_, i) => at(i / samples)).map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ')
}
