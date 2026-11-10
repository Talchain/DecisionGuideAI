/**
 * WHICH SIDE A CARD'S OPEN WORDS GO (DL ruling 7 Nov, the narrowest reading of Paul's 4 Nov design): the panel stays beside its card, on
 * the right where its box there touches no other card or the question, else on the left where that is clear. Where neither side is clear
 * it takes the side it covers less of (by area; the right on a tie), so it never covers more than it did. Pure geometry in flow units.
 * `visible`: the part of the canvas a person can see, in flow units (the pane less what the outputs dock covers). Where exactly one side
 * lies wholly inside it, the panel takes that side: at 1232 a card near the dock opened its words under it, cut ("Reported in the bri…",
 * served 55c0, strategy journey, 10 Nov). Where both or neither do, the rule above decides, as before.
 */
export type Box = { readonly x: number; readonly y: number; readonly w: number; readonly h: number }
/** The visible canvas across, in flow units. */
export type Span = { readonly left: number; readonly right: number }
/** The room between a card and its panel (Tailwind ml-2 / mr-2). */
export const PANEL_GAP = 8

export function panelSide(card: Box, size: { readonly w: number; readonly h: number }, others: readonly Box[], visible: Span | null = null): 'right' | 'left' {
  if (visible !== null) {
    const shows = (x: number) => x >= visible.left && x + size.w <= visible.right
    const r = shows(card.x + card.w + PANEL_GAP), l = shows(card.x - PANEL_GAP - size.w)
    if (r !== l) return r ? 'right' : 'left'
  }
  const covered = (x: number) => others.reduce((a, o) => a + Math.max(0, Math.min(x + size.w, o.x + o.w) - Math.max(x, o.x)) * Math.max(0, Math.min(card.y + size.h, o.y + o.h) - Math.max(card.y, o.y)), 0)
  const right = covered(card.x + card.w + PANEL_GAP)
  if (right === 0) return 'right'
  return covered(card.x - PANEL_GAP - size.w) < right ? 'left' : 'right'
}
