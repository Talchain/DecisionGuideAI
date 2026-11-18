/**
 * WHERE THE DETAILS PANEL STANDS (surfaces step 3, 18 Nov): beside the card, or the link's middle, it is about, never over it, inside the free
 * canvas (not under the top bar or the head band, the left rail, the dock or the foot controls). The side is the hover pop-up's own rule
 * (`placeHoverCard`: first side that fits whole, fewest other cards covered), run inside the free canvas's box.
 * A card or link that is off the free canvas (panned or zoomed away) leaves the panel in the free canvas's top-left corner, where it still reads.
 */
import { placeHoverCard, canvasCardRects, viewportSize, HOVER_CARD_GAP, type Rect } from '../../../canvas/components/hoverCard/hoverCardPlacement'
import { SIDEBAR_SELECTOR, TOP_BAR_SELECTOR } from '../../../canvas/utils/computeFitPadding'
import { frameTop, regionsOf } from '../../regions'
import type { DetailsTarget } from './inspectorStore'

export const DETAILS_WIDTH = 280
/** The custom properties the panel's position is written to (set on the element, read by its classes and by the form that takes its place). */
export const DETAILS_X = '--lane-details-x'
export const DETAILS_Y = '--lane-details-y'

/** The part of the window where cards are read: below the top bar and head band, right of the left rail, left of the dock. */
export function freeCanvas(): Rect {
  const rail = document.querySelector(SIDEBAR_SELECTOR)?.getBoundingClientRect()
  const bar = document.querySelector(TOP_BAR_SELECTOR)?.getBoundingClientRect()
  const left = rail !== undefined && rail.width > 0 && rail.right < window.innerWidth / 2 ? rail.right : 0
  const barBottom = bar !== undefined && bar.height > 0 ? bar.bottom : 0
  return { left, top: Math.max(frameTop(0), barBottom), right: viewportSize().width, bottom: window.innerHeight }
}

const within = (a: Rect, f: Rect) => a.right >= f.left && a.left <= f.right && a.bottom >= f.top && a.top <= f.bottom
const quoted = (id: string) => id.replace(/["\\]/g, '\\$&')

/** The card's own box on the canvas (its framed card, else its node), or the middle of the link as a point; null when it is not drawn. */
export function anchorOf(t: DetailsTarget): { anchor: Rect | null; own: Element | null } {
  if (t.kind === 'card') {
    const node = document.querySelector(`.react-flow__node[data-id="${quoted(t.id)}"]`)
    if (node === null) return { anchor: null, own: null }
    const r = (node.querySelector('[data-view-card]') ?? node).getBoundingClientRect()
    return { anchor: { left: r.left, top: r.top, right: r.right, bottom: r.bottom }, own: node }
  }
  const edge = document.querySelector(`.react-flow__edge[data-id="${quoted(t.id)}"]`)
  if (edge === null) return { anchor: null, own: null }
  const r = edge.getBoundingClientRect(), x = (r.left + r.right) / 2, y = (r.top + r.bottom) / 2
  return { anchor: { left: x, top: y, right: x, bottom: y }, own: null }
}

export function placeBeside(anchor: Rect | null, own: Element | null, size: { width: number; height: number }, free: Rect): { left: number; top: number } {
  const gap = HOVER_CARD_GAP
  if (anchor === null || !within(anchor, free)) return { left: free.left + gap, top: free.top + gap }
  const shift = (r: Rect): Rect => ({ left: r.left - free.left, top: r.top - free.top, right: r.right - free.left, bottom: r.bottom - free.top })
  const foot = regionsOf().foot.map((r) => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom }))
  const p = placeHoverCard(shift(anchor), size, { width: free.right - free.left, height: free.bottom - free.top }, [...canvasCardRects(own), ...foot].map(shift), gap)
  return { left: p.left + free.left, top: p.top + free.top }
}
