/**
 * WHERE A LINK'S WORDS SIT (R5, the design lead's R3 look check item 3; github-3c approved the fix, 5 Nov). The words ("!", "◇", a sign, a
 * strength) are in React Flow's label layer, above resting cards (R3: "a card never cuts them"), so at the path's midpoint they were drawn
 * over any card lying there. They sit at the nearest point along the link's own path (its cubic Bézier, as React Flow drew it) whose box
 * touches no card; where none is clear, at the midpoint as before. Pure geometry in flow units; nothing about the words changes.
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

export function linkWordsAt(path: string, cards: readonly Box[], size: { readonly w: number; readonly h: number }, mid: { readonly x: number; readonly y: number }): Point {
  const curve = cubicOf(path)
  if (curve === null) return { x: mid.x, y: mid.y }
  const clear = (p: Point) => cards.every((c) => !(p.x - size.w / 2 < c.x + c.w && p.x + size.w / 2 > c.x && p.y - size.h / 2 < c.y + c.h && p.y + size.h / 2 > c.y))
  for (const t of STEPS) { const p = at(curve, t); if (clear(p)) return t === 0.5 ? { x: mid.x, y: mid.y } : p }
  return { x: mid.x, y: mid.y }
}
