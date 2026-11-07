/**
 * WHICH SIDE A CARD'S OPEN WORDS GO (DL ruling 7 Nov, the narrowest reading of Paul's 4 Nov design): the panel stays beside its card, on
 * the right where its box there touches no other card or the question, else on the left where that is clear. Where neither side is clear
 * it takes the side it covers less of (by area; the right on a tie), so it never covers more than it did. Pure geometry in flow units.
 */
export type Box = { readonly x: number; readonly y: number; readonly w: number; readonly h: number }
/** The room between a card and its panel (Tailwind ml-2 / mr-2). */
export const PANEL_GAP = 8

export function panelSide(card: Box, size: { readonly w: number; readonly h: number }, others: readonly Box[]): 'right' | 'left' {
  const covered = (x: number) => others.reduce((a, o) => a + Math.max(0, Math.min(x + size.w, o.x + o.w) - Math.max(x, o.x)) * Math.max(0, Math.min(card.y + size.h, o.y + o.h) - Math.max(card.y, o.y)), 0)
  const right = covered(card.x + card.w + PANEL_GAP)
  if (right === 0) return 'right'
  return covered(card.x - PANEL_GAP - size.w) < right ? 'left' : 'right'
}
