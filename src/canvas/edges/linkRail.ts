/**
 * A LINK INTO A CARD ABOVE ITS SOURCE RUNS ROUND THE BOARD (R25, Paul 7 Nov: the aims in view at 1232). The aims are drawn beside the
 * question at the head of the board (layout.ts `flankHead`), so an outcome's link into its aim goes up. As a Bézier from the outcome's
 * bottom to the aim's top it looped through every row between them. Instead it leaves the source's bottom, runs along the gap under the
 * source's row (no card is there), climbs a rail outside the board on the aim's side, and arrives at the aim's outer side. Each such link
 * on a side has its own rail (PL 7 Nov: no shared rail, no segment through a card), and its words sit on its own rail, off every card.
 * Pure geometry in flow units; null for any link that does not go up into the head row.
 */
export type Box = { readonly x: number; readonly y: number; readonly w: number; readonly h: number }
/** How far outside the board the first rail runs, and the room between two rails on one side (flow units). */
export const RAIL_GAP = 24, RAIL_STEP = 12
/** Where the link reaches its target, measured down from the card's top: inside the heading's line height. */
const EXIT = 20
/** How far under the source's row the link runs along to its rail. */
const UNDER = 12

const goesUp = (from: Box, to: Box, cards: readonly Box[]): boolean => to.y + to.h < from.y && to.y <= Math.min(...cards.map((c) => c.y)) + 1
const sideOf = (to: Box, cards: readonly Box[]): 'left' | 'right' => {
  const left = Math.min(...cards.map((c) => c.x)), right = Math.max(...cards.map((c) => c.x + c.w))
  return to.x + to.w / 2 < (left + right) / 2 ? 'left' : 'right'
}

/** Each rail link's rail on its side: 0 nearest the board, in the order of their sources across the board, so no two share a rail. */
export function railSlots(links: readonly { id: string; from: Box; to: Box }[], cards: readonly Box[]): Map<string, number> {
  const out = new Map<string, number>()
  for (const side of ['left', 'right'] as const) {
    const mine = links.filter((l) => goesUp(l.from, l.to, cards) && sideOf(l.to, cards) === side)
      .sort((a, b) => (side === 'left' ? a.from.x - b.from.x : b.from.x - a.from.x) || a.id.localeCompare(b.id))
    mine.forEach((l, k) => out.set(l.id, k))
  }
  return out
}

export function railOf(from: Box, to: Box, cards: readonly Box[], slot = 0): { path: string; x: number; y: number } | null {
  // Only into the head row (the question and the aims beside it, the board's top): any other upward link (a premise on an option) keeps
  // its curve, since a rail into a middle row would cross that row's cards.
  if (!goesUp(from, to, cards)) return null
  const left = Math.min(...cards.map((c) => c.x)), right = Math.max(...cards.map((c) => c.x + c.w))
  const onLeft = sideOf(to, cards) === 'left'
  const rail = onLeft ? left - RAIL_GAP - slot * RAIL_STEP : right + RAIL_GAP + slot * RAIL_STEP
  // Under the source's row: below the lowest card whose top is the source's (the family rows share their tops).
  const under = Math.max(...cards.filter((c) => Math.abs(c.y - from.y) < 1).map((c) => c.y + c.h), from.y + from.h) + UNDER
  const sx = from.x + from.w / 2, sy = from.y + from.h
  const tx = onLeft ? to.x : to.x + to.w, ty = to.y + EXIT
  return { path: `M ${sx},${sy} L ${sx},${under} L ${rail},${under} L ${rail},${ty} L ${tx},${ty}`, x: rail, y: (under + ty) / 2 }
}
