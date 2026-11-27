/**
 * Row packing for the olumi-core lane's board (the contract lint keeps src/olumiView/layout.ts free of ordering).
 * Each row (the cards at one height, except `skip`) is closed up: the same cards in the same order,
 * `gapX` apart at their drawn widths, about the centre the layout gave the row. Geometry only.
 */
export function packRows(places: Map<string, { x: number; y: number }>, skip: string, widthOf: (id: string) => number, gapX: number): Map<string, { x: number; y: number }> {
  const rows = new Map<number, string[]>()
  for (const [id, at] of places) if (id !== skip) rows.set(at.y, [...(rows.get(at.y) ?? []), id])
  const out = new Map(places)
  for (const [y, ids] of rows) {
    ids.sort((a, b) => places.get(a)!.x - places.get(b)!.x)
    const first = places.get(ids[0]!)!.x
    const right = Math.max(...ids.map((id) => places.get(id)!.x + widthOf(id)))
    const width = ids.reduce((total, id) => total + widthOf(id), (ids.length - 1) * gapX)
    let x = (first + right - width) / 2
    for (const id of ids) {
      out.set(id, { x, y })
      x += widthOf(id) + gapX
    }
  }
  return out
}
