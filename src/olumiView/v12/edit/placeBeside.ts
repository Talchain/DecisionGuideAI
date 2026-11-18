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
/** Controls at the canvas foot that a box beside a card must also leave clear (they are not the board's own foot controls, which its layout reserves room for: regions.ts FOOT_CONTROLS). */
const ALSO_FOOT = ['[data-testid="views-toggle"]', '[data-testid="views-compare"]'] as const
const overlap = (b: Rect, a: Rect) => Math.max(0, Math.min(b.right, a.right) - Math.max(b.left, a.left)) * Math.max(0, Math.min(b.bottom, a.bottom) - Math.max(b.top, a.top))
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, Math.max(lo, hi)))

/** Where a `size` panel stands beside `anchor` inside `free`, never over the anchor where any place avoids it; always inside `free` (never null). */
export function placeBeside(anchor: Rect, own: Element | null, size: { width: number; height: number }, free: Rect, minShown = MIN_SHOWN, keep?: { left: number; top: number }): Placed {
  const gap = HOVER_CARD_GAP
  const shift = (r: Rect): Rect => ({ left: r.left - free.left, top: r.top - free.top, right: r.right - free.left, bottom: r.bottom - free.top })
  const W = free.right - free.left, H = free.bottom - free.top, w = size.width
  const h = Math.min(size.height, Math.max(minShown, H - 2 * gap))
  // (And the team's Views buttons at the canvas foot, where they are drawn: the box's action row once sat under them.)
  const foot = [...regionsOf().foot, ...ALSO_FOOT.flatMap((s) => [...document.querySelectorAll(s)].map((e) => e.getBoundingClientRect())).filter((r) => r.width > 0 && r.height > 0)].map((r) => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom }))
  const footIn = foot.map(shift)
  // The foot controls (the zoom row, the "N more cards below" cue) are never covered (Codex 2f witness: the panel's last row sat under the cue): a place whose
  // box would reach one is cut to end a gap above it, or lifted when that leaves less than a usable panel.
  const clearFoot = (left: number, top: number, hh: number): { top: number; hh: number } => {
    let t = top, h2 = hh
    for (const f of footIn) {
      if (left >= f.right || left + w <= f.left || t + h2 <= f.top - gap || t >= f.bottom) continue
      const room = f.top - gap - t
      if (room >= minShown) h2 = Math.min(h2, room); else { h2 = Math.min(h2, Math.max(minShown, f.top - 2 * gap)); t = Math.max(gap, f.top - gap - h2) }
    }
    return { top: t, hh: h2 }
  }
  // Every candidate is judged AFTER its foot adjustment (Codex 30422 hold: a lift applied after the own-card check put the panel on its card).
  const fit = (left: number, top: number, hh: number) => { const c = clearFoot(left, top, hh); return { left, top: c.top, h: c.hh } }
  const onCard = (c: { left: number; top: number; h: number }) => hits({ left: c.left, top: c.top, right: c.left + w, bottom: c.top + c.h }, a)
  const out = (c: { left: number; top: number; h: number }): Placed => ({ left: c.left + free.left, top: c.top + free.top, maxHeight: c.h < size.height ? c.h : null })
  const a = shift(anchor)
  // KEEP ITS PLACE (surfaces step A): a box whose item and canvas have not moved, and which only changed size (a preview pinned, a fold opened), stays at the
  // corner it has, cut to the room below it; judged like any candidate, after its foot adjustment and against its own card. Where that leaves less than a
  // usable box, or lands it on its card, it is placed afresh below.
  if (keep !== undefined && within(anchor, free)) {
    const left = keep.left - free.left, top = keep.top - free.top
    if (left >= gap && left + w <= W - gap && top >= gap) {
      const k = fit(left, top, Math.min(h, H - gap - top))
      if (k.top === top && k.h >= minShown && !onCard(k)) return out(k)
    }
  }
  if (within(anchor, free)) {
    // The hover pop-up's rule first (the first side that holds the whole panel, fewest other cards covered); kept only when it is clear of the card.
    const p = placeHoverCard(a, { width: w, height: h }, { width: W, height: H }, [...canvasCardRects(own), ...foot].map(shift), gap)
    const hp = fit(p.left, p.top, h)
    if (!onCard(hp)) return out(hp)
    // No side holds it clear of the card: the side with the most room, the panel cut to that room.
    const sides: Array<{ left: number; top: number; h: number }> = []
    if (W - a.right >= w + 2 * gap) sides.push({ left: a.right + gap, top: clamp(a.top, gap, H - h - gap), h })
    if (a.left >= w + 2 * gap) sides.push({ left: a.left - gap - w, top: clamp(a.top, gap, H - h - gap), h })
    const below = Math.min(h, H - a.bottom - 2 * gap), above = Math.min(h, a.top - 2 * gap), across = clamp(a.left, gap, W - w - gap)
    if (below >= minShown) sides.push({ left: across, top: a.bottom + gap, h: below })
    if (above >= minShown) sides.push({ left: across, top: a.top - gap - above, h: above })
    const best = sides.map((x) => fit(x.left, x.top, x.h)).filter((c) => !onCard(c) && c.h >= minShown).sort((x, y) => y.h - x.h)[0]
    if (best !== undefined) return out(best)
  }
  // The card is off the free canvas, or no side has room: still shown, inside the free canvas, where it overlaps the card least (the first of these on a tie).
  const maxL = W - w - gap, maxT = H - h - gap
  const spots = [
    { left: clamp(a.right + gap, gap, maxL), top: clamp(a.top, gap, maxT) }, { left: clamp(a.left - gap - w, gap, maxL), top: clamp(a.top, gap, maxT) },
    { left: clamp(a.left, gap, maxL), top: clamp(a.bottom + gap, gap, maxT) }, { left: clamp(a.left, gap, maxL), top: clamp(a.top - gap - h, gap, maxT) },
    { left: gap, top: gap }, { left: Math.max(gap, maxL), top: gap }, { left: gap, top: Math.max(gap, maxT) }, { left: Math.max(gap, maxL), top: Math.max(gap, maxT) },
  ]
  let best = fit(spots[0]!.left, spots[0]!.top, h), least = Infinity
  for (const s of spots) { const c = fit(s.left, s.top, h); const o = overlap({ left: c.left, top: c.top, right: c.left + w, bottom: c.top + c.h }, a); if (o < least) { least = o; best = c } }
  return out(best)
}

