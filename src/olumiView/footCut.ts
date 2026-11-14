/**
 * DL 07:48Z (4), old look: the proposal's actions foot is opaque with a clean rule at its top, and at rest no line of text is cut by it
 * (no half-line shows). Where a line straddles the rule, the resting scroll moves the least that leaves every line wholly above the rule
 * or wholly under the foot, within the room it is given (upRoom: how far the thread may move back; downRoom: how far on).
 */
export type LineBox = { readonly top: number; readonly bottom: number }

const cutBy = (l: LineBox, cut: number, d: number) => l.top - d < cut - 0.5 && l.bottom - d > cut + 0.5

/** The change to scrollTop (negative = back) after which no line box crosses `cut`; 0 when none crosses or no move in the room clears. */
export function lineCutShift(lines: readonly LineBox[], cut: number, upRoom: number, downRoom: number): number {
  const crossing = lines.filter((l) => cutBy(l, cut, 0))
  if (crossing.length === 0) return 0
  const moves = crossing.flatMap((l) => [l.top - cut, l.bottom - cut]).sort((a, b) => Math.abs(a) - Math.abs(b))
  const fits = (d: number) => d >= -Math.max(0, upRoom) - 0.5 && d <= Math.max(0, downRoom) + 0.5
  const best = moves.find((d) => fits(d) && !lines.some((l) => cutBy(l, cut, d)))
  return best === undefined ? 0 : best < 0 ? Math.floor(best) : Math.ceil(best)
}

/** The line boxes of the text inside `root` (outside `skip`) near `cut`, in viewport pixels. Empty where there is no layout (jsdom). */
export function lineBoxesNear(root: HTMLElement, skip: HTMLElement, cut: number, reach = 64): LineBox[] {
  const out: LineBox[] = []
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const range = root.ownerDocument.createRange()
  if (typeof range.getClientRects !== 'function') return out
  for (let n = walker.nextNode(); n !== null; n = walker.nextNode()) {
    const parent = n.parentElement
    if (parent === null || skip.contains(parent) || (n.textContent ?? '').trim() === '') continue
    const box = parent.getBoundingClientRect()
    if (box.bottom < cut - reach || box.top > cut + reach) continue
    range.selectNodeContents(n)
    for (const r of Array.from(range.getClientRects())) if (r.height > 0 && r.width > 0) out.push({ top: r.top, bottom: r.bottom })
  }
  return out
}
