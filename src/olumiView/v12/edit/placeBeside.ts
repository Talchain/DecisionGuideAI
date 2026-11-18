/**
 * WHERE THE DETAILS PANEL STANDS (surfaces step 3, 18 Nov): beside the card, or the link's middle, it is about, never over it, inside the free
 * canvas (not under the top bar or the head band, the left rail, the dock or the foot controls). The side is the hover pop-up's own rule
 * (`placeHoverCard`: first side that fits whole, fewest other cards covered), run inside the free canvas's box.
 * The card's own box is a HARD constraint: when no side holds the whole panel, the panel is made shorter (its body scrolls inside, its header and close stay)
 * on the side with the most room, never laid over its card. A card or link that is drawn but off the free canvas (panned or zoomed away) hides the panel (it stays
 * mounted, with its typing and its saves) until the card comes back.
 */
import { placeHoverCard, canvasCardRects, viewportSize, HOVER_CARD_GAP, type Rect } from '../../../canvas/components/hoverCard/hoverCardPlacement'
import { SIDEBAR_SELECTOR, TOP_BAR_SELECTOR } from '../../../canvas/utils/computeFitPadding'
import { frameTop, regionsOf } from '../../regions'
import type { DetailsTarget } from './inspectorStore'

export const DETAILS_WIDTH = 280
/** The custom properties the panel's position is written to (set on the element, read by its classes and by the form that takes its place). */
export const DETAILS_X = '--lane-details-x'
export const DETAILS_Y = '--lane-details-y'
export const DETAILS_H = '--lane-details-h'

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

/** The card's own box on the canvas (its framed card, else its node), or a link's middle as a point; null when it is not drawn. */
export function anchorOf(t: DetailsTarget): { anchor: Rect | null; own: Element | null } {
  if (t.kind === 'card') {
    const node = document.querySelector(`.react-flow__node[data-id="${quoted(t.id)}"]`)
    if (node === null) return { anchor: null, own: null }
    const r = (node.querySelector('[data-view-card]') ?? node).getBoundingClientRect()
    return { anchor: { left: r.left, top: r.top, right: r.right, bottom: r.bottom }, own: node }
  }
  const edge = document.querySelector(`.react-flow__edge[data-id="${quoted(t.id)}"]`)
  if (edge === null) return { anchor: null, own: null }
  const m = onLine(edge)
  const r = edge.getBoundingClientRect(), x = m?.x ?? (r.left + r.right) / 2, y = m?.y ?? (r.top + r.bottom) / 2
  return { anchor: { left: x, top: y, right: x, bottom: y }, own: null }
}

/** The middle of the link's drawn line, on screen (a curve's bounding box middle may be off the line); null where the line cannot be measured (jsdom). */
function onLine(edge: Element): { x: number; y: number } | null {
  const path = edge.querySelector('path.react-flow__edge-path, path') as (SVGPathElement | null)
  if (path === null || typeof path.getTotalLength !== 'function' || typeof path.getPointAtLength !== 'function' || typeof path.getScreenCTM !== 'function') return null
  try {
    const len = path.getTotalLength(), m = path.getScreenCTM()
    if (!Number.isFinite(len) || m === null) return null
    const p = path.getPointAtLength(len / 2)
    const x = m.a * p.x + m.c * p.y + m.e, y = m.b * p.x + m.d * p.y + m.f
    return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null
  } catch { return null }
}

export type Placed = { left: number; top: number; /** Set when the panel must be shorter than it is: its body scrolls inside. */ maxHeight: number | null }
/** Below this a panel is no use (its header and close alone); a side with less room is not a side. */
const MIN_SHOWN = 64
const hits = (b: Rect, a: Rect) => b.left < a.right && b.right > a.left && b.top < a.bottom && b.bottom > a.top
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, Math.max(lo, hi)))