/**
 * Keep `el` beside its item as the board moves (a pan, a zoom, a relayout): placed before paint by the caller's layout effect, then again each frame
 * the item, the element's own size or the free canvas changes. Its position and cap are written as custom properties (`vars`), and only when the computed
 * key changes. It is never hidden: off the free canvas it stays visible inside it. An item with no drawn card puts it at the free canvas's top-left.
 * Returns the stop.
 */
/** How far (px, each way) an item may move between two placements and still take its box with it; further, the box is placed afresh. */
export const KEEP_REACH = 64

/** The height a preview's place is chosen for: where the box it becomes when pinned will stand, so a press changes what the box holds and not where it is. */
export const PEEK_RESERVE = 360

/** `reserve`: a height the place is chosen for when the element is shorter (a preview: the room its pinned box needs), read each time it is placed. */
export function stayBeside(get: () => HTMLElement | null, target: DetailsTarget, vars: { x: string; y: string; h: string }, fallbackWidth = DETAILS_WIDTH, minShown = MIN_SHOWN, reserve?: () => number): () => void {
  let raf = 0, last = '', lastWhere = '', natural: number | null = null, dirty = true
  let stood: { ax: number; ay: number; free: string; left: number; top: number; placed: number } | null = null
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
      const own_h = natural, res = reserve?.() ?? 0
      const size = { width: width > 0 ? width : fallbackWidth, height: Math.max(own_h, res) }
      const key = `${where}|${size.width}|${own_h}|${res}`
      if (key !== last) {
        last = key
        // Its item is not drawn at all (nothing to stand beside): the free canvas's top-left, at its own height. Otherwise beside it.
        // Its item is not drawn: the free canvas's top-left, capped to the free canvas's height (Codex 008 item 4: uncapped, a tall form ran below the window
        // and took Save with it); the panel's and form's own structure keeps the header and Save/Cancel outside the scrolling body.
        const room = Math.max(minShown, free.bottom - free.top - 2 * HOVER_CARD_GAP)
        // ITS PLACE BESIDE ITS ITEM IS KEPT while the free canvas is as it was and the item has not moved far: the box moves WITH its item, by the item's
        // own move, and is not placed afresh. Measured on the built page (Detailed, 1232x704): the press that pins the box also selects the card, which
        // grows (its quick actions) and which the board lifts 27 px clear of the foot controls; placed afresh at its pinned height the box jumped 62 px.
        // A far move (a jump of the board, a relayout) places it afresh. The kept corner is still judged against the item as it now is (placeBeside).
        const freeKey = [free.left, free.top, free.right, free.bottom].join('|')
        const dx = anchor === null || stood === null ? 0 : anchor.left - stood.ax, dy = anchor === null || stood === null ? 0 : anchor.top - stood.ay
        const keep = anchor !== null && stood !== null && stood.free === freeKey && Math.abs(dx) <= KEEP_REACH && Math.abs(dy) <= KEEP_REACH ? { left: stood.left + dx, top: stood.top + dy } : undefined
        let p: Placed = anchor === null ? { left: free.left + HOVER_CARD_GAP, top: free.top + HOVER_CARD_GAP, maxHeight: size.height > room ? room : null } : placeBeside(anchor, own, size, free, minShown, keep)
        // A MOVE ALONE NEVER SHORTENS THE BOX: carried with its item towards the window's foot, the kept corner has less room below it. Where that would
        // show less of the box than stood before the move, it is placed afresh (as every move was before step A), at the height the free canvas gives it.
        if (anchor !== null && keep !== undefined && stood !== null && (dx !== 0 || dy !== 0) && Math.min(size.height, p.maxHeight ?? size.height) < stood.placed) p = placeBeside(anchor, own, size, free, minShown)
        const placedNow = Math.min(size.height, p.maxHeight ?? size.height)
        // Shorter than the height its place was chosen for (a preview): its cap is its own, and above its item it stands on its bottom edge, next to the item.
        if (anchor !== null && size.height > own_h) {
          const placed = Math.min(size.height, p.maxHeight ?? size.height), shown = Math.min(own_h, placed)
          p = { left: p.left, top: p.top + placed <= anchor.top ? p.top + (placed - shown) : p.top, maxHeight: own_h > placed ? placed : null }
        }
        stood = anchor === null ? null : { ax: anchor.left, ay: anchor.top, free: freeKey, left: p.left, top: p.top, placed: placedNow }
        el.style.setProperty(vars.x, `${p.left}px`); el.style.setProperty(vars.y, `${p.top}px`)
        if (p.maxHeight === null) el.style.removeProperty(vars.h); else el.style.setProperty(vars.h, `${p.maxHeight}px`)
      }
    }
    raf = requestAnimationFrame(place)
  }
  place()
  return () => { cancelAnimationFrame(raf); watch?.disconnect() }
}
