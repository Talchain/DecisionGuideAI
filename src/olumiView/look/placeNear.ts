export type Rect = { readonly left: number; readonly right: number; readonly top: number; readonly bottom: number }

type Corner = { left: number; top: number }
type KeptCorner = Corner & { near?: boolean }
type Size = { width: number; height: number }
type Options = {
  region: Rect
  open: readonly Rect[]
  cards: readonly Rect[]
  gap?: number
  limit: number
  keep?: KeptCorner
  minShown?: number
  shrink?: boolean
  reserve?: number
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
export function placeNear(anchor: Rect, { width, height }: Size, { region, open, cards, gap = 8, limit, keep, minShown = 1, shrink = false, reserve = 0 }: Options): Placement {
  const obstacles = [anchor, ...open]
  const minHeight = shrink ? Math.min(height, minShown) : height
  const roomLimit = Math.max(height, reserve)
  const lastLeft = region.right - width
  const boxAt = (left: number, top: number, shown: number): Rect => ({ left, top, right: left + width, bottom: top + shown })
  const result = (left: number, top: number, shown: number, near: boolean): Placement => ({
    left, top, maxHeight: shown < height ? shown : null, near,
  })
  const inside = (box: Rect) => box.left >= region.left && box.right <= region.right && box.top >= region.top && box.bottom <= region.bottom
  const clear = (box: Rect) => !obstacles.some((obstacle) => hits(box, obstacle))
  const heightAt = (left: number, top: number, avoid: readonly Rect[], requested = height) => {
    let shown = Math.min(requested, region.bottom - top)
    const span = boxAt(left, top, minHeight)
    for (const obstacle of avoid) {
      if (across(span, obstacle) && top < obstacle.bottom) shown = Math.min(shown, obstacle.top - top)
    }
    return shown
  }
  const candidate = (left: number, top: number, requested = height, reach = limit) => {
    const shown = shrink ? Math.min(requested, region.bottom - top) : requested
    const box = boxAt(left, top, shown)
    return shown >= minHeight && inside(box) && clear(box) && distance(anchor, box) <= reach ? { box, shown } : null
  }

  const kept = keep === undefined ? null : candidate(
    keep.left, keep.top,
    shrink ? heightAt(keep.left, keep.top, obstacles) : height,
    keep.near === false ? Infinity : limit,
  )
  if (kept !== null && distance(anchor, kept.box) <= limit) {
    return result(kept.box.left, kept.box.top, kept.shown, true)
  }

  let best: Placement | null = null
  let bestCovered = Infinity
  let bestRoom = -Infinity
  const consider = (left: number, top: number, requested?: number) => {
    const placed = candidate(left, top, requested)
    if (placed === null) return
    const covered = cards.reduce((total, card) => total + overlap(placed.box, card), 0)
    const room = shrink ? heightAt(left, top, [{ ...anchor, top: anchor.top - gap }, ...open], roomLimit) : height
    const offCards = covered === 0
    const sameCardClearance = offCards === (bestCovered === 0)
    if (sameCardClearance ? room > bestRoom || (room === bestRoom && covered < bestCovered) : offCards) {
      bestCovered = covered
      bestRoom = room
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
  if (best !== null && bestCovered === 0) return best

  // An obstacle stops blocking a corner at its far edge or one box span before its near edge.
  // Those edges and the region bounds also include the projections that minimise distance to the anchor.
  const lastTop = region.bottom - minHeight
  const nearestClear = (avoid: readonly Rect[], near: boolean): Placement | null => {
    if (lastLeft < region.left || lastTop < region.top) return null
    const xs = new Set([
      region.left, lastLeft,
      ...avoid.flatMap((r) => [r.left - width, r.right]).map((x) => clamp(x, region.left, lastLeft)),
    ])
    const ys = new Set([
      region.top, lastTop, clamp(anchor.top - height, region.top, lastTop),
      ...avoid.flatMap((r) => [r.top - minHeight, r.bottom]).map((y) => clamp(y, region.top, lastTop)),
    ])
    let found: Placement | null = null
    let nearest = near ? limit : Infinity
    let mostShown = -1
    for (const left of xs) {
      for (const top of ys) {
        const minimum = boxAt(left, top, minHeight)
        if (avoid.some((obstacle) => hits(minimum, obstacle))) continue
        const shown = shrink ? heightAt(left, top, avoid) : height
        if (shown < minHeight) continue
        const away = distance(anchor, boxAt(left, top, shown))
        if (away < nearest || (away === nearest && shown > mostShown)) {
          nearest = away
          mostShown = shown
          found = result(left, top, shown, near)
        }
      }
    }
    return found
  }

  // A panel that can shrink may fit in a nearby gap even when the usual sides cover a card.
  if (shrink && cards.length > 0) {
    const reach = { left: anchor.left - width - limit, right: anchor.right + width + limit, top: anchor.top - height - limit, bottom: anchor.bottom + height + limit }
    const nearbyCards = cards.filter((card) => hits(reach, card))
    if (nearbyCards.length > 0) {
      const clearOfCards = nearestClear([...obstacles, ...nearbyCards], true)
      if (clearOfCards !== null) return clearOfCards
    }
  }
  if (best !== null) return best
  const clearPlace = nearestClear(obstacles, false)
  if (clearPlace !== null) {
    // A previous fallback keeps its corner while it is still one of the closest clear places.
    const clearBox = boxAt(clearPlace.left, clearPlace.top, clearPlace.maxHeight ?? height)
    if (kept !== null && distance(anchor, kept.box) <= distance(anchor, clearBox)) {
      return result(kept.box.left, kept.box.top, kept.shown, false)
    }
    return clearPlace
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
