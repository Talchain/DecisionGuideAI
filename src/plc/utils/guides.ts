// src/plc/utils/guides.ts
// Smart alignment guides: compute nearest vertical/horizontal alignment lines
// for edges and centers of rectangles. O(n) per evaluation.

export type Rect = { x: number; y: number; w: number; h: number }
export type GuideMatch = {
  axis: 'x' | 'y'
  ref: number
  movingEdge: 'left' | 'cx' | 'right' | 'top' | 'cy' | 'bottom'
  snapTo: number // the snapped coordinate for the moving rect (x for vertical, y for horizontal)
}

export interface GuidesResult {
  v?: GuideMatch // vertical line (x alignment)
  h?: GuideMatch // horizontal line (y alignment)
}

function candidatesX(r: Rect) {
  return [
    { edge: 'left' as const, val: r.x },
    { edge: 'cx' as const, val: r.x + r.w / 2 },
    { edge: 'right' as const, val: r.x + r.w },
  ]
}

function candidatesY(r: Rect) {
  return [
    { edge: 'top' as const, val: r.y },
    { edge: 'cy' as const, val: r.y + r.h / 2 },
    { edge: 'bottom' as const, val: r.y + r.h },
  ]
}

function snapXFromEdge(edge: 'left' | 'cx' | 'right', ref: number, w: number) {
  if (edge === 'left') return ref
  if (edge === 'cx') return ref - w / 2
  return ref - w
}

function snapYFromEdge(edge: 'top' | 'cy' | 'bottom', ref: number, h: number) {
  if (edge === 'top') return ref
  if (edge === 'cy') return ref - h / 2
  return ref - h
}

export function computeGuides(moving: Rect, others: Rect[], tol: number): GuidesResult {
  let bestVX: GuideMatch | undefined
  let bestHY: GuideMatch | undefined

  const mx = candidatesX(moving)
  const my = candidatesY(moving)

  for (const o of others) {
    const ox = candidatesX(o)
    const oy = candidatesY(o)

    // Vertical (x) alignment
    for (const me of mx) {
      for (const oe of ox) {
        const d = Math.abs(me.val - oe.val)
        if (d <= tol) {
          const snapTo = snapXFromEdge(me.edge, oe.val, moving.w)
          const match: GuideMatch = { axis: 'x', ref: oe.val, movingEdge: me.edge, snapTo }
          if (!bestVX || Math.abs(me.val - bestVX.ref) > d) bestVX = match
        }
      }
    }

    // Horizontal (y) alignment
    for (const me of my) {
      for (const oe of oy) {
        const d = Math.abs(me.val - oe.val)
        if (d <= tol) {
          const snapTo = snapYFromEdge(me.edge, oe.val, moving.h)
          const match: GuideMatch = { axis: 'y', ref: oe.val, movingEdge: me.edge, snapTo }
          if (!bestHY || Math.abs(me.val - bestHY.ref) > d) bestHY = match
        }
      }
    }
  }

  return { v: bestVX, h: bestHY }
}