/** Where a `size` panel stands beside `anchor` inside `free`, never over the anchor; null when the anchor is off the free canvas (or no side has room). */
export function placeBeside(anchor: Rect | null, own: Element | null, size: { width: number; height: number }, free: Rect): Placed | null {
  const gap = HOVER_CARD_GAP
  if (anchor === null || !within(anchor, free)) return null
  const shift = (r: Rect): Rect => ({ left: r.left - free.left, top: r.top - free.top, right: r.right - free.left, bottom: r.bottom - free.top })
  const W = free.right - free.left, H = free.bottom - free.top, w = size.width
  const h = Math.min(size.height, Math.max(MIN_SHOWN, H - 2 * gap))
  const out = (left: number, top: number, hh: number): Placed => ({ left: left + free.left, top: top + free.top, maxHeight: hh < size.height ? hh : null })
  const foot = regionsOf().foot.map((r) => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom }))
  const a = shift(anchor)
  // The hover pop-up's rule first (the first side that holds the whole panel, fewest other cards covered); kept only when it is clear of the card.
  const p = placeHoverCard(a, { width: w, height: h }, { width: W, height: H }, [...canvasCardRects(own), ...foot].map(shift), gap)
  if (!hits({ left: p.left, top: p.top, right: p.left + w, bottom: p.top + h }, a)) return out(p.left, p.top, h)
  // No side holds it clear of the card: the side with the most room, the panel cut to that room.
  const sides: Array<{ left: number; top: number; h: number }> = []
  if (W - a.right >= w + 2 * gap) sides.push({ left: a.right + gap, top: clamp(a.top, gap, H - h - gap), h })
  if (a.left >= w + 2 * gap) sides.push({ left: a.left - gap - w, top: clamp(a.top, gap, H - h - gap), h })
  const below = Math.min(h, H - a.bottom - 2 * gap), above = Math.min(h, a.top - 2 * gap), across = clamp(a.left, gap, W - w - gap)
  if (below >= MIN_SHOWN) sides.push({ left: across, top: a.bottom + gap, h: below })
  if (above >= MIN_SHOWN) sides.push({ left: across, top: a.top - gap - above, h: above })
  const best = sides.sort((x, y) => y.h - x.h)[0]
  return best === undefined ? null : out(best.left, best.top, best.h)
}

/**
 * Keep `el` beside its item as the board moves (a pan, a zoom, a relayout): placed before paint by the caller's layout effect, then again each frame
 * the item, the element's own size or the free canvas changes. Its position and cap are written as custom properties (`vars`); while the item is off the
 * free canvas the element stays mounted but is hidden, inert and out of the reading order, and shows again when the item returns. Returns the stop.
 */
export function stayBeside(get: () => HTMLElement | null, target: DetailsTarget, vars: { x: string; y: string; h: string }, fallbackWidth = DETAILS_WIDTH): () => void {
  let raf = 0, last = ''
  const place = () => {
    const el = get()
    if (el !== null) {
      const { anchor, own } = anchorOf(target), free = freeCanvas()
      // Its natural height, not the cap it was last given.
      const cap = el.style.getPropertyValue(vars.h)
      if (cap !== '') el.style.removeProperty(vars.h)
      const box = el.getBoundingClientRect()
      if (cap !== '') el.style.setProperty(vars.h, cap)
      const size = { width: box.width > 0 ? box.width : fallbackWidth, height: box.height }
      const key = [anchor?.left, anchor?.top, anchor?.right, anchor?.bottom, size.width, size.height, free.left, free.top, free.right, free.bottom].join('|')
      if (key !== last) {
        last = key
        // Its item is not drawn at all (nothing to stand beside, e.g. no canvas yet): left where its own fallback puts it, shown. Drawn but off the free canvas: hidden.
        const p = anchor === null ? undefined : placeBeside(anchor, own, size, free)
        if (p === undefined) { delete el.dataset.off; el.removeAttribute('aria-hidden'); el.removeAttribute('inert') }
        else if (p === null) { el.dataset.off = 'true'; el.setAttribute('aria-hidden', 'true'); el.setAttribute('inert', '') }
        else {
          delete el.dataset.off; el.removeAttribute('aria-hidden'); el.removeAttribute('inert')
          el.style.setProperty(vars.x, `${p.left}px`); el.style.setProperty(vars.y, `${p.top}px`)
          if (p.maxHeight === null) el.style.removeProperty(vars.h); else el.style.setProperty(vars.h, `${p.maxHeight}px`)
        }
      }
    }
    raf = requestAnimationFrame(place)
  }
  place()
  return () => cancelAnimationFrame(raf)
}
