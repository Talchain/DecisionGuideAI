/**
 * DL 07:48Z (3), by layout, not masking: the board at rest never puts a card's label or figure under the foot controls (the zoom row and
 * the "N more cards below" control, which stand in a gutter at the window's foot). A card near the foot is either read whole down to its
 * figure line above the gutter, or wholly below the fold (the control counts it). The resting camera moves the least it must to make that
 * so, never past its anchor: the board's top under the head band at rest, or (after the first approval, DL / PL-1040) the primary aim
 * wholly in view.
 */
import type { Node, Viewport } from '@xyflow/react'

/** The foot gutter, px above the window's foot: the drawn foot band (BelowCue FOOT_FADE_H, the solid ground under the controls and its soft
 *  edge), so a fitted board ends above it (v10d: was 88, the controls' 76 px plus REGION_GAP 12, which left a card's foot in the soft edge). */
export const FOOT_GUTTER = 96
/** The part of a card that is read whole once any of it is drawn: its label and its figure line, flow px (at most the card's height). */
export const LABEL_FIGURE_H = 96

type Card = { id: string; top: number; lf: number; h: number }

/**
 * `v` moved down or up by the least amount for which every card is either wholly below the fold or has its label and figure line above
 * the gutter, while the anchor holds: with no `anchor`, the board's top stays at or below `freeTop`; with one, that card is wholly between
 * `freeTop` and the gutter. Where no such move exists, `v` is returned (or, with an anchor, the least move that shows the anchor).
 */
export function restClearOfFoot(v: Viewport, nodes: readonly Node[], paneH: number, freeTop: number, anchor?: string | null): Viewport {
  if (nodes.length === 0 || paneH <= 0) return v
  const z = v.zoom, G = paneH - FOOT_GUTTER
  const cards: Card[] = nodes.map((n) => { const h = n.measured?.height ?? n.height ?? 0; return { id: n.id, top: n.position.y * z + v.y, lf: Math.min(h, LABEL_FIGURE_H) * z, h: h * z } })
  const a = anchor == null ? null : cards.find((c) => c.id === anchor) ?? null
  const topmost = Math.min(...cards.map((c) => c.top))
  const clear = (dy: number) => cards.every((c) => c.top + dy >= paneH - 0.5 || c.top + dy + c.lf <= G + 0.5)
  // At rest never a big move: at most the gutter and one card's label and figure, and the board's top card stays read (label above the
  // gutter). The first-approval anchor may move further: bringing the aim into view is the point.
  const most = FOOT_GUTTER + LABEL_FIGURE_H * z
  let top = cards[0]!
  for (const c of cards) if (c.top < top.top) top = c
  const held = (dy: number) => (a === null
    ? Math.abs(dy) <= most && topmost + dy >= freeTop - 0.5 && top.top + dy + top.lf <= G + 0.5
    : a.top + dy >= freeTop - 0.5 && a.top + dy + a.h <= G + 0.5)
  const moves = [0, ...cards.flatMap((c) => [paneH - c.top, G - (c.top + c.lf)]), ...(a === null ? [] : [G - (a.top + a.h), freeTop - a.top])]
  // The smallest move that qualifies (the first listed where two are as small), by size and unrounded: a fractional card top must not leave
  // a pushed row half a pixel above the fold.
  const nearest = (ok: (d: number) => boolean): number | undefined => {
    let b: number | undefined
    for (const d of moves) if (ok(d) && (b === undefined || Math.abs(d) < Math.abs(b))) b = d
    return b
  }
  const best = nearest((d) => held(d) && clear(d)) ?? (a === null ? 0 : nearest(held) ?? 0)
  // (where no bounded move clears the foot, the frame is left as the fit made it: nothing is ever pushed out of view to pass the rule)
  return best === 0 ? v : { ...v, y: v.y + Math.ceil(best) }
}

/**
 * V12 Simple, a board that does not fit whole (the foot is never a card's cover): the zoom, from `zoom` DOWNWARD to `minZoom`, at which no card is cut
 * by the foot gutter's line, so each card is wholly above the gutter or wholly below it (the cue counts those). It never zooms in: a larger zoom made a
 * board that fitted across wider than the canvas, with cards under the panel (first drafts at 1232 x 704 and 1128 x 680, 17 Nov). Whole cards, not the
 * label and figure line `restClearOfFoot` keeps clear: on Simple a card is short enough that a part under the controls is words under them (R1, 16 Nov).
 * `boxes` are flow units; the board's top sits at `top` (screen px) at every zoom. Where no zoom in that range clears every card, `zoom` is returned
 * and the frame is as the fit made it (nothing is pushed out of view to pass the rule).
 */
export function zoomClearOfFoot(boxes: readonly { y: number; h: number }[], boardTop: number, top: number, paneH: number, zoom: number, minZoom: number): number {
  if (boxes.length === 0 || paneH <= 0) return zoom
  const line = paneH - FOOT_GUTTER
  const cut = (z: number): boolean => boxes.some((b) => { const t = top + (b.y - boardTop) * z, e = t + b.h * z; return t < line - 0.5 && e > line + 0.5 })
  for (let z = zoom; z >= minZoom - 1e-9; z -= 0.005) if (!cut(z)) return z
  return zoom
}
