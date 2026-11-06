/**
 * WIDE TIERS WRAP (DL 4 Nov, the core lane in the original look: a tier of five or more cards side by side made the board too wide to
 * read at fit). Pure geometry on laid-out boxes: a row (one y) holding more than `perRow` boxes is split, left to right, into rows of
 * `perRow`, each centred where the row was centred; every row below moves down by the room the new rows take.
 */
export type TierBox = { id: string; x: number; y: number; width: number; height: number }

/**
 * `keepOrder` (option a2, family rows, 6 Nov): a wide row is staggered over its lines instead of chunked, card i on line i mod L, each a
 * fixed step right of the one before, so the row's left-to-right order holds across lines (a card under the left option is never drawn
 * right of one under the right option, so links drop row to row: DL 4 Nov R3). Cards on one line stay a card and a gap apart; each line
 * is as tall as its own tallest card.
 */
export function wrapTiers(boxes: readonly TierBox[], perRow = 4, gapX = 32, gapY = 48, keepOrder = false): Map<string, { x: number; y: number }> {
  const rows = new Map<number, TierBox[]>()
  for (const b of boxes) rows.set(b.y, [...(rows.get(b.y) ?? []), b])
  const out = new Map<string, { x: number; y: number }>()
  let shift = 0
  for (const y of [...rows.keys()].sort((a, b) => a - b)) {
    const row = rows.get(y)!.sort((a, b) => a.x - b.x)
    if (row.length <= perRow) { for (const b of row) out.set(b.id, { x: b.x, y: b.y + shift }); continue }
    const left = Math.min(...row.map((b) => b.x)), right = Math.max(...row.map((b) => b.x + b.width)), centre = (left + right) / 2
    const height = Math.max(...row.map((b) => b.height))
    if (keepOrder) {
      const lines = Math.ceil(row.length / perRow), widest = Math.max(...row.map((b) => b.width)), step = Math.ceil((widest + gapX) / lines) // whole units, so a line's cards are never closer than a card and a gap
      const x0 = centre - ((row.length - 1) * step + widest) / 2
      // Each line as tall as its own tallest card, `gapY` under it (Paul's hiring board, 6 Nov: line two sat the row's tallest card below a
      // shorter line one, 34 px of empty room); the rows below move down by what the lines take beyond the row's laid height.
      const lineH = Array.from({ length: lines }, (_, k) => Math.max(...row.filter((_, i) => i % lines === k).map((b) => b.height)))
      const top = lineH.map((_, k) => lineH.slice(0, k).reduce((sum, h) => sum + h + gapY, 0))
      row.forEach((b, i) => out.set(b.id, { x: x0 + i * step, y: y + shift + top[i % lines]! }))
      shift += top[lines - 1]! + lineH[lines - 1]! - height
      continue
    }
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
