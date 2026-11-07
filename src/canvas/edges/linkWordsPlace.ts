/**
 * WHERE A LINK'S WORDS SIT (R5, the design lead's R3 look check item 3; github-3c approved the fix, 5 Nov). The words ("!", "◇", a sign, a
 * strength) are in React Flow's label layer, above resting cards (R3: "a card never cuts them"), so at the path's midpoint they were drawn
 * over any card lying there. They sit at the nearest point along the link's own path (its cubic Bézier, as React Flow drew it) whose box
 * touches no card. Where no point of the path is clear, they sit at the nearest point off it whose box touches no card, and never at the
 * midpoint over a card (DL 7 Nov, Paul's "ent!prise"). Pure geometry in flow units; nothing about the words changes.
 */
type Box = { readonly x: number; readonly y: number; readonly w: number; readonly h: number }
type Point = { x: number; y: number }

/** The points of React Flow's Bézier path `M sx,sy C c1x,c1y c2x,c2y tx,ty`; null for any other shape. */
function cubicOf(path: string): [Point, Point, Point, Point] | null {
  const n = '(-?[\\d.]+(?:e-?\\d+)?)'
  const m = new RegExp(`^M\\s*${n}[ ,]${n}\\s*C\\s*${n}[ ,]${n}\\s+${n}[ ,]${n}\\s+${n}[ ,]${n}\\s*$`).exec(path.trim())
  if (m === null) return null
  const v = m.slice(1).map(Number)
  return [{ x: v[0]!, y: v[1]! }, { x: v[2]!, y: v[3]! }, { x: v[4]!, y: v[5]! }, { x: v[6]!, y: v[7]! }]
}

const at = ([a, b, c, d]: [Point, Point, Point, Point], t: number): Point => {
  const u = 1 - t
  return { x: u * u * u * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t * t * t * d.x, y: u * u * u * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t * t * t * d.y }
}

/** The steps tried, nearest the middle first: 0.5, then 0.45 and 0.55, … out to 0.05 and 0.95. */
const STEPS = [0.5, ...Array.from({ length: 9 }, (_, k) => [0.5 - 0.05 * (k + 1), 0.5 + 0.05 * (k + 1)]).flat()]

/** Then finer steps, for a gap between two rows narrower than a 0.05 step (Paul's board: 32 units between the rows). */
const FINE = Array.from({ length: 49 }, (_, k) => [0.5 - 0.01 * (k + 1), 0.5 + 0.01 * (k + 1)]).flat()
/** Off the path: rings round the midpoint, nearest first; 16 points a ring, rings 8 units apart, out to RINGS_OUT. */
const RING_STEP = 8, RINGS_OUT = 480, RING_POINTS = 16, ROOM = 4

export function linkWordsAt(path: string, cards: readonly Box[], size: { readonly w: number; readonly h: number }, mid: { readonly x: number; readonly y: number }): Point {
  const clear = (p: Point) => cards.every((c) => !(p.x - size.w / 2 < c.x + c.w && p.x + size.w / 2 > c.x && p.y - size.h / 2 < c.y + c.h && p.y + size.h / 2 > c.y))
  const curve = cubicOf(path)
  if (curve !== null) {
    for (const t of STEPS) { const p = at(curve, t); if (clear(p)) return t === 0.5 ? { x: mid.x, y: mid.y } : p }
    for (const t of FINE) { const p = at(curve, t); if (clear(p)) return p }
  } else if (clear(mid)) return { x: mid.x, y: mid.y }
  for (let r = RING_STEP; r <= RINGS_OUT; r += RING_STEP) {
    for (let k = 0; k < RING_POINTS; k++) { const a = (2 * Math.PI * k) / RING_POINTS, p = { x: mid.x + r * Math.cos(a), y: mid.y + r * Math.sin(a) }; if (clear(p)) return p }
  }
  // Past the right edge of every card, which touches none of them.
  return { x: Math.max(mid.x, ...cards.map((c) => c.x + c.w)) + ROOM + size.w / 2, y: mid.y }
}
