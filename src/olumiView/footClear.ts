/**
 * DL 07:48Z (3), by layout, not masking: the board at rest never puts a card's label or figure under the foot controls (the zoom row and
 * the "N more cards below" control, which stand in a gutter at the window's foot). A card near the foot is either read whole down to its
 * figure line above the gutter, or wholly below the fold (the control counts it). The resting camera moves the least it must to make that
 * so, never past its anchor: the board's top under the head band at rest, or (after the first approval, DL / PL-1040) the primary aim
 * wholly in view.
 */
import type { Node, Viewport } from '@xyflow/react'

/** The foot gutter, px above the window's foot: the controls stand 40 px up, 36 px tall, plus REGION_GAP (12). */
export const FOOT_GUTTER = 88
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
  const clear = (dy: number) => cards.every((c) => c.top + dy >= paneH || c.top + dy + c.lf <= G)
  const held = (dy: number) => (a === null ? topmost + dy >= freeTop - 0.5 : a.top + dy >= freeTop - 0.5 && a.top + dy + a.h <= G + 0.5)
  const moves = [0, ...cards.flatMap((c) => [paneH - c.top, G - (c.top + c.lf)]), ...(a === null ? [] : [G - (a.top + a.h), freeTop - a.top])]
    .map((d) => Math.round(d)).sort((x, y) => Math.abs(x) - Math.abs(y))
  const best = moves.find((d) => held(d) && clear(d)) ?? (a === null ? 0 : moves.find((d) => held(d)) ?? 0)
  return best === 0 ? v : { ...v, y: v.y + best }
}
