/**
 * CARDS UNDER THEIR PARENTS (DL 4 Nov, R3: "the edges are spaghetti"). Pure geometry on laid-out boxes. The rows the layout made stay as
 * they are, top to bottom, and the cards keep their row. Within each row that is not pinned, the cards are ordered by the mean centre of
 * their neighbours in the rows above (a link either way), and each card is placed at that mean. Cards are then pushed apart only as far as
 * they would overlap, and the row is moved back so its mean is kept. A card with no neighbour above keeps its own centre. Pinned boxes
 * (the question and the packed options) keep their x. So each card sits under what it hangs from, and the links drop row to row.
 */
import type { TierBox } from './wrapTiers'

export function orderUnderParents(boxes: readonly TierBox[], links: readonly (readonly [string, string])[], pinned: ReadonlySet<string>, gapX = 32): TierBox[] {
  const near = new Map<string, string[]>()
  for (const [a, b] of links) { near.set(a, [...(near.get(a) ?? []), b]); near.set(b, [...(near.get(b) ?? []), a]) }
  const rows = new Map<number, TierBox[]>()
  for (const b of boxes) rows.set(b.y, [...(rows.get(b.y) ?? []), b])
  const centre = new Map<string, number>()
  const out = new Map<string, TierBox>()
  for (const y of [...rows.keys()].sort((p, q) => p - q)) {
    const row = rows.get(y)!
    if (row.every((b) => pinned.has(b.id))) { for (const b of row) { out.set(b.id, b); centre.set(b.id, b.x + b.width / 2) } continue }
    const want = row.map((b) => {
      const above = (near.get(b.id) ?? []).flatMap((n) => (centre.has(n) ? [centre.get(n)!] : []))
      return { b, c: pinned.has(b.id) || above.length === 0 ? b.x + b.width / 2 : above.reduce((s, v) => s + v, 0) / above.length }
    }).sort((p, q) => p.c - q.c)
    // Each card at its wanted centre, then pushed right only as far as it would overlap the one before, then the row moved back to its mean.
    const mean = want.reduce((s, w) => s + w.c, 0) / want.length
    const xs: number[] = []
    for (let i = 0; i < want.length; i++) {
      const w = want[i]!, x = w.c - w.b.width / 2
      xs.push(i === 0 ? x : Math.max(x, xs[i - 1]! + want[i - 1]!.b.width + gapX))
    }
    let placedMean = 0
    for (let i = 0; i < want.length; i++) placedMean += xs[i]! + want[i]!.b.width / 2
    const back = mean - placedMean / want.length
    for (let i = 0; i < want.length; i++) {
      const b = want[i]!.b, x = pinned.has(b.id) ? b.x : xs[i]! + back
      out.set(b.id, { ...b, x }); centre.set(b.id, x + b.width / 2)
    }
  }
  return boxes.map((b) => out.get(b.id)!)
}
