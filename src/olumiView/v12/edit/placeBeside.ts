/**
 * WHERE THE DETAILS PANEL STANDS (surfaces step 3, 18 Nov): beside the card, or the link's middle, it is about, never over it, inside the free
 * canvas (not under the top bar or the head band, the left rail, the dock or the foot controls). The side is the hover pop-up's own rule
 * (`placeHoverCard`: first side that fits whole, fewest other cards covered), run inside the free canvas's box.
 * The card's own box is a HARD constraint: when no side holds the whole panel, the panel is made shorter (its body scrolls inside, its header and close stay)
 * on the side with the most room, never laid over its card where any non-overlapping place exists. A card or link that is drawn but off the free canvas (panned
 * or zoomed away), or one with no side that has room, leaves the panel VISIBLE, clamped inside the free canvas where it overlaps the card least; nothing is hidden.
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
/** A form's least useful height: its padding, one field, the error line and the Save/Cancel row (44 px) - below it Save could be cut off. */
export const FORM_MIN_SHOWN = 160
const hits = (b: Rect, a: Rect) => b.left < a.right && b.right > a.left && b.top < a.bottom && b.bottom > a.top
const overlap = (b: Rect, a: Rect) => Math.max(0, Math.min(b.right, a.right) - Math.max(b.left, a.left)) * Math.max(0, Math.min(b.bottom, a.bottom) - Math.max(b.top, a.top))
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, Math.max(lo, hi)))

/** Where a `size` panel stands beside `anchor` inside `free`, never over the anchor where any place avoids it; always inside `free` (never null). */
export function placeBeside(anchor: Rect, own: Element | null, size: { width: number; height: number }, free: Rect, minShown = MIN_SHOWN): Placed {
  const gap = HOVER_CARD_GAP
  const shift = (r: Rect): Rect => ({ left: r.left - free.left, top: r.top - free.top, right: r.right - free.left, bottom: r.bottom - free.top })
  const W = free.right - free.left, H = free.bottom - free.top, w = size.width
  const h = Math.min(size.height, Math.max(minShown, H - 2 * gap))
  const out = (left: number, top: number, hh: number): Placed => ({ left: left + free.left, top: top + free.top, maxHeight: hh < size.height ? hh : null })
  const a = shift(anchor)
  if (within(anchor, free)) {
    const foot = regionsOf().foot.map((r) => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom }))
    // The hover pop-up's rule first (the first side that holds the whole panel, fewest other cards covered); kept only when it is clear of the card.
    const p = placeHoverCard(a, { width: w, height: h }, { width: W, height: H }, [...canvasCardRects(own), ...foot].map(shift), gap)
    if (!hits({ left: p.left, top: p.top, right: p.left + w, bottom: p.top + h }, a)) return out(p.left, p.top, h)
    // No side holds it clear of the card: the side with the most room, the panel cut to that room.
    const sides: Array<{ left: number; top: number; h: number }> = []
    if (W - a.right >= w + 2 * gap) sides.push({ left: a.right + gap, top: clamp(a.top, gap, H - h - gap), h })
    if (a.left >= w + 2 * gap) sides.push({ left: a.left - gap - w, top: clamp(a.top, gap, H - h - gap), h })
    const below = Math.min(h, H - a.bottom - 2 * gap), above = Math.min(h, a.top - 2 * gap), across = clamp(a.left, gap, W - w - gap)
    if (below >= minShown) sides.push({ left: across, top: a.bottom + gap, h: below })
    if (above >= minShown) sides.push({ left: across, top: a.top - gap - above, h: above })
    const best = sides.sort((x, y) => y.h - x.h)[0]
    if (best !== undefined) return out(best.left, best.top, best.h)
  }
  // The card is off the free canvas, or no side has room: still shown, inside the free canvas, where it overlaps the card least (the first of these on a tie).
  const maxL = W - w - gap, maxT = H - h - gap
  const spots = [
    { left: clamp(a.right + gap, gap, maxL), top: clamp(a.top, gap, maxT) }, { left: clamp(a.left - gap - w, gap, maxL), top: clamp(a.top, gap, maxT) },
    { left: clamp(a.left, gap, maxL), top: clamp(a.bottom + gap, gap, maxT) }, { left: clamp(a.left, gap, maxL), top: clamp(a.top - gap - h, gap, maxT) },
    { left: gap, top: gap }, { left: Math.max(gap, maxL), top: gap }, { left: gap, top: Math.max(gap, maxT) }, { left: Math.max(gap, maxL), top: Math.max(gap, maxT) },
  ]
  let best = spots[0]!, least = Infinity
  for (const s of spots) { const o = overlap({ left: s.left, top: s.top, right: s.left + w, bottom: s.top + h }, a); if (o < least) { least = o; best = s } }
  return out(best.left, best.top, h)
}

/**
 * Keep `el` beside its item as the board moves (a pan, a zoom, a relayout): placed before paint by the caller's layout effect, then again each frame
 * the item, the element's own size or the free canvas changes. Its position and cap are written as custom properties (`vars`), and only when the computed
 * key changes. It is never hidden: off the free canvas it stays visible inside it. An item with no drawn card puts it at the free canvas's top-left.
 * Returns the stop.
 */
export function stayBeside(get: () => HTMLElement | null, target: DetailsTarget, vars: { x: string; y: string; h: string }, fallbackWidth = DETAILS_WIDTH, minShown = MIN_SHOWN): () => void {
  let raf = 0, last = '', lastWhere = '', natural: number | null = null, dirty = true
  const watch = typeof MutationObserver === 'undefined' ? null : new MutationObserver(() => { dirty = true })
  let watched: HTMLElement | null = null
  const place = () => {
    const el = get()
    if (el !== null) {
      if (watch !== null && watched !== el) { watch.disconnect(); watch.observe(el, { childList: true, subtree: true, characterData: true }); watched = el; dirty = true }
      const { anchor, own } = anchorOf(target), free = freeCanvas()
      const where = [anchor?.left, anchor?.top, anchor?.right, anchor?.bottom, free.left, free.top, free.right, free.bottom].join('|')
      // Its natural height, not the cap it was last given: read free when uncapped; when capped it is measured (cap lifted and put back) only after the
      // item or the canvas moved or its content changed, never every frame.
      const cap = el.style.getPropertyValue(vars.h)
      if (cap === '') natural = el.getBoundingClientRect().height
      else if (natural === null || dirty || where !== lastWhere) {
        el.style.removeProperty(vars.h); natural = el.getBoundingClientRect().height; el.style.setProperty(vars.h, cap)
      }
      dirty = false; lastWhere = where
      const width = el.getBoundingClientRect().width
      const size = { width: width > 0 ? width : fallbackWidth, height: natural }
      const key = `${where}|${size.width}|${size.height}`
      if (key !== last) {
        last = key
        // Its item is not drawn at all (nothing to stand beside): the free canvas's top-left, at its own height. Otherwise beside it.
        const p: Placed = anchor === null ? { left: free.left + HOVER_CARD_GAP, top: free.top + HOVER_CARD_GAP, maxHeight: null } : placeBeside(anchor, own, size, free, minShown)
        el.style.setProperty(vars.x, `${p.left}px`); el.style.setProperty(vars.y, `${p.top}px`)
        if (p.maxHeight === null) el.style.removeProperty(vars.h); else el.style.setProperty(vars.h, `${p.maxHeight}px`)
      }
    }
    raf = requestAnimationFrame(place)
  }
  place()
  return () => { cancelAnimationFrame(raf); watch?.disconnect() }
}
