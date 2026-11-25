import { canvasCardRects, HOVER_CARD_GAP, type Rect } from '../../../canvas/components/hoverCard/hoverCardPlacement'
import { isOlumiCoreLane } from '../../../olumiCore/lane'
import { barsOf } from '../../layout'
import { placeNear } from '../../look/placeNear'
import { freeCanvas, openBoxes } from '../../look/placeReaders'
import { useViewStore } from '../../store'
import type { DetailsTarget } from './inspectorStore'

export { freeCanvas } from '../../look/placeReaders'

export const DETAILS_WIDTH = 280
/** The custom properties the panel's position is written to. */
export const DETAILS_X = '--lane-details-x'
export const DETAILS_Y = '--lane-details-y'
export const DETAILS_H = '--lane-details-h'

const quoted = (id: string) => id.replace(/["\\]/g, '\\$&')
const cardNode = (id: string) => document.querySelector(`.react-flow__node[data-id="${quoted(id)}"]`)

/** The drawn card (the aim for a folded bar), or the link's middle. Null when there is no canvas anchor. */
export function anchorOf(t: DetailsTarget): { anchor: Rect | null; own: Element | null } {
  if (t.kind === 'card') {
    let node = cardNode(t.id)
    if (node === null && isOlumiCoreLane()) {
      // Simple draws the bar on its aim. The editor still writes to the bar, but the aim is its on-screen anchor.
      const model = useViewStore.getState().view?.model
      const aim = model == null ? undefined : barsOf(model).get(t.id)
      if (aim !== undefined) node = cardNode(aim)
    }
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

export type Placed = ReturnType<typeof placeNear>
const MIN_SHOWN = 64
/** The form needs space for one field and its Save/Cancel row. */
export const FORM_MIN_SHOWN = 160

type Size = { width: number; height: number }
type Corner = { left: number; top: number; near?: boolean }

export function placeBeside(anchor: Rect, own: Element | null, size: Size, free: Rect, minShown = MIN_SHOWN, keep?: Corner, reserve?: number): Placed {
  return placeBesideAmong(anchor, own, size, free, openBoxes(), minShown, keep, reserve)
}

function insetCanvas(free: Rect): Rect {
  return {
    left: free.left + HOVER_CARD_GAP,
    top: free.top + HOVER_CARD_GAP,
    right: free.right - HOVER_CARD_GAP,
    bottom: free.bottom - HOVER_CARD_GAP,
  }
}

function placeBesideAmong(anchor: Rect, own: Element | null, size: Size, free: Rect, open: readonly Rect[], minShown: number, keep?: Corner, reserve?: number): Placed {
  return placeNear(anchor, size, { region: insetCanvas(free), open, cards: canvasCardRects(own), limit: 48, shrink: true, minShown, keep, reserve })
}

/** A larger move places the box afresh beside the item's new position. */
export const KEEP_REACH = 64

/** The height a preview's place is chosen for: where the box it becomes when pinned will stand, so a press changes what the box holds and not where it is. */
export const PEEK_RESERVE = 360

/** Place before paint, then follow the item, available space and content size. */
export function stayBeside(get: () => HTMLElement | null, target: DetailsTarget, vars: { x: string; y: string; h: string }, fallbackWidth = DETAILS_WIDTH, minShown = MIN_SHOWN, reserve?: () => number): () => void {
  let raf = 0, last = '', lastWhere = '', natural: number | null = null, dirty = true
  let stood: { ax: number; ay: number; free: string; left: number; top: number; placed: number; near: boolean } | null = null
  const watch = typeof MutationObserver === 'undefined' ? null : new MutationObserver(() => { dirty = true })
  let watched: HTMLElement | null = null
  const place = () => {
    const el = get()
    if (el !== null) {
      if (watched !== el) {
        watch?.disconnect()
        watch?.observe(el, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['data-state'] })
        watched = el
        dirty = true
        last = ''
      }
      const { anchor, own } = anchorOf(target)
      const free = freeCanvas()
      const open = openBoxes({ except: el })
      const freeKey = [free.left, free.top, free.right, free.bottom].join('|')
      const where = [
        anchor?.left, anchor?.top, anchor?.right, anchor?.bottom, freeKey,
        ...open.flatMap((box) => [box.left, box.top, box.right, box.bottom]),
      ].join('|')
      const rect = el.getBoundingClientRect()
      // Measure capped content at its natural height when the geometry or contents change.
      const cap = el.style.getPropertyValue(vars.h)
      if (cap === '') natural = rect.height
      else if (natural === null || dirty || where !== lastWhere) {
        el.style.removeProperty(vars.h)
        natural = el.getBoundingClientRect().height
        el.style.setProperty(vars.h, cap)
      }
      dirty = false
      lastWhere = where
      const size = { width: rect.width > 0 ? rect.width : fallbackWidth, height: natural }
      const reserved = reserve?.() ?? 0
      const key = `${where}|${size.width}|${size.height}|${reserved}`
      if (key !== last) {
        last = key
        const dx = anchor === null || stood === null ? 0 : anchor.left - stood.ax
        const dy = anchor === null || stood === null ? 0 : anchor.top - stood.ay
        const keep = anchor !== null && stood !== null && stood.free === freeKey && Math.abs(dx) <= KEEP_REACH && Math.abs(dy) <= KEEP_REACH
          ? { left: stood.left + dx, top: stood.top + dy, near: stood.near }
          : undefined

        // An undrawn item uses the free canvas's top-left, with a cap for tall content.
        const room = Math.max(minShown, free.bottom - free.top - 2 * HOVER_CARD_GAP)
        let p = anchor === null
          ? { left: free.left + HOVER_CARD_GAP, top: free.top + HOVER_CARD_GAP, maxHeight: size.height > room ? room : null, near: false }
          : placeBesideAmong(anchor, own, size, free, open, minShown, keep, reserved)
        if (anchor !== null && keep !== undefined && stood !== null && (dx !== 0 || dy !== 0) && Math.min(size.height, p.maxHeight ?? size.height) < stood.placed) {
          // Give a moving box room for the height it already showed when the canvas floor would cut it.
          const lifted = insetCanvas(free).bottom - stood.placed
          p = placeBesideAmong(anchor, own, size, free, open, minShown, lifted < keep.top ? { left: keep.left, top: lifted } : undefined, reserved)
        }

        stood = anchor === null ? null : { ax: anchor.left, ay: anchor.top, free: freeKey, left: p.left, top: p.top, placed: Math.min(size.height, p.maxHeight ?? size.height), near: p.near }
        el.style.setProperty(vars.x, `${p.left}px`)
        el.style.setProperty(vars.y, `${p.top}px`)
        if (p.maxHeight === null) el.style.removeProperty(vars.h)
        else el.style.setProperty(vars.h, `${p.maxHeight}px`)
      }
    }
    raf = requestAnimationFrame(place)
  }
  place()
  return () => { cancelAnimationFrame(raf); watch?.disconnect() }
}
