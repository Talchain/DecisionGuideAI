/**
 * A LINK INTO A CARD ABOVE ITS SOURCE RUNS ROUND THE BOARD (R25, Paul 7 Nov: the aims in view at 1232). The aims are drawn beside the
 * question at the head of the board (layout.ts `flankHead`), so an outcome's link into its aim goes up. As a Bézier from the outcome's
 * bottom to the aim's top it looped through every row between them. Instead it leaves the outcome's side, runs up a rail just outside
 * the board on the aim's side, and arrives at the aim's outer side. Pure geometry in flow units; null for any link that does not go up.
 */
export type Box = { readonly x: number; readonly y: number; readonly w: number; readonly h: number }
/** How far outside the board the rail runs (flow units). */
export const RAIL_GAP = 24
/** Where the link leaves its source and reaches its target, measured down from each card's top: inside the heading's line height. */
const EXIT = 20

export function railOf(from: Box, to: Box, cards: readonly Box[]): { path: string; x: number; y: number } | null {
  // Only into the head row (the question and the aims beside it, the board's top): any other upward link (a premise on an option) keeps
  // its curve, since a rail into a middle row would cross that row's cards.
  if (to.y + to.h >= from.y || to.y > Math.min(...cards.map((c) => c.y)) + 1) return null
  const left = Math.min(...cards.map((c) => c.x)), right = Math.max(...cards.map((c) => c.x + c.w))
  const onLeft = to.x + to.w / 2 < (left + right) / 2
  const rail = onLeft ? left - RAIL_GAP : right + RAIL_GAP
  const sx = onLeft ? from.x : from.x + from.w, sy = from.y + EXIT
  const tx = onLeft ? to.x : to.x + to.w, ty = to.y + EXIT
  return { path: `M ${sx},${sy} L ${rail},${sy} L ${rail},${ty} L ${tx},${ty}`, x: rail, y: (sy + ty) / 2 }
}
