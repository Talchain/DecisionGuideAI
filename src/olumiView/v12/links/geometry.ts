/** Where a size wire lands: the midpoint of the effect link it sizes, from the two cards' boxes (a default bezier's midpoint is the midpoint of its ends). */
export type LinkBox = { readonly x: number; readonly y: number; readonly w: number; readonly h: number }
export type Pt = { readonly x: number; readonly y: number }

export function effectMidpoint(from: LinkBox, to: LinkBox): Pt {
  const below = to.y >= from.y + from.h
  const a = below ? { x: from.x + from.w / 2, y: from.y + from.h } : { x: from.x + from.w, y: from.y + from.h / 2 }
  const b = below ? { x: to.x + to.w / 2, y: to.y } : { x: to.x, y: to.y + to.h / 2 }
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}
