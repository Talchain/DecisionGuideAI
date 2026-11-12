/**
 * A LINK INTO A CARD ABOVE ITS SOURCE RUNS ROUND THE BOARD (R25, Paul 7 Nov: the aims in view at 1232). The aims are drawn beside the
 * question at the head of the board (layout.ts `flankHead`), so an outcome's link into its aim goes up. As a Bézier from the outcome's
 * bottom to the aim's top it looped through every row between them. Instead it leaves the source's bottom, runs along the gap under the
 * source's row (no card is there), climbs a rail outside the board on the aim's side, and arrives at the aim's outer side. Each such link
 * on a side has its own rail (PL 7 Nov: no shared rail, no segment through a card), and its words' measured box sits on its own rail, off
 * every card (PL 7 Nov: a point off the cards is not a box off the cards).
 * Pure geometry in flow units; null for any link that does not go up into the head row.
 */
export type Box = { readonly x: number; readonly y: number; readonly w: number; readonly h: number }
/** How far outside the board the first rail runs, and the room between two rails on one side (flow units). */
export const RAIL_GAP = 24, RAIL_STEP = 12
/** Where the link reaches its target, measured down from the card's top: inside the heading's line height. */
const EXIT = 20
/** How far under the source's row the link runs along to its rail. */
const UNDER = 12

// Only where the head row is flanked (the aims beside the question, Build 2b's layout): the previous product's layout heads the board with
// the question alone, where a rail ran round the whole board edge beside the dock (DL, A13d approved with notes open: "a long right-angle
// detour"). There a link into the question keeps its short direct curve, as the option lines do.
const goesUp = (from: Box, to: Box, cards: readonly Box[]): boolean => {
  const top = Math.min(...cards.map((c) => c.y))
  return to.y + to.h < from.y && to.y <= top + 1 && cards.filter((c) => c.y <= top + 1).length > 1
}
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

/** A rail link's path, and the climb its words sit on: x is the rail, y the middle of the climb, top and bottom the climb's ends. */
export type Rail = { readonly path: string; readonly x: number; readonly y: number; readonly top: number; readonly bottom: number; readonly onLeft: boolean }

export function railOf(from: Box, to: Box, cards: readonly Box[], slot = 0): Rail | null {
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
  return { path: `M ${sx},${sy} L ${sx},${under} L ${rail},${under} L ${rail},${ty} L ${tx},${ty}`, x: rail, y: (under + ty) / 2, top: ty, bottom: under, onLeft }
}

/** How far along the climb each try moves the words, and the least room between the words and the board's edge (flow units). */
const WORDS_STEP = 8, WORDS_ROOM = 4

/**
 * Where a rail link's words sit: on its rail, at the point of the climb nearest its middle where the words' box (as measured) touches no
 * card (nor, given in `cards`, a chip on a card's rail). Where no point of the climb is clear (a box wider than the rail's room beside cards
 * all the way up), the box moves out just past the board's edge, still across its rail; every card lies inside the board, so it then
 * touches none. The board's edge is the cards' own (`board`, the cards alone when given), never a chip's overhang.
 */
export function railWordsAt(r: Rail, size: { readonly w: number; readonly h: number }, cards: readonly Box[], board: readonly Box[] = cards): { x: number; y: number } {
  const clear = (x: number, y: number) => cards.every((c) => !(x - size.w / 2 < c.x + c.w && x + size.w / 2 > c.x && y - size.h / 2 < c.y + c.h && y + size.h / 2 > c.y))
  const lo = r.top + size.h / 2, hi = r.bottom - size.h / 2, n = Math.ceil(Math.max(0, r.bottom - r.top) / WORDS_STEP)
  for (let k = 0; k <= n; k++) for (const y of k === 0 ? [r.y] : [r.y - k * WORDS_STEP, r.y + k * WORDS_STEP]) if (y >= lo && y <= hi && clear(r.x, y)) return { x: r.x, y }
  const edge = r.onLeft ? Math.min(...board.map((c) => c.x)) - WORDS_ROOM - size.w / 2 : Math.max(...board.map((c) => c.x + c.w)) + WORDS_ROOM + size.w / 2
  return { x: r.onLeft ? Math.min(r.x, edge) : Math.max(r.x, edge), y: r.y }
}
