/**
 * Row packing for the olumi-core lane's board (moved out of src/olumiView/layout.ts, which the contract lint keeps free of ordering): the
 * previous layout plans each row for its own cards' widths, and this lane draws every card at one width. Each row (the cards at one height,
 * except `skip`) is closed up: the same cards in the same order, `gapX` apart, about the centre the layout gave the row. Geometry only.
 */
export function packRows(places: Map<string, { x: number; y: number }>, skip: string, cardW: number, gapX: number): Map<string, { x: number; y: number }> {
  const rows = new Map<number, string[]>()
  for (const [id, at] of places) if (id !== skip) rows.set(at.y, [...(rows.get(at.y) ?? []), id])
  const out = new Map(places)
  for (const [y, ids] of rows) {
    ids.sort((a, b) => places.get(a)!.x - places.get(b)!.x)
    const first = places.get(ids[0]!)!.x, last = places.get(ids[ids.length - 1]!)!.x
    const width = ids.length * cardW + (ids.length - 1) * gapX, left = (first + last + cardW) / 2 - width / 2
    ids.forEach((id, i) => out.set(id, { x: left + i * (cardW + gapX), y }))
  }
  return out
}
