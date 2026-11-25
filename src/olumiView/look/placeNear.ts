import { DOCK_SELECTOR } from '../../canvas/utils/computeFitPadding'
import { FOOT_CONTROLS, LENS_KEYS, type Rect } from '../regions'
import { freeCanvas } from '../v12/edit/placeBeside'

type Corner = { left: number; top: number }
type Size = { width: number; height: number }
type Options = {
  region: Rect
  open: readonly Rect[]
  cards: readonly Rect[]
  gap?: number
  limit: number
  keep?: Corner
  minShown?: number
  shrink?: boolean
}
type Placement = Corner & { maxHeight: number | null; near: boolean }

const clamp = (value: number, start: number, end: number) => Math.max(start, Math.min(value, end))
const across = (a: Rect, b: Rect) => a.left < b.right && a.right > b.left
const hits = (a: Rect, b: Rect) => across(a, b) && a.top < b.bottom && a.bottom > b.top
const overlap = (a: Rect, b: Rect) =>
  Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
  Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
const distance = (a: Rect, b: Rect) => Math.hypot(
  Math.max(a.left - b.right, b.left - a.right, 0),
  Math.max(a.top - b.bottom, b.top - a.bottom, 0),
)

/** Places a box in screen coordinates. Shared edges are clear, and distance is measured between the rectangles. */
export function placeNear(anchor: Rect, { width, height }: Size, { region, open, cards, gap = 8, limit, keep, minShown = 1, shrink = false }: Options): Placement {
  const obstacles = [anchor, ...open]
  const minHeight = shrink ? Math.min(height, minShown) : height
  const lastLeft = region.right - width
  const boxAt = (left: number, top: number, shown: number): Rect => ({ left, top, right: left + width, bottom: top + shown })
  const result = (left: number, top: number, shown: number, near: boolean): Placement => ({
    left, top, maxHeight: shown < height ? shown : null, near,
  })
  const inside = (box: Rect) => box.left >= region.left && box.right <= region.right && box.top >= region.top && box.bottom <= region.bottom
  const clear = (box: Rect) => !obstacles.some((obstacle) => hits(box, obstacle))
  const candidate = (left: number, top: number, requested = height) => {
    const shown = shrink ? Math.min(requested, region.bottom - top) : requested
    const box = boxAt(left, top, shown)
    return shown >= minHeight && inside(box) && clear(box) && distance(anchor, box) <= limit ? { box, shown } : null
  }

  if (keep !== undefined) {
    const kept = candidate(keep.left, keep.top)
    if (kept !== null) return result(keep.left, keep.top, kept.shown, true)
  }

  let best: Placement | null = null
  let leastCovered = Infinity
  const consider = (left: number, top: number, requested?: number) => {
    const placed = candidate(left, top, requested)
    if (placed === null) return
    const covered = cards.reduce((total, card) => total + overlap(placed.box, card), 0)
    if (covered < leastCovered) {
      leastCovered = covered
      best = result(left, top, placed.shown, true)
    }
  }
  const tops = [anchor.top, anchor.bottom - height, clamp(anchor.top, region.top, region.bottom - height)]
  const lefts = [anchor.left, anchor.right - width, clamp(anchor.left, region.left, lastLeft)]
  const aboveBottom = anchor.top - gap
  const aboveHeight = shrink ? Math.min(height, aboveBottom - region.top) : height
  for (const top of tops) consider(anchor.right + gap, top)
  for (const top of tops) consider(anchor.left - gap - width, top)
  for (const left of lefts) consider(left, anchor.bottom + gap)
  for (const left of lefts) consider(left, aboveBottom - aboveHeight, aboveHeight)
  if (best !== null) return best

  // An obstacle stops blocking a corner at its far edge or one box span before its near edge.
  // Those edges and the region bounds also include the projections that minimise distance to the anchor.
  const lastTop = region.bottom - minHeight
  if (lastLeft >= region.left && lastTop >= region.top) {
    const xs = new Set([
      region.left, lastLeft,
      ...obstacles.flatMap((r) => [r.left - width, r.right]).map((x) => clamp(x, region.left, lastLeft)),
    ])
    const ys = new Set([
      region.top, lastTop, clamp(anchor.top - height, region.top, lastTop),
      ...obstacles.flatMap((r) => [r.top - minHeight, r.bottom]).map((y) => clamp(y, region.top, lastTop)),
    ])
    let nearest = Infinity
    let mostShown = -1
    for (const left of xs) {
      for (const top of ys) {
        const minimum = boxAt(left, top, minHeight)
        if (!clear(minimum)) continue
        let shown = Math.min(height, region.bottom - top)
        if (shrink) {
          for (const obstacle of obstacles) {
            if (across(minimum, obstacle) && top < obstacle.bottom) shown = Math.min(shown, obstacle.top - top)
          }
        }
        if (shown < minHeight) continue
        const away = distance(anchor, boxAt(left, top, shown))
        if (away < nearest || (away === nearest && shown > mostShown)) {
          nearest = away
          mostShown = shown
          best = result(left, top, shown, false)
        }
      }
    }
    if (best !== null) return best
  }

  // At a fixed height the least anchor overlap is at a region corner. The minimum permitted height
  // can only reduce that overlap. An oversized box starts at the region edge on the axis that cannot fit.
  const full = shrink ? Math.min(height, Math.max(minHeight, region.bottom - region.top)) : height
  let leastOverlap = Infinity
  let fallback = result(region.left, region.top, full, false)
  for (const shown of new Set([full, minHeight])) {
    for (const left of [region.left, Math.max(region.left, lastLeft)]) {
      for (const top of [region.top, Math.max(region.top, region.bottom - shown)]) {
        const covered = overlap(anchor, boxAt(left, top, shown))
        if (covered < leastOverlap) {
          leastOverlap = covered
          fallback = result(left, top, shown, false)
        }
      }
    }
  }
  return fallback
}

export function regionFor(el: Element | null = null): Rect {
  const dock = el?.closest(DOCK_SELECTOR)
  if (dock) return dock.getBoundingClientRect()
  if (el?.closest('.react-flow')) return freeCanvas()
  return { left: 8, top: 8, right: window.innerWidth - 8, bottom: window.innerHeight - 8 }
}

export function openBoxes(): Rect[] {
  const selectors = ['[data-testid="lane-inspector"]', ...LENS_KEYS, ...FOOT_CONTROLS]
  return [...document.querySelectorAll(selectors.join(','))].flatMap((el) => {
    const rect = el.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return []
    const visibility = getComputedStyle(el).visibility
    return visibility === 'hidden' || visibility === 'collapse' ? [] : [rect]
  })
}
