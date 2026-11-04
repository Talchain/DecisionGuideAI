/**
 * WIDE TIERS WRAP (DL 4 Nov, the core lane in the original look: a tier of five or more cards side by side made the board too wide to
 * read at fit). Pure geometry on laid-out boxes: a row (one y) holding more than `perRow` boxes is split, left to right, into rows of
 * `perRow`, each centred where the row was centred; every row below moves down by the room the new rows take.
 */
export type TierBox = { id: string; x: number; y: number; width: number; height: number }

export function wrapTiers(boxes: readonly TierBox[], perRow = 4, gapX = 32, gapY = 48): Map<string, { x: number; y: number }> {
  const rows = new Map<number, TierBox[]>()
  for (const b of boxes) rows.set(b.y, [...(rows.get(b.y) ?? []), b])
  const out = new Map<string, { x: number; y: number }>()
  let shift = 0
  for (const y of [...rows.keys()].sort((a, b) => a - b)) {
    const row = rows.get(y)!.sort((a, b) => a.x - b.x)
    if (row.length <= perRow) { for (const b of row) out.set(b.id, { x: b.x, y: b.y + shift }); continue }
    const left = Math.min(...row.map((b) => b.x)), right = Math.max(...row.map((b) => b.x + b.width)), centre = (left + right) / 2
    const height = Math.max(...row.map((b) => b.height))
    for (let k = 0; k * perRow < row.length; k++) {
      const chunk = row.slice(k * perRow, (k + 1) * perRow)
      const span = chunk.reduce((w, b) => w + b.width, 0) + gapX * (chunk.length - 1)
      let x = centre - span / 2
      for (const b of chunk) { out.set(b.id, { x, y: y + shift + k * (height + gapY) }); x += b.width + gapX }
    }
    shift += (Math.ceil(row.length / perRow) - 1) * (height + gapY)
  }
  return out
}
